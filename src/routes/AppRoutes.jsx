import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Login from '../pages/Login';
import Dashboard from '../pages/Dashboard';
import DataCatalog from '../pages/DataCatalog';
import DatasetDetails from '../pages/DatasetDetails';
import DataLineage from '../pages/DataLineage';
import DataQuality from '../pages/DataQuality';
import BusinessGlossary from '../pages/BusinessGlossary';
import GovernancePolicies from '../pages/GovernancePolicies';
import Users from '../pages/Users';
import Settings from '../pages/Settings';
import Reports from '../pages/Reports';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Root Route: Always redirect to /login - Entry point is LOGIN */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Login Route - No sidebar, no header, no dashboard content */}
      <Route path="/login" element={<Login />} />

      {/* Protected Application Routes wrapped by ProtectedRoute + MainLayout */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/catalog" element={<DataCatalog />} />
        <Route path="/catalog/:id" element={<DatasetDetails />} />
        <Route path="/quality" element={<DataQuality />} />
        <Route path="/quality/:datasetId" element={<DataQuality />} />
        <Route path="/lineage" element={<DataLineage />} />
        <Route path="/lineage/:datasetId" element={<DataLineage />} />
        <Route path="/glossary" element={<BusinessGlossary />} />
        <Route path="/governance" element={<GovernancePolicies />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Fallback for undefined routes: redirect to /login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
