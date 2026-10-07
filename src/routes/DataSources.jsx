import React, { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import { PERMISSIONS } from '../constants/rbac';
import Skeleton from '../components/common/Skeleton';

// Lazy-loaded Data Sources management page for route-level code splitting.
const DataSourceList = lazy(() => import('../components/datasource/DataSourceList'));

const DataSourceListFallback = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="text-center space-y-4">
      <Skeleton className="h-8 w-48 mx-auto" />
      <Skeleton className="h-4 w-64 mx-auto" />
      <Skeleton className="h-4 w-32 mx-auto" />
    </div>
  </div>
);

export default function DataSourcesRoutes() {
  return (
    <Route
      path="/datasources"
      element={
        <ProtectedRoute permission={PERMISSIONS.DATA_SOURCE_MANAGE}>
          <Suspense fallback={<DataSourceListFallback />}>
            <DataSourceList />
          </Suspense>
        </ProtectedRoute>
      }
    />
  );
}