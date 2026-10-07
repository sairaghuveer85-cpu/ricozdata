import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import AccessDenied from './AccessDenied';

/**
 * ProtectedRoute component for RicozData.
 * Ensures that unauthenticated users cannot view application routes,
 * and authorized users have required granular permissions for protected pages.
 *
 * @param {object} props
 * @param {string} [props.permission] - Optional permission required to access the route
 * @param {React.ReactNode} [props.children] - Child components to render
 */
export default function ProtectedRoute({ permission, children }) {
  const { isAuthenticated, currentUser, hasPermission } = useApp();

  const isAuth = isAuthenticated && localStorage.getItem('ricoz-authenticated') === 'true';

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  if (permission && !hasPermission(permission)) {
    return <AccessDenied permission={permission} role={currentUser?.role || 'VIEWER'} />;
  }

  return children ? children : <Outlet />;
}
