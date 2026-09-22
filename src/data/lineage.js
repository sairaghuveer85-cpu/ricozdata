export const INITIAL_LINEAGE_NODES = [
  {
    id: 'source-salesforce',
    type: 'customLineageNode',
    position: { x: 40, y: 180 },
    data: {
      label: 'CRM (Salesforce)',
      category: 'Source',
      categoryType: 'source',
      typeLabel: 'Cloud CRM',
      system: 'Salesforce Enterprise Cloud',
      owner: 'Rohan P. (Sales Ops)',
      source: 'Salesforce API (OAuth2)',
      updated: '10 mins ago',
      rows: '14.2M rows',
      quality: '96%',
      dependencies: ['None (Ingestion Origin)'],
      consumers: ['ETL Pipeline (Daily Airflow DAG)'],
      status: 'Active'
    }
  },
  {
    id: 'transform-etl',
    type: 'customLineageNode',
    position: { x: 310, y: 180 },
    data: {
      label: 'ETL Pipeline',
      category: 'Transformation',
      categoryType: 'transformation',
      typeLabel: 'dbt Core + Airflow',
      system: 'Airflow Ingestion Cluster',
      owner: 'Arjun K. (Data Platform)',
      source: 'dbt Core Models v1.8',
      updated: '25 mins ago',
      rows: '13.8M processed',
      quality: '99%',
      dependencies: ['CRM (Salesforce)'],
      consumers: ['Customer Database (Snowflake)'],
      status: 'Healthy'
    }
  },
  {
    id: 'dataset-customer',
    type: 'customLineageNode',
    position: { x: 580, y: 170 },
    data: {
      label: 'Customer Database',
      category: 'Dataset',
      categoryType: 'dataset',
      typeLabel: 'Snowflake Gold Mart',
      system: 'Snowflake Enterprise (US-East)',
      owner: 'Priya S. (Lead Data Steward)',
      source: 'SNOWFLAKE_PROD.MARKETING.CUSTOMER_DB',
      updated: '2 hours ago',
      rows: '12.4M rows',
      quality: '98%',
      dependencies: ['ETL Pipeline (dbt Core)'],
      consumers: [
        'Marketing Dashboard (Tableau)',
        'Customer Segmentation (Snowflake)',
        'ML Model (Churn Predictor v2)'
      ],
      isPrimary: true,
      status: 'Certified'
    }
  },
  {
    id: 'dest-marketing',
    type: 'customLineageNode',
    position: { x: 880, y: 30 },
    data: {
      label: 'Marketing Dashboard',
      category: 'Destination',
      categoryType: 'destination',
      typeLabel: 'Executive BI Report',
      system: 'Tableau Server v2026.2',
      owner: 'Neha R. (Marketing Lead)',
      source: 'Live Connector to Snowflake',
      updated: '1 hour ago',
      rows: 'Aggregated Views (12.4M base)',
      quality: '99%',
      dependencies: ['Customer Database'],
      consumers: ['Executive Leadership & Marketing Team'],
      status: 'Active'
    }
  },
  {
    id: 'dest-segmentation',
    type: 'customLineageNode',
    position: { x: 880, y: 170 },
    data: {
      label: 'Customer Segmentation',
      category: 'Destination',
      categoryType: 'destination',
      typeLabel: 'Analytics Cohort Mart',
      system: 'Snowflake Analytics Schema',
      owner: 'Vikram M. (Growth Analyst)',
      source: 'Scheduled SQL View',
      updated: '3 hours ago',
      rows: '2.1M Active Segments',
      quality: '97%',
      dependencies: ['Customer Database'],
      consumers: ['Braze Campaign Sync, Retention Teams'],
      status: 'Active'
    }
  },
  {
    id: 'dest-ml-model',
    type: 'customLineageNode',
    position: { x: 880, y: 310 },
    data: {
      label: 'ML Model',
      category: 'Destination',
      categoryType: 'destination',
      typeLabel: 'Predictive Feature Store',
      system: 'Vertex AI / SageMaker Feature Store',
      owner: 'Kiran T. (ML Engineer)',
      source: 'Feature Mart Pipeline',
      updated: '4 hours ago',
      rows: '12.4M embeddings',
      quality: '98%',
      dependencies: ['Customer Database'],
      consumers: ['Automated Churn Early Warning Alerting'],
      status: 'In Production'
    }
  }
];

export const INITIAL_LINEAGE_EDGES = [
  {
    id: 'e-source-transform',
    source: 'source-salesforce',
    target: 'transform-etl',
    animated: true,
    style: { stroke: '#10b981', strokeWidth: 2.5 }
  },
  {
    id: 'e-transform-dataset',
    source: 'transform-etl',
    target: 'dataset-customer',
    animated: true,
    style: { stroke: '#f59e0b', strokeWidth: 2.5 }
  },
  {
    id: 'e-dataset-marketing',
    source: 'dataset-customer',
    target: 'dest-marketing',
    animated: true,
    style: { stroke: '#2563eb', strokeWidth: 2.5 }
  },
  {
    id: 'e-dataset-segmentation',
    source: 'dataset-customer',
    target: 'dest-segmentation',
    animated: true,
    style: { stroke: '#2563eb', strokeWidth: 2.5 }
  },
  {
    id: 'e-dataset-ml',
    source: 'dataset-customer',
    target: 'dest-ml-model',
    animated: true,
    style: { stroke: '#2563eb', strokeWidth: 2.5 }
  }
];
