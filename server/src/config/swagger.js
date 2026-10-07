/**
 * OpenAPI 3.0.3 Specification for RicozData Enterprise Platform API v1.
 * Authoritative API contract for authentication, users, catalog, search, and dashboard.
 */
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'RicozData Enterprise API',
    version: '1.0.0',
    description: 'Enterprise Multi-Tenant Data Governance, Intelligence, and Quality Platform API',
    contact: {
      name: 'RicozData Security & Architecture Team',
      email: 'security@ricozdata.io'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived JWT Access Token'
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'ricoz_refresh_token',
        description: 'HTTP-only secure refresh token cookie'
      },
      tenantHeader: {
        type: 'apiKey',
        in: 'header',
        name: 'x-tenant-slug',
        description: 'Target tenant organization slug'
      }
    },
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          error: { type: 'null', example: null },
          meta: { type: 'object' }
        },
        required: ['success', 'data', 'error', 'meta']
      },
      ErrorEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          data: { type: 'null', example: null },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed' },
              details: { type: 'object' }
            },
            required: ['code', 'message', 'details']
          },
          meta: { type: 'object' }
        },
        required: ['success', 'data', 'error', 'meta']
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 25 },
          total: { type: 'integer', example: 100 },
          totalPages: { type: 'integer', example: 4 },
          hasNextPage: { type: 'boolean', example: true },
          hasPreviousPage: { type: 'boolean', example: false }
        },
        required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPreviousPage']
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', example: 'jane.doe@enterprise.com' },
          role: { type: 'string', enum: ['owner', 'admin', 'data_steward', 'data_engineer', 'analyst', 'viewer'], example: 'admin' },
          status: { type: 'string', enum: ['active', 'suspended', 'invited'], example: 'active' },
          organizationId: { type: 'string', example: '60d0fe4f5311236168a109cb' }
        }
      },
      Organization: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109cb' },
          name: { type: 'string', example: 'Acme Corporation' },
          slug: { type: 'string', example: 'acme' },
          domain: { type: 'string', example: 'acme.ricoz.io' },
          status: { type: 'string', enum: ['active', 'suspended', 'trial', 'pending_verification'], example: 'active' }
        }
      },
      DataSource: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '60d0fe4f5311236168a109ca' },
          name: { type: 'string', example: 'Production Postgres' },
          type: {
            type: 'string',
            enum: ['postgresql', 'mysql', 'snowflake', 'mongodb', 's3'],
            example: 'postgresql'
          },
          description: { type: 'string', example: 'Primary PostgreSQL production replica' },
          status: {
            type: 'string',
            enum: ['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING', 'DISCONNECTED'],
            example: 'ACTIVE'
          },
          credentialStatus: {
            type: 'string',
            enum: ['configured', 'none'],
            example: 'configured'
          },
          healthStatus: {
            type: 'string',
            enum: ['UNKNOWN', 'HEALTHY', 'UNHEALTHY', 'DEGRADED', 'UNTESTED'],
            example: 'UNTESTED'
          },
          connectionState: {
            type: 'string',
            enum: ['DISCONNECTED', 'CONNECTED', 'CONNECTING', 'ERROR', 'UNKNOWN'],
            example: 'DISCONNECTED'
          },
          configuration: {
            type: 'object',
            properties: {
              host: { type: 'string', example: 'pg.internal' },
              port: { type: 'integer', example: 5432 },
              database: { type: 'string', example: 'analytics' },
              ssl: { type: 'boolean', example: true }
            }
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['prod', 'finance']
          },
          lastTestedAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      CreateDataSourceRequest: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', example: 'Analytics Postgres Replica' },
          type: {
            type: 'string',
            enum: ['postgresql', 'mysql', 'snowflake', 'mongodb', 's3'],
            example: 'postgresql'
          },
          description: { type: 'string', example: 'Core analytics transaction store' },
          configuration: {
            type: 'object',
            description: 'Non-secret connection parameters',
            example: { host: 'pg.internal', port: 5432, database: 'analytics' }
          },
          credentials: {
            type: 'object',
            description: 'Write-only secret credentials. Encrypted immediately via AES-256-GCM and never returned in responses',
            example: { password: '••••••••' }
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            example: ['prod', 'analytics']
          }
        }
      },
      UpdateDataSourceRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Updated Postgres Name' },
          description: { type: 'string' },
          type: { type: 'string', enum: ['postgresql', 'mysql', 'snowflake', 'mongodb', 's3'] },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'ERROR', 'PENDING', 'DISCONNECTED'] },
          configuration: { type: 'object' },
          credentials: { type: 'object', description: 'Updated credentials to re-encrypt with active key' },
          tags: { type: 'array', items: { type: 'string' } }
        }
      },
      Dataset: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string', example: 'dim_customers' },
          type: { type: 'string', enum: ['table', 'view', 'stream', 'file'], example: 'table' },
          dataSourceId: { type: 'string' },
          description: { type: 'string', example: 'Customer dimensional model' }
        }
      },
      DashboardSummary: {
        type: 'object',
        properties: {
          totalDatasets: { type: 'integer', example: 12 },
          activeDataSources: { type: 'integer', example: 4 },
          failedDataSources: { type: 'integer', example: 0 },
          totalUsers: { type: 'integer', example: 8 },
          qualityScore: { type: 'number', example: 94.5 },
          activeAlerts: { type: 'integer', example: 2 },
          recentActivityCount: { type: 'integer', example: 15 }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'Liveness probe and service health',
        responses: {
          '200': { description: 'API is healthy' }
        }
      }
    },
    '/health/ready': {
      get: {
        summary: 'Readiness probe for database connection',
        responses: {
          '200': { description: 'Database connected and ready' },
          '503': { description: 'Database unavailable' }
        }
      }
    },
    '/auth/login': {
      post: {
        summary: 'Email / password authentication',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' }
                },
                required: ['email', 'password']
              }
            }
          }
        },
        responses: {
          '200': { description: 'Authenticated successfully, sets HTTP-only refresh cookie' },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token and issue new access token',
        responses: {
          '200': { description: 'Token rotated successfully' },
          '401': { description: 'Session expired, revoked, or reuse detected' }
        }
      }
    },
    '/auth/logout': {
      post: {
        summary: 'Logout and revoke current session',
        responses: {
          '200': { description: 'Logged out successfully' }
        }
      }
    },
    '/auth/me': {
      get: {
        summary: 'Get authenticated user and tenant profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Current authenticated user profile' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/organizations/me': {
      get: {
        summary: 'Get current tenant organization profile',
        security: [{ bearerAuth: [] }, { tenantHeader: [] }],
        responses: {
          '200': { description: 'Current tenant organization details' },
          '401': { description: 'Unauthorized' }
        }
      }
    },
    '/users': {
      get: {
        summary: 'List users in tenant organization',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of users' }
        }
      }
    },
    '/data-sources': {
      get: {
        summary: 'List data sources for organization with pagination, sort, and filters',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25 } },
          { name: 'sort', in: 'query', schema: { type: 'string', example: 'createdAt:desc' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'filter[type]', in: 'query', schema: { type: 'string' } },
          { name: 'filter[status]', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'List of data sources with redacted credentials' }
        }
      },
      post: {
        summary: 'Create and encrypt data source',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateDataSourceRequest' }
            }
          }
        },
        responses: {
          '201': { description: 'Data source created with encrypted credentials' },
          '400': { description: 'Validation error' },
          '409': { description: 'Duplicate data source name' }
        }
      }
    },
    '/data-sources/{id}': {
      get: {
        summary: 'Get data source by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Data source details with safe metadata' },
          '404': { description: 'Data source not found' }
        }
      },
      patch: {
        summary: 'Update data source configuration and metadata',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateDataSourceRequest' }
            }
          }
        },
        responses: {
          '200': { description: 'Data source updated' },
          '404': { description: 'Data source not found' }
        }
      },
      delete: {
        summary: 'Deactivate data source (soft deletion with dependency protection)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Data source deactivated successfully' },
          '404': { description: 'Data source not found' },
          '409': { description: 'Cannot delete: dependent catalog datasets exist' }
        }
      }
    },
    '/data-sources/{id}/test': {
      post: {
        summary: 'Execute safe connection credential verification diagnostic',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Connection diagnostic succeeded' },
          '400': { description: 'Missing credentials' },
          '404': { description: 'Data source not found' }
        }
      }
    },
    '/data-sources/{id}/discover': {
      post: {
        summary: 'Discover schemas, tables, and columns using connector',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Discovered catalog metadata' },
          '404': { description: 'Data source not found' },
          '501': { description: 'Connector does not support metadata discovery' }
        }
      }
    },
    '/data-sources/{id}/sync': {
      post: {
        summary: 'Synchronize live data source metadata and detect schema drift',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Catalog synchronization completed' },
          '404': { description: 'Data source not found' },
          '429': { description: 'Sync already in progress' }
        }
      }
    },
    '/data-sources/{id}/rotate-key': {
      post: {
        summary: 'Rotate encryption key version for stored credentials',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Credentials successfully rotated to new key version' },
          '404': { description: 'Data source not found' }
        }
      }
    },
    '/datasets': {
      get: {
        summary: 'List datasets with pagination and filtering',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Paginated list of datasets' }
        }
      },
      post: {
        summary: 'Create new dataset catalog entry',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Dataset created successfully' }
        }
      }
    },
    '/datasets/{id}': {
      get: {
        summary: 'Get dataset by ID',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Dataset details' },
          '404': { description: 'Dataset not found' }
        }
      },
      patch: {
        summary: 'Update dataset metadata',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Dataset updated successfully' },
          '404': { description: 'Dataset not found' }
        }
      },
      delete: {
        summary: 'Deactivate dataset catalog entry',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Dataset deactivated successfully' },
          '404': { description: 'Dataset not found' }
        }
      }
    },
    '/search': {
      get: {
        summary: 'Unified search across data sources and datasets',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'query', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } }
        ],
        responses: {
          '200': { description: 'Search results' }
        }
      }
    },
    '/dashboard/summary': {
      get: {
        summary: 'Get real-time dashboard summary metrics',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Aggregated dashboard summary' }
        }
      }
    },
    '/dashboard/data-sources': {
      get: {
        summary: 'Get data source health and connection metrics',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Aggregated data source metrics' }
        }
      }
    },
    '/dashboard/quality': {
      get: {
        summary: 'Get data quality metrics and issue rollups',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Quality metrics' }
        }
      }
    },
    '/dashboard/alerts': {
      get: {
        summary: 'Get active alerts and incidents',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'List of alerts' }
        }
      }
    },
    '/dashboard/activity': {
      get: {
        summary: 'Get recent audit and platform activity',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Recent audit activity' }
        }
      }
    },
    '/quality/datasets/{datasetId}': {
      get: {
        summary: 'Get latest data quality metrics and score for a dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'datasetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Dataset quality summary' } }
      }
    },
    '/quality/datasets/{datasetId}/history': {
      get: {
        summary: 'Get historical quality score snapshots for a dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'datasetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Historical quality snapshots' } }
      }
    },
    '/quality/datasets/{datasetId}/run': {
      post: {
        summary: 'Execute quality rule evaluation against connector source',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'datasetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Quality execution results' } }
      }
    },
    '/quality/runs/{id}': {
      get: {
        summary: 'Get detailed quality run execution record by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Quality run detail' } }
      }
    },
    '/quality/datasets/{datasetId}/rules': {
      get: {
        summary: 'List active quality rules for a dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'datasetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'List of quality rules' } }
      },
      post: {
        summary: 'Create a new quality rule on a dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'datasetId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '201': { description: 'Rule created' } }
      }
    },
    '/quality/rules/{id}': {
      get: {
        summary: 'Get quality rule by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Rule details' } }
      },
      patch: {
        summary: 'Update quality rule',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Rule updated' } }
      },
      delete: {
        summary: 'Delete quality rule',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Rule deleted' } }
      }
    },
    '/quality/issues': {
      get: {
        summary: 'Query quality issues with filtering and pagination',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of quality issues' } }
      }
    },
    '/quality/issues/{id}': {
      get: {
        summary: 'Get quality issue by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Issue details' } }
      },
      patch: {
        summary: 'Update issue remediation status, root cause, or resolution',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Issue updated' } }
      }
    },
    '/datasets/{id}/profile': {
      post: {
        summary: 'Trigger statistical profiling against live connector data source',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Profile results' } }
      },
      get: {
        summary: 'Get latest stored statistical profile for dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Latest dataset profile' } }
      }
    },
    '/datasets/{id}/profile/history': {
      get: {
        summary: 'Get historical profiling runs for dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Historical profiles' } }
      }
    },
    '/datasets/{id}/lineage': {
      get: {
        summary: 'Get bidirectional lineage graph for dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Lineage graph' } }
      }
    },
    '/lineage/upstream/{id}': {
      get: {
        summary: 'Get upstream dependency graph for dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Upstream lineage graph' } }
      }
    },
    '/lineage/downstream/{id}': {
      get: {
        summary: 'Get downstream consumer graph for dataset',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Downstream lineage graph' } }
      }
    },
    '/lineage': {
      post: {
        summary: 'Create a normalized lineage edge between datasets and columns',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Lineage edge created' } }
      }
    },
    '/glossary/terms': {
      get: {
        summary: 'Search and filter business glossary terms',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of glossary terms' } }
      },
      post: {
        summary: 'Create a new business glossary term',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Glossary term created' } }
      }
    },
    '/glossary/terms/{id}': {
      get: {
        summary: 'Get glossary term by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Glossary term details' } }
      },
      patch: {
        summary: 'Update glossary term definition or metadata',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Glossary term updated' } }
      },
      delete: {
        summary: 'Delete glossary term',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Glossary term deleted' } }
      }
    },
    '/glossary/terms/{id}/link': {
      post: {
        summary: 'Link glossary term to a dataset or specific column',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Link added' } }
      },
      delete: {
        summary: 'Remove dataset or column link from glossary term',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Link removed' } }
      }
    },
    '/governance/classification': {
      post: {
        summary: 'Update classification level (PII/PHI/SENSITIVE/PUBLIC) on dataset or column',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Classification updated' } }
      }
    },
    '/governance/masking-policies': {
      get: {
        summary: 'List tenant masking policies',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of masking policies' } }
      },
      post: {
        summary: 'Create a column masking policy (REDACT, PARTIAL, HASH, TOKENIZED)',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Masking policy created' } }
      }
    },
    '/governance/compliance-report': {
      get: {
        summary: 'Generate governance and compliance audit report with real metrics',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Compliance audit report' } }
      }
    },
    '/audit-logs': {
      get: {
        summary: 'Query immutable tenant audit logs with filtering and pagination',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Paginated audit log records' } }
      }
    },
    '/jobs': {
      get: {
        summary: 'Query background jobs with filtering and pagination',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'List of jobs' } }
      }
    },
    '/jobs/{id}': {
      get: {
        summary: 'Get background job status and details by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Job detail' } }
      }
    },
    '/jobs/enqueue': {
      post: {
        summary: 'Enqueues asynchronous job (catalog_sync, data_profiling, quality_scan)',
        security: [{ bearerAuth: [] }],
        responses: { '202': { description: 'Job enqueued' } }
      }
    },
    '/jobs/{id}/cancel': {
      post: {
        summary: 'Cancel a queued background job',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Job cancelled' } }
      }
    },
    '/jobs/queue/metrics': {
      get: {
        summary: 'Get internal background queue depth and worker metrics',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Queue metrics' } }
      }
    },
    '/jobs/schedules': {
      get: {
        summary: 'List recurring job schedules for tenant',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Active schedules' } }
      },
      post: {
        summary: 'Register a recurring job schedule',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Schedule registered' } }
      }
    }
  }
};

export default swaggerSpec;
