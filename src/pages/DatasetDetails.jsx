import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DatasetHeader from '../components/dataset/DatasetHeader';
import DatasetTabs from '../components/dataset/DatasetTabs';
import DatasetOverview from '../components/dataset/DatasetOverview';
import DatasetSchema from '../components/dataset/DatasetSchema';
import DatasetQuality from '../components/dataset/DatasetQuality';
import DatasetLineage from '../components/dataset/DatasetLineage';
import DatasetActivity from '../components/dataset/DatasetActivity';
import PolicyTable from '../components/governance/PolicyTable';
import DatasetQueryStudio from '../components/dataset/DatasetQueryStudio';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import { useApp } from '../context/AppContext';
import datasetApi from '../services/datasetApi';

export default function DatasetDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { policies, updateDataset, deleteDataset } = useApp();

  const [activeTab, setActiveTab] = useState('overview');
  const [isQueryModalOpen, setIsQueryModalOpen] = useState(false);

  const [dataset, setDataset] = useState(null);
  const [relatedDatasets, setRelatedDatasets] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDatasetDetails = async () => {
    try {
      setLoading(true);
      const res = await datasetApi.getDatasetById(id);
      const ds = res?.data?.data || res?.data || res;
      setDataset(ds && typeof ds === 'object' && ds.name ? ds : null);
      setRelatedDatasets(res?.related || res?.data?.related || ds?.relatedDatasets || []);
      setActivity(res?.activity || res?.data?.activity || ds?.activity || []);
    } catch (error) {
      console.error('Failed to fetch dataset details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchDatasetDetails();
    }
  }, [id]);

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete dataset "${dataset?.name}"?`)) {
      deleteDataset(dataset._id || dataset.id);
      navigate('/catalog');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-sm text-slate-500 dark:text-slate-400">Loading dataset details...</span>
      </div>
    );
  }

  if (!dataset) {
    return (
      <div className="text-center py-20">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Dataset Not Found</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">The requested dataset could not be retrieved from the catalog.</p>
        <Button size="sm" className="mt-4" onClick={() => navigate('/catalog')}>
          Return to Catalog
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
        <div className="space-y-6">
          <DatasetOverview
            dataset={dataset}
            onUpdateTags={(tags) => updateDataset(dataset._id || dataset.id, { tags })}
          />

          {/* Related Datasets Section */}
          {relatedDatasets.length > 0 && (
            <div className="theme-card rounded-lg border border-slate-200 dark:border-[#1D3047] p-4 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Related Datasets ({relatedDatasets.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {relatedDatasets.map((rel) => (
                  <div
                    key={rel._id}
                    onClick={() => navigate(`/catalog/${rel._id}`)}
                    className="p-3 rounded border border-slate-100 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-600 cursor-pointer bg-slate-50/50 dark:bg-[#0E1B2E]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {rel.name}
                      </span>
                      <span className="text-[10px] text-slate-400">{rel.domain}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1">
                      {rel.description}
                    </p>
                    {rel.relationshipReasons && rel.relationshipReasons.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {rel.relationshipReasons.map((reason, rIdx) => (
                          <span
                            key={rIdx}
                            className="text-[9px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-900/40"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'schema' && (
        <DatasetSchema
          schema={dataset.schema || []}
          dataset={dataset}
          datasetId={dataset._id || dataset.id}
          onUpdateSuccess={fetchDatasetDetails}
        />
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
              {policies.length} policies applied
            </span>
          </div>
          <PolicyTable policies={policies} />
        </div>
      )}

      {activeTab === 'activity' && (
        <DatasetActivity dataset={dataset} activities={activity} />
      )}

      {activeTab === 'query' && (
        <DatasetQueryStudio dataset={dataset} />
      )}

      {/* SQL Query Modal */}
      <Modal
        isOpen={isQueryModalOpen}
        onClose={() => setIsQueryModalOpen(false)}
        title={`Interactive SQL Studio — ${dataset.name}`}
        subtitle={`Execute read-only queries against ${dataset.source || 'configured'} data source`}
        maxWidth="max-w-4xl"
        footer={
          <Button variant="secondary" size="sm" onClick={() => setIsQueryModalOpen(false)}>
            Close
          </Button>
        }
      >
        <DatasetQueryStudio dataset={dataset} />
      </Modal>
    </div>
  );
}