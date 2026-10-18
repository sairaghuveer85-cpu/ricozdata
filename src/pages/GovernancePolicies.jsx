import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import Button from '../components/common/Button';
import PolicyTabs from '../components/governance/PolicyTabs';
import PolicyTable from '../components/governance/PolicyTable';
import GovernanceRulesTab from '../components/governance/GovernanceRulesTab';
import AccessControlTab from '../components/governance/AccessControlTab';
import ComplianceTab from '../components/governance/ComplianceTab';
import PolicyModal from '../components/governance/PolicyModal';
import PermissionGate from '../components/auth/PermissionGate';
import { PERMISSIONS } from '../constants/rbac';
import { useApp } from '../context/AppContext';

export default function GovernancePolicies() {
  const { policies, addPolicy, togglePolicyStatus } = useApp();
  const [activeTab, setActiveTab] = useState('policies');
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="ui-governance-page space-y-5 pb-8 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="ui-page-header__title">
            Governance & Compliance Architecture
          </h1>
          <p className="ui-page-header__subtitle">
            Define organizational data protection requirements, declarative evaluation rules, resource authorization, and regulatory compliance.
          </p>
        </div>

        <div className="flex w-full shrink-0 items-center gap-3 self-start sm:w-auto sm:self-auto">
          <PermissionGate permission={PERMISSIONS.POLICY_CREATE}>
            <Button
              size="md"
              icon={Plus}
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto"
            >
              Create Policy
            </Button>
          </PermissionGate>
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
        <GovernanceRulesTab />
      )}

      {activeTab === 'access' && (
        <AccessControlTab />
      )}

      {activeTab === 'compliance' && (
        <ComplianceTab />
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
