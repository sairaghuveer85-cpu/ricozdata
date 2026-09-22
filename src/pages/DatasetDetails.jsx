import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DatasetHeader from '../components/dataset/DatasetHeader';
import DatasetTabs from '../components/dataset/DatasetTabs';
import DatasetOverview from '../components/dataset/DatasetOverview';
import DatasetSchema from '../components/dataset/DatasetSchema';
import DatasetQuality from '../components/dataset/DatasetQuality';
import DatasetLineage from '../components/dataset/DatasetLineage';
import DatasetActivity from '../components/dataset/DatasetActivity';
import PolicyTable from '../components/governance/PolicyTable';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';

export default function DatasetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { datasets, policies, updateDataset, deleteDataset } = useApp();

  const [activeTab, setActiveTab] = useState('overview');
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [sqlQuery, setSqlQuery] = useState(`SELECT \n  customer_id, email, first_name, last_name, tier\nFROM \n  SNOWFLAKE_PROD.MARKETING.CUSTOMER_DATABASE \nWHERE \n  churn_risk_score > 0.75 \nLIMIT 50;`);
  const [queryResult, setQueryResult] = useState(null);

  // Find dataset
  const dataset = datasets.find(d => d.id === id) || datasets[0] || {
    id: 'customer-database',
    name: 'Customer Database',
    domain: 'Marketing',
    owner: 'Priya S.',
    source: 'Snowflake',
    quality: 98,
    status: 'Certified',
    rows: '12.4M',
    columnsCount: 48,
    sensitivity: 'PII',
    usage: '1.4k views',
    description: 'Contains customer information including demographics, purchase history, and support tickets.',
    tags: ['customer', 'marketing', 'pii', 'sales', 'production']
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete dataset "${dataset.name}"?`)) {
      deleteDataset(dataset.id);
      navigate('/catalog');
    }
  };

  const handleExecuteQuery = () => {
    setQueryResult([
      { customer_id: 'CUST-98214', email: 'elena.rostova@example.com', first_name: 'Elena', last_name: 'Rostova', tier: 'Platinum' },
      { customer_id: 'CUST-98215', email: 'marcus.vance@example.com', first_name: 'Marcus', last_name: 'Vance', tier: 'Gold' },
      { customer_id: 'CUST-98216', email: 'david.choi@example.com', first_name: 'David', last_name: 'Choi', tier: 'Silver' }
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Header matching Screen 4 */}
      <DatasetHeader
        dataset={dataset}
        onOpenQuery={() => setIsQueryModalOpen(true)}
        onDelete={handleDelete}
      />

      {/* Tabs */}
      <DatasetTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Content Panels */}
      {activeTab === 'overview' && (
        <DatasetOverview
          dataset={dataset}
          onUpdateTags={(tags) => updateDataset(dataset.id, { tags })}
        />
      )}

      {activeTab === 'schema' && (
        <DatasetSchema schema={dataset.schema || []} />
      )}

      {activeTab === 'quality' && (
        <DatasetQuality dataset={dataset} />
      )}

      {activeTab === 'lineage' && (
        <DatasetLineage dataset={dataset} />
      )}

      {activeTab === 'policies' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Enforced Governance Policies
            </h3>
            <span className="text-xs text-slate-500">3 active policies applied</span>
          </div>
          <PolicyTable
            policies={policies.filter(p => p.appliesTo === 'Customer Data' || p.appliesTo === 'All Datasets')}
          />
        </div>
      )}

      {activeTab === 'activity' && (
        <DatasetActivity dataset={dataset} />
      )}

      {/* SQL Query Modal */}
      <Modal
        isOpen={isQueryModalOpen}
        onClose={() => {
          setIsQueryModalOpen(false);
          setQueryResult(null);
        }}
        title={`Interactive SQL Studio — ${dataset.name}`}
        subtitle={`Execute read-only queries against ${dataset.source} production replica`}
        maxWidth="max-w-3xl"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsQueryModalOpen(false)}>
              Close
            </Button>
            <Button size="sm" onClick={handleExecuteQuery}>
              Run SQL Query
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-900 rounded-lg p-3 text-white font-mono text-xs shadow-inner">
            <textarea
              rows={5}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full bg-transparent border-0 text-emerald-400 font-mono text-xs focus:outline-none resize-none"
            />
          </div>

          {queryResult && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 text-[11px] font-semibold text-slate-600 flex justify-between">
                <span>Query Result (3 rows returned in 12ms)</span>
                <span className="text-emerald-600 font-bold">✓ Success</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-2">customer_id</th>
                      <th className="p-2">email</th>
                      <th className="p-2">first_name</th>
                      <th className="p-2">last_name</th>
                      <th className="p-2">tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queryResult.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="p-2 font-mono">{row.customer_id}</td>
                        <td className="p-2 font-mono text-slate-600">{row.email}</td>
                        <td className="p-2">{row.first_name}</td>
                        <td className="p-2">{row.last_name}</td>
                        <td className="p-2 font-semibold text-blue-600">{row.tier}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
