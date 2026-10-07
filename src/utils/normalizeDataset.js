/**
 * Enterprise Dataset Normalizer for RicozData.
 * Maps raw MongoDB Dataset documents into the canonical shape required by
 * Data Catalog components (DatasetTable, DatasetRow, DatasetDrawer, etc.).
 *
 * Exclusively uses real metadata without hardcoding synthetic records.
 */

export function normalizeBackendDataset(d) {
  if (!d) return null;

  const SOURCE_TYPE_LABELS = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    sqlserver: 'SQL Server',
    snowflake: 'Snowflake',
    mongodb: 'MongoDB',
    s3: 'Amazon S3'
  };

  const stringId = d._id ? String(d._id) : (d.id || d.name);
  const rawType = (d.dataSourceId?.type || d.sourceType || '').toLowerCase();
  const sourceName = d.dataSourceId?.name || d.source || d.sourceSystem || SOURCE_TYPE_LABELS[rawType] || 'External Source';
  const schemaName = d.schemaName || 'public';

  // Normalize schema columns from columns or schema arrays
  const rawCols = (d.columns && Array.isArray(d.columns) && d.columns.length > 0)
    ? d.columns
    : ((d.schema && Array.isArray(d.schema) && d.schema.length > 0) ? d.schema : []);

  const normalizedSchema = rawCols.map(col => ({
    name: col.name,
    type: col.dataType || col.type || 'VARCHAR',
    primaryKey: Boolean(col.isPrimaryKey || col.primaryKey),
    nullable: col.nullable !== false,
    pii: Boolean(col.classification === 'pii' || col.piiClassification === 'pii' || col.pii),
    description: col.description || (col.isPrimaryKey ? 'Primary Key' : '')
  }));

  const columnsCount = typeof d.columnsCount === 'number'
    ? d.columnsCount
    : normalizedSchema.length;

  const rowCount = d.rowCount !== undefined && d.rowCount !== null
    ? d.rowCount
    : (d.schemaMetadata?.rowCount !== undefined && d.schemaMetadata?.rowCount !== null
      ? d.schemaMetadata.rowCount
      : (d.statistics?.rowCount ?? 0));

  const sizeBytes = d.sizeBytes || d.schemaMetadata?.sizeBytes || 0;

  // Authoritative quality handling
  const rawQuality = typeof d.quality === 'number'
    ? d.quality
    : (typeof d.qualityScore === 'number'
      ? d.qualityScore
      : (d.qualityScore?.score ?? (typeof d.qualityDetails?.score === 'number' ? d.qualityDetails.score : null)));

  const notAssessed = d.notAssessed !== undefined
    ? d.notAssessed
    : (rawQuality === null || rawQuality === undefined);

  const quality = notAssessed ? null : rawQuality;
  const qualityStatus = d.qualityStatus || (notAssessed ? 'Not Assessed' : (quality >= 80 ? 'Healthy' : quality >= 50 ? 'Warning' : 'Critical'));

  // Authoritative views/usage handling
  const viewsCount = typeof d.views === 'number'
    ? d.views
    : (typeof d.viewCount === 'number'
      ? d.viewCount
      : (typeof d.metadata?.views === 'number'
        ? d.metadata.views
        : (typeof d.usageCount === 'number' ? d.usageCount : 0)));

  const usageDisplay = `${viewsCount.toLocaleString()} views`;

  // Authoritative ownership & stewardship
  const ownerName = d.ownerId?.name || (typeof d.owner === 'string' && d.owner.trim() ? d.owner : null) || 'Unassigned';
  const ownerEmail = d.ownerId?.email || d.ownerEmail || null;
  const ownerRole = d.ownerId?.role || d.ownerRole || null;
  const stewardName = d.stewardId?.name || (typeof d.steward === 'string' && d.steward.trim() ? d.steward : null) || null;

  const domainName = d.domainId?.name || (typeof d.domain === 'string' && d.domain.trim() ? d.domain : null) || (schemaName === 'public' ? 'Core' : schemaName) || 'Core';

  const databaseName = d.dataSourceId?.connectionConfig?.database ||
    d.dataSourceId?.configuration?.database ||
    d.dataSourceId?.configuration?.bucket ||
    d.dataSourceId?.database || null;

  const rawDate = d.updatedAt || d.lastUpdatedAt || d.lastRefreshedAt || d.lastAccessedAt || d.createdAt;
  const formattedDate = rawDate
    ? new Date(rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not Available';

  let rowsDisplay = `${rowCount} rows`;
  if (d.type === 'file' || d.assetType === 'file' || rawType === 's3') {
    rowsDisplay = sizeBytes > 0 ? `${(sizeBytes / 1024).toFixed(1)} KB` : 'Object';
  } else if (d.type === 'collection' || d.assetType === 'collection' || rawType === 'mongodb') {
    rowsDisplay = `${rowCount} docs`;
  }

  const sensitivity = d.sensitivity || (d.classification === 'pii' ? 'Restricted' : d.classification === 'confidential' ? 'Confidential' : d.classification === 'restricted' ? 'Restricted' : d.classification === 'public' ? 'Public' : (d.classification ? d.classification.toUpperCase() : 'Internal'));

  const description = d.description || d.technicalDescription || d.businessDescription || '';
  const longDescription = d.longDescription || d.description || d.businessDescription || d.technicalDescription || '';

  return {
    id: stringId,
    _id: stringId,
    name: d.name,
    displayName: d.displayName || d.name,
    schemaName,
    domain: domainName,
    domainId: d.domainId?._id ? String(d.domainId._id) : (typeof d.domainId === 'string' ? d.domainId : null),
    ownerId: d.ownerId?._id ? String(d.ownerId._id) : (typeof d.ownerId === 'string' ? d.ownerId : null),
    owner: ownerName,
    ownerEmail,
    ownerRole,
    steward: stewardName,
    dataSourceId: d.dataSourceId?._id ? String(d.dataSourceId._id) : (typeof d.dataSourceId === 'string' ? d.dataSourceId : null),
    source: sourceName,
    sourceType: SOURCE_TYPE_LABELS[rawType] || rawType || 'External Source',
    sourceDetails: {
      type: SOURCE_TYPE_LABELS[rawType] || d.dataSourceId?.type || 'External Source',
      rawType,
      database: databaseName,
      schema: schemaName,
      environment: d.dataSourceId?.environment || d.environment || 'Production',
      syncSchedule: d.dataSourceId?.syncSchedule || 'On-Demand',
      status: d.dataSourceId?.status || (d.syncStatus === 'ACTIVE' ? 'ACTIVE' : d.syncStatus || 'UNKNOWN')
    },
    quality,
    qualityScore: quality,
    qualityStatus,
    notAssessed,
    origin: d.origin || 'DISCOVERED',
    syncStatus: d.syncStatus || 'ACTIVE',
    externalId: d.externalId || null,
    tableName: d.tableName || (d.externalId && d.externalId.includes('.') ? d.externalId.split('.').slice(1).join('.') : d.name),
    type: d.type || d.assetType || 'table',
    assetType: d.assetType || d.type || 'table',
    status: d.status || (d.syncStatus === 'ACTIVE' ? 'Active' : d.syncStatus || 'Draft'),
    certificationStatus: d.metadata?.certificationStatus || d.certificationStatus || null,
    updated: formattedDate,
    lastUpdatedDate: formattedDate,
    rows: rowsDisplay,
    rowCount,
    sizeBytes,
    columnsCount,
    views: viewsCount,
    viewCount: viewsCount,
    sensitivity,
    usage: usageDisplay,
    statistics: {
      rowCount,
      sizeBytes,
      columnCount: columnsCount,
      lastIngestionTime: rawDate || null
    },
    description,
    longDescription,
    tags: Array.isArray(d.tags) ? d.tags : [],
    documentation: Array.isArray(d.documentation) ? d.documentation : [],
    schema: normalizedSchema,
    columns: normalizedSchema,
    _raw: d
  };
}

export default normalizeBackendDataset;
