import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from '../common/ToastContainer';
import CommandPalette from '../common/CommandPalette';
import DatasetDrawer from '../catalog/DatasetDrawer';
import IssueDrawer from '../quality/IssueDrawer';
import GlossaryDrawer from '../glossary/GlossaryDrawer';
import PolicyDrawer from '../governance/PolicyDrawer';
import UserDrawer from '../users/UserDrawer';
import { useApp } from '../../context/AppContext';

export default function MainLayout() {
  const { activeDrawer, closeDrawer } = useApp();

  return (
    <div
      className="flex min-h-screen transition-colors w-full overflow-x-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Sidebar navigation (remains intentionally dark in both themes) */}
      <Sidebar />

      {/* Main app viewport */}
      <div className="flex-1 flex flex-col min-w-0 w-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Header />
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <Outlet />
        </main>
      </div>

      {/* Global Command Center (Cmd+K) */}
      <CommandPalette />

      {/* Global Toast System */}
      <ToastContainer />

      {/* Global Quick-View Drawers */}
      {activeDrawer?.type === 'dataset' && (
        <DatasetDrawer
          dataset={activeDrawer.data}
          isOpen={true}
          onClose={closeDrawer}
        />
      )}

      {activeDrawer?.type === 'issue' && (
        <IssueDrawer
          issue={activeDrawer.data}
          isOpen={true}
          onClose={closeDrawer}
        />
      )}

      {activeDrawer?.type === 'glossary' && (
        <GlossaryDrawer
          term={activeDrawer.data}
          isOpen={true}
          onClose={closeDrawer}
        />
      )}

      {activeDrawer?.type === 'policy' && (
        <PolicyDrawer
          policy={activeDrawer.data}
          isOpen={true}
          onClose={closeDrawer}
        />
      )}

      {activeDrawer?.type === 'user' && (
        <UserDrawer
          user={activeDrawer.data}
          isOpen={true}
          onClose={closeDrawer}
        />
      )}
    </div>
  );
}
