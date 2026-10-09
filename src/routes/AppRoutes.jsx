import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Login from '../pages/Login';
import Register from '../pages/Register';
import Dashboard from '../pages/Dashboard';
import DataCatalog from '../pages/DataCatalog';
import DatasetDetails from '../pages/DatasetDetails';
import DataLineage from '../pages/DataLineage';
import DataQuality from '../pages/DataQuality';
import BusinessGlossary from '../pages/BusinessGlossary';
import GlossarySuggestions from '../pages/GlossarySuggestions';
import GovernancePolicies from '../pages/GovernancePolicies';
import Users from '../pages/Users';
import Settings from '../pages/Settings';
import Reports from '../pages/Reports';
import DataSourceList from '../components/datasource/DataSourceList';
import { PERMISSIONS } from '../constants/rbac';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root Route: Always redirect to /login - Entry point is LOGIN */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Login Route - No sidebar, no header, no dashboard content */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected Application Routes wrapped by ProtectedRoute + MainLayout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute permission={PERMISSIONS.DASHBOARD_READ}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/datasources"
          element={
            <ProtectedRoute permission={PERMISSIONS.DATA_SOURCE_READ}>
              <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="text-center space-y-4"><div className="h-8 w-48 mx-auto animate-pulse"></div><div className="h-4 w-64 mx-auto animate-pulse"></div><div className="h-4 w-32 mx-auto animate-pulse"></div></div></div>}>
                <DataSourceList />
              </Suspense>
            </ProtectedRoute>
          }
        />
        <Route path="/sources" element={<Navigate to="/datasources" replace />} />
        <Route
          path="/catalog"
          element={
            <ProtectedRoute permission={PERMISSIONS.DATASET_READ}>
              <DataCatalog />
            </ProtectedRoute>
          }
        />
        <Route
          path="/catalog/:id"
          element={
            <ProtectedRoute permission={PERMISSIONS.DATASET_READ}>
              <DatasetDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quality"
          element={
            <ProtectedRoute permission={PERMISSIONS.QUALITY_READ}>
              <DataQuality />
            </ProtectedRoute>
          }
        />
        <Route
          path="/quality/:datasetId"
          element={
            <ProtectedRoute permission={PERMISSIONS.QUALITY_READ}>
              <DataQuality />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lineage"
          element={
            <ProtectedRoute permission={PERMISSIONS.LINEAGE_READ}>
              <DataLineage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lineage/:datasetId"
          element={
            <ProtectedRoute permission={PERMISSIONS.LINEAGE_READ}>
              <DataLineage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/glossary"
          element={
            <ProtectedRoute permission={PERMISSIONS.GLOSSARY_READ}>
              <BusinessGlossary />
            </ProtectedRoute>
          }
        />
        <Route
          path="/glossary/suggestions"
          element={
            <ProtectedRoute permission={PERMISSIONS.GLOSSARY_READ}>
              <GlossarySuggestions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/governance"
          element={
            <ProtectedRoute permission={PERMISSIONS.POLICY_READ}>
              <GovernancePolicies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute permission={PERMISSIONS.DASHBOARD_READ}>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute permission={PERMISSIONS.USER_READ}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute permission={PERMISSIONS.SETTINGS_MANAGE}>
              <Settings />
            </ProtectedRoute>
          }
        />
      </Route>

      {/* Fallback for undefined routes: redirect to /login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
