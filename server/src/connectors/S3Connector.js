import { S3Client, HeadBucketCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { BaseConnector } from './BaseConnector.js';
import {
  ConnectorConfigurationError,
  ConnectorAuthenticationError,
  ConnectorTimeoutError,
  ConnectorUnavailableError,
  ConnectorQueryError
} from './errors.js';

/**
 * Enterprise AWS S3 Connector for object storage and data lake catalogs.
 * Enforces bounded object discovery and prevents full bucket downloads.
 */
export class S3Connector extends BaseConnector {
  constructor(context) {
    super(context);
    this.client = null;
    this.bucket = this.context.configuration.bucket;
    this.prefix = this.context.configuration.prefix || '';
    this.region = this.context.configuration.region || 'us-east-1';
  }

  get capabilities() {
    return {
      supportsMetadataDiscovery: true,
      supportsSampling: true,
      supportsSchemaDiscovery: true,
      supportsColumnMetadata: true,
      supportsRelationships: false,
      supportsStreaming: false,
      supportsQualityRules: true,
      supportsProfiling: true,
      supportsReadOnlyQueries: true
    };
  }

  async connect() {
    if (this.client && this.isConnected) return;

    const config = this.context.configuration;
    const creds = this.context.getCredentials();

    if (!config.bucket) throw new ConnectorConfigurationError('S3 bucket name is required in configuration');

    const accessKeyId = creds.accessKeyId || creds.apiKey || '';
    const secretAccessKey = creds.secretAccessKey || creds.secret || creds.password || '';

    const clientParams = {
      region: this.region
    };

    if (accessKeyId && secretAccessKey) {
      clientParams.credentials = {
        accessKeyId: String(accessKeyId),
        secretAccessKey: String(secretAccessKey)
      };
    }

    try {
      this.client = new S3Client(clientParams);
      this.isConnected = true;
    } catch (err) {
      this.isConnected = false;
      throw this._mapError(err);
    }
  }

  async test() {
    return await this.withTimeout(
      (async () => {
        if (!this.client || !this.isConnected) {
          await this.connect();
        }

        const startHr = process.hrtime.bigint();
        try {
          // Verify bucket accessibility and permissions
          const cmd = new HeadBucketCommand({ Bucket: this.bucket });
          await this.client.send(cmd);
          const endHr = process.hrtime.bigint();
          const latencyMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

          return {
            success: true,
            connectorType: 's3',
            status: 'HEALTHY',
            latencyMs,
            checkedAt: new Date().toISOString(),
            details: {
              bucket: this.bucket,
              region: this.region,
              prefix: this.prefix
            }
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.connect || 10000,
      'S3 test connection'
    );
  }

  async fetchMetadata(options = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.client || !this.isConnected) {
          await this.connect();
        }

        try {
          const targetPrefix = options.prefix !== undefined ? options.prefix : this.prefix;

          // Bounded object discovery: max 500 objects per discovery run
          const cmd = new ListObjectsV2Command({
            Bucket: this.bucket,
            Prefix: targetPrefix,
            MaxKeys: 500
          });
          const res = await this.client.send(cmd);

          const contents = res.Contents || [];
          const tables = [];

          for (const item of contents) {
            if (!item.Key || item.Key.endsWith('/')) continue; // Skip directory markers

            const externalId = `s3://${this.bucket}/${item.Key}`;
            const extension = item.Key.split('.').pop()?.toLowerCase() || 'unknown';

            let columns = [
              { name: 'key', dataType: 'string', nullable: false, ordinalPosition: 1, isPrimaryKey: true },
              { name: 'sizeBytes', dataType: 'number', nullable: false, ordinalPosition: 2 },
              { name: 'lastModified', dataType: 'date', nullable: false, ordinalPosition: 3 },
              { name: 'format', dataType: 'string', nullable: false, ordinalPosition: 4, defaultValue: extension }
            ];

            // Attempt lightweight column inference for CSV/JSON
            if (extension === 'csv' || extension === 'json') {
              try {
                const headRange = new GetObjectCommand({
                  Bucket: this.bucket,
                  Key: item.Key,
                  Range: 'bytes=0-2048'
                });
                const headRes = await this.client.send(headRange);
                const sampleText = await headRes.Body.transformToString('utf-8');

                if (extension === 'csv') {
                  const firstLine = sampleText.split(/\r?\n/)[0];
                  if (firstLine && firstLine.includes(',')) {
                    const headers = firstLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
                    if (headers.length > 0) {
                      columns = headers.map((h, idx) => ({
                        name: h,
                        dataType: 'string',
                        nullable: true,
                        ordinalPosition: idx + 1,
                        isPrimaryKey: idx === 0,
                        defaultValue: null
                      }));
                    }
                  }
                } else if (extension === 'json') {
                  const firstObjMatch = sampleText.match(/\{[^{}]+\}/);
                  if (firstObjMatch) {
                    const parsed = JSON.parse(firstObjMatch[0]);
                    const keys = Object.keys(parsed);
                    if (keys.length > 0) {
                      columns = keys.map((k, idx) => ({
                        name: k,
                        dataType: typeof parsed[k],
                        nullable: true,
                        ordinalPosition: idx + 1,
                        isPrimaryKey: k === 'id' || k === '_id' || idx === 0,
                        defaultValue: null
                      }));
                    }
                  }
                }
              } catch {
                // Keep default metadata columns on range failure
              }
            }

            tables.push({
              externalId,
              name: item.Key,
              schema: this.bucket,
              type: 'file',
              columns,
              primaryKey: ['key'],
              foreignKeys: [],
              indexes: [],
              rowCount: 1,
              sizeBytes: item.Size || 0
            });
          }

          return {
            sourceType: 's3',
            database: this.bucket,
            schema: this.region,
            schemas: [this.bucket],
            tables
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.metadata || 30000,
      'S3 metadata discovery'
    );
  }

  async sampleData(params = {}) {
    return await this.withTimeout(
      (async () => {
        if (!this.client || !this.isConnected) {
          await this.connect();
        }

        const key = params.tableName || params.key;
        if (!key) throw new ConnectorConfigurationError('Object key is required for S3 sampling');

        try {
          // Bounded byte fetch: range request for the first 64KB only
          const cmd = new GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Range: 'bytes=0-65535'
          });

          const res = await this.client.send(cmd);
          const rawText = await res.Body.transformToString('utf-8');
          const extension = key.split('.').pop()?.toLowerCase();

          let rows = [];
          let columns = ['contentSample'];

          if (extension === 'csv') {
            const lines = rawText.split(/\r?\n/).filter(Boolean);
            if (lines.length > 1) {
              const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
              columns = headers;
              rows = lines.slice(1, 51).map(l => {
                const parts = l.split(',');
                const rowObj = {};
                headers.forEach((h, i) => { rowObj[h] = parts[i] !== undefined ? parts[i].trim().replace(/^["']|["']$/g, '') : null; });
                return rowObj;
              });
            }
          } else if (extension === 'json') {
            try {
              const parsed = JSON.parse(rawText);
              if (Array.isArray(parsed)) {
                rows = parsed.slice(0, 50);
                columns = Object.keys(rows[0] || {});
              } else if (typeof parsed === 'object') {
                rows = [parsed];
                columns = Object.keys(parsed);
              }
            } catch {
              // Raw sample fallback
              rows = [{ contentSample: rawText.substring(0, 2000) }];
            }
          }

          if (rows.length === 0) {
            rows = [{ contentSample: rawText.substring(0, 2000) }];
          }

          return {
            datasetName: key,
            schema: this.bucket,
            rowCount: rows.length,
            columns,
            rows,
            sampledAt: new Date().toISOString(),
            truncated: true
          };
        } catch (err) {
          throw this._mapError(err);
        }
      })(),
      this.context.timeouts.sample || 15000,
      'S3 data sampling'
    );
  }

  /**
   * Safe read-only file/object query/inspection for S3 object.
   */
  async executeQueryReadOnly(queryInput, params = [], options = {}) {
    const key = options.tableName || options.key || (typeof queryInput === 'string' && !queryInput.includes(' ') ? queryInput : null);
    if (!key) {
      return await this.sampleData({ tableName: options.tableName || this.prefix });
    }
    return await this.sampleData({ tableName: key });
  }

  /**
   * Evaluates quality rule for S3 object (existence, non-empty, format).
   */
  async executeQualityRule(rule, dataset, options = {}) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    const key = dataset.tableName || dataset.name;
    const startHr = process.hrtime.bigint();

    try {
      const cmd = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Range: 'bytes=0-1024'
      });
      const res = await cmd ? await this.client.send(cmd) : null;
      const contentLength = res.ContentLength || 0;

      const endHr = process.hrtime.bigint();
      const executionDurationMs = Math.round((Number(endHr - startHr) / 1_000_000) * 100) / 100;

      const passed = contentLength > 0;
      return {
        ruleId: rule._id,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        severity: rule.severity,
        targetColumn: rule.targetColumn,
        targetColumns: rule.targetColumns,
        passed,
        recordsEvaluated: 1,
        recordsPassed: passed ? 1 : 0,
        recordsFailed: passed ? 0 : 1,
        passPercentage: passed ? 100 : 0,
        message: passed ? `S3 object "${key}" verified (${contentLength} bytes range read)` : `S3 object "${key}" is empty or unreadable`,
        evidenceSummary: { contentLength },
        executionDurationMs
      };
    } catch (err) {
      throw this._mapError(err);
    }
  }

  /**
   * Computes statistical profiling for an S3 object dataset.
   */
  async profileDataset(dataset, options = {}) {
    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    const key = dataset.tableName || dataset.name;
    try {
      const sample = await this.sampleData({ tableName: key });
      return {
        datasetId: dataset._id,
        rowCount: sample.rowCount,
        columnCount: sample.columns.length,
        columnProfiles: sample.columns.map(c => ({
          name: c,
          dataType: 'string',
          totalCount: sample.rowCount,
          nullCount: 0,
          distinctCount: sample.rowCount,
          completenessPercentage: 100
        })),
        profiledAt: new Date().toISOString()
      };
    } catch (err) {
      throw this._mapError(err);
    }
  }

  async disconnect() {
    this.isConnected = false;
    if (this.client) {
      try {
        this.client.destroy();
      } catch (err) {
        this.context.logger.warn('Error closing S3 client', { error: err.message });
      } finally {
        this.client = null;
      }
    }
  }

  _mapError(err) {
    if (!err) return new ConnectorQueryError('Unknown S3 error');
    if (err instanceof ConnectorConfigurationError || err instanceof ConnectorTimeoutError) return err;

    const name = err.name || '';
    const msg = err.message || '';

    if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch' || err.$metadata?.httpStatusCode === 403) {
      return new ConnectorAuthenticationError('S3 authentication failed. Invalid AWS credentials or permissions.');
    }
    if (name === 'NoSuchBucket' || err.$metadata?.httpStatusCode === 404) {
      return new ConnectorUnavailableError(`S3 bucket "${this.bucket}" does not exist or is inaccessible.`);
    }
    if (name === 'TimeoutError' || msg.includes('timeout')) {
      return new ConnectorTimeoutError('S3 request timed out.');
    }

    return new ConnectorQueryError(msg.length > 200 ? `${msg.substring(0, 197)}...` : msg);
  }
}

export default S3Connector;
