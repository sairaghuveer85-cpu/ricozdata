import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

/**
 * ProtectedRoute component for RicozData.
 * Ensures that unauthenticated users cannot view application routes.
 *
 * Checks both AppContext `isAuthenticated` state and `localStorage.getItem("ricoz-authenticated")`.
 * If unauthenticated, immediately redirects to `/login` without rendering protected content.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useApp();

  const isAuth = isAuthenticated && localStorage.getItem('ricoz-authenticated') === 'true';

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  return children ? children : <Outlet />;
}
