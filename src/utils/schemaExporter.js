/**
 * RicozData Schema Exporter Utility
 * Generates and triggers download of database-agnostic schema definitions in JSON format
 * using real metadata from the Data Catalog.
 */

/**
 * Format raw database/source type to clean human-readable name
 */
export function formatDatabaseType(sourceType) {
  if (!sourceType) return 'Unknown';
  const st = String(sourceType).toLowerCase().trim();
  if (st.includes('postgres')) return 'PostgreSQL';
  if (st.includes('mysql')) return 'MySQL';
  if (st.includes('sqlserver') || st.includes('mssql')) return 'SQL Server';
  if (st.includes('mongo')) return 'MongoDB';
  if (st.includes('snowflake')) return 'Snowflake';
  if (st.includes('oracle')) return 'Oracle';
  if (st.includes('sqlite')) return 'SQLite';
  return sourceType;
}

/**
 * Generate normalized schema definition object from dataset metadata
 */
export function buildSchemaDefinition(dataset) {
  if (!dataset) return null;

  const rawColumns = dataset.columns || dataset.schema || [];
  if (!Array.isArray(rawColumns) || rawColumns.length === 0) {
    return null;
  }

  const isMongo = String(dataset.sourceType || dataset.source || '').toLowerCase().includes('mongo');
  const databaseType = formatDatabaseType(dataset.sourceType || dataset.source);

  // Build root definition object
  const definition = {
    dataset: dataset.displayName || dataset.name || 'Unnamed Dataset',
    source: dataset.source || dataset.sourceSystem || 'Unknown Source',
    databaseType: databaseType
  };

  // Schema name (for SQL / relational databases)
  if (dataset.schemaName) {
    definition.schema = dataset.schemaName;
  } else if (!isMongo && dataset.sourceDetails?.schema) {
    definition.schema = dataset.sourceDetails.schema;
  }

  // Table or Collection name
  if (isMongo) {
    definition.collection = dataset.tableName || dataset.name;
  } else {
    definition.table = dataset.tableName || dataset.name;
  }

  // Additional reliable metadata
  if (dataset.domain) {
    definition.domain = dataset.domain;
  }
  if (dataset.environment) {
    definition.environment = dataset.environment;
  }
  if (dataset.sensitivity) {
    definition.sensitivity = dataset.sensitivity;
  }
  if (dataset.classification) {
    definition.classification = dataset.classification;
  }
  if (dataset.description) {
    definition.description = dataset.description;
  }

  // Map columns / fields
  definition.columns = rawColumns.map((col, index) => {
    const colDef = {
      name: col.name,
      dataType: col.dataType || col.type || 'unknown'
    };

    // SQL nullability (relational databases only)
    if (typeof col.nullable === 'boolean' && !isMongo) {
      colDef.nullable = col.nullable;
    }

    // Primary key
    if (col.primaryKey || col.isPrimaryKey) {
      colDef.primaryKey = true;
    }

    // Foreign key relationship
    if (col.foreignKey) {
      colDef.foreignKey = col.foreignKey;
    }

    // Default value if defined
    if (col.defaultValue !== undefined && col.defaultValue !== null) {
      colDef.defaultValue = col.defaultValue;
    } else if (col.default !== undefined && col.default !== null) {
      colDef.defaultValue = col.default;
    }

    // Ordinal position
    if (typeof col.ordinalPosition === 'number') {
      colDef.ordinalPosition = col.ordinalPosition;
    }

    // Column description
    if (col.description && typeof col.description === 'string' && col.description.trim()) {
      colDef.description = col.description.trim();
    }

    // Business meaning
    if (col.businessMeaning && typeof col.businessMeaning === 'string' && col.businessMeaning.trim()) {
      colDef.businessMeaning = col.businessMeaning.trim();
    }

    // Sensitivity
    if (col.sensitivity && typeof col.sensitivity === 'string') {
      colDef.sensitivity = col.sensitivity;
    }

    // PII classification
    if (col.pii === true || col.classification === 'pii' || col.piiClassification === 'pii') {
      colDef.pii = true;
    }

    return colDef;
  });

  return definition;
}

/**
 * Trigger browser file download with blob
 */
export function triggerJsonDownload(filename, data) {
  const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export dataset schema definition
 * Handles fetching full metadata if needed, error handling, warning toasts, and download.
 */
export async function exportDatasetSchema(dataset, { getFullDataset, addToast } = {}) {
  try {
    let fullDataset = dataset;

    // Check if columns are already populated
    const hasColumns = Array.isArray(fullDataset?.columns) && fullDataset.columns.length > 0;
    const hasSchema = Array.isArray(fullDataset?.schema) && fullDataset.schema.length > 0;

    // If not populated and fetch function is available, retrieve full dataset
    if ((!hasColumns && !hasSchema) && getFullDataset && (dataset?._id || dataset?.id)) {
      try {
        const res = await getFullDataset(dataset._id || dataset.id);
        const dsData = res?.data?.data || res?.data || res;
        if (dsData && typeof dsData === 'object') {
          fullDataset = dsData;
        }
      } catch (err) {
        console.error('Failed to fetch full dataset for schema export:', err);
      }
    }

    const schemaDefinition = buildSchemaDefinition(fullDataset);

    if (!schemaDefinition || !schemaDefinition.columns || schemaDefinition.columns.length === 0) {
      if (addToast) {
        addToast({
          title: 'Schema Unavailable',
          message: 'Schema metadata is unavailable. Synchronize the dataset before exporting its schema definition.',
          type: 'warning'
        });
      }
      return false;
    }

    // Generate filename e.g. Dq_Quality_Test_schema.json
    const rawName = fullDataset.name || fullDataset.displayName || 'dataset';
    const sanitizedName = rawName.trim().replace(/[^a-zA-Z0-9_-]+/g, '_');
    const filename = `${sanitizedName}_schema.json`;

    triggerJsonDownload(filename, schemaDefinition);

    if (addToast) {
      addToast({
        title: 'Schema Exported',
        message: `Schema definition downloaded as ${filename}`,
        type: 'success'
      });
    }

    return true;
  } catch (error) {
    console.error('Export schema definition failed:', error);
    if (addToast) {
      addToast({
        title: 'Export Failed',
        message: error.message || 'An unexpected error occurred while exporting schema definition.',
        type: 'error'
      });
    }
    return false;
  }
}
