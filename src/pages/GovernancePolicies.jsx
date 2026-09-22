import React, { useState } from 'react';
import { Plus, ShieldCheck, TrendingUp } from 'lucide-react';
import Button from '../components/common/Button';
import PolicyTabs from '../components/governance/PolicyTabs';
import PolicyTable from '../components/governance/PolicyTable';
import RulesTable from '../components/governance/RulesTable';
import PolicyModal from '../components/governance/PolicyModal';
import { useApp } from '../context/AppContext';

export default function GovernancePolicies() {
  const { policies, addPolicy, togglePolicyStatus } = useApp();
  const [activeTab, setActiveTab] = useState('policies');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="space-y-6 pb-8">
      {/* Header matching Screen 8 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Governance & Policies
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Define compliance boundaries, enforce role permissions, and automate continuous auditing.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <Button
            size="md"
            icon={Plus}
            onClick={() => setIsModalOpen(true)}
          >
            Create Policy
          </Button>
        </div>
      </div>

      {/* Tabs matching Screen 8: Policies, Rules, Access Control, Compliance */}
      <PolicyTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Tab Panels */}
      {activeTab === 'policies' && (
        <PolicyTable
          policies={policies}
          onToggleStatus={togglePolicyStatus}
        />
      )}

      {activeTab === 'rules' && (
        <RulesTable activeSubTab="rules" />
      )}

      {activeTab === 'access' && (
        <RulesTable activeSubTab="access" />
      )}

      {activeTab === 'compliance' && (
        <RulesTable activeSubTab="compliance" />
      )}

      {/* Create Policy Modal */}
      <PolicyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={addPolicy}
      />
    </div>
  );
}
