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
  const { datasets, policies, updateDataset, deleteDataset, getEnrichedDataset, getDatasetPolicies } = useApp();

  const [activeTab, setActiveTab] = useState('overview');
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);
  const [sqlQuery, setSqlQuery] = useState(`SELECT \n  customer_id, email, first_name, last_name, tier\nFROM \n  SNOWFLAKE_PROD.MARKETING.CUSTOMER_DATABASE \nWHERE \n  churn_risk_score > 0.75 \nLIMIT 50;`);
  const [queryResult, setQueryResult] = useState(null);

  // Find dataset and enrich with resolved owner and quality data
  const rawDataset = datasets.find(d => d.id === id) || datasets[0];
  const dataset = (getEnrichedDataset && rawDataset) ? (getEnrichedDataset(rawDataset.id) || rawDataset) : rawDataset;

  const datasetPolicies = getDatasetPolicies ? getDatasetPolicies(dataset?.id) : policies;

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
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Enforced Governance Policies
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {datasetPolicies.length} {datasetPolicies.length === 1 ? 'policy' : 'policies'} applied
            </span>
          </div>
          <PolicyTable
            policies={datasetPolicies}
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
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:justify-end">
            <Button variant="secondary" size="sm" onClick={() => setIsQueryModalOpen(false)} className="w-full sm:w-auto">
              Close
            </Button>
            <Button size="sm" onClick={handleExecuteQuery} className="w-full sm:w-auto">
              Run SQL Query
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-900 dark:bg-[#07111F] rounded-lg p-3 text-white font-mono text-xs shadow-inner border border-slate-800">
            <textarea
              rows={5}
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              className="w-full bg-transparent border-0 text-emerald-400 font-mono text-xs focus:outline-none resize-none"
            />
          </div>

          {queryResult && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-[#0B1628]">
              <div className="bg-slate-50 dark:bg-[#111C2E] px-3 py-1.5 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex justify-between">
                <span>Query Result (3 rows returned in 12ms)</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">✓ Success</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-[#111C2E] text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2">customer_id</th>
                      <th className="p-2">email</th>
                      <th className="p-2">first_name</th>
                      <th className="p-2">last_name</th>
                      <th className="p-2">tier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {queryResult.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2 font-mono text-slate-900 dark:text-white">{row.customer_id}</td>
                        <td className="p-2 font-mono text-slate-600 dark:text-slate-400">{row.email}</td>
                        <td className="p-2">{row.first_name}</td>
                        <td className="p-2">{row.last_name}</td>
                        <td className="p-2 font-semibold text-blue-600 dark:text-blue-400">{row.tier}</td>
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
