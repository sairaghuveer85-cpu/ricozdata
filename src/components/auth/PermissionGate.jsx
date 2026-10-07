import React from 'react';
import { useApp } from '../../context/AppContext';

/**
 * PermissionGate - Declarative component for RBAC-protected UI elements.
 * Renders children only if the current user has the required permission.
 * Optionally renders a fallback when the user lacks the permission.
 *
 * Usage:
 *   <PermissionGate permission="DATASET_CREATE">
 *     <Button onClick={handleAdd}>Add Dataset</Button>
 *   </PermissionGate>
 *   <PermissionGate permission="USER_CREATE" fallback={<p>Add user disabled</p>}>
 *     <UserCreateButton />
 *   </PermissionGate>
 */
export default function PermissionGate({ permission, fallback = null, children }) {
  const { hasPermission } = useApp();

  const isAllowed = hasPermission(permission);

  if (isAllowed) {
    return <>{children}</>;
  }

  return fallback;
}

/**
 * Helper hook to check permissions from useApp
 */
export function usePermission(permission) {
  const { hasPermission } = useApp();
  return hasPermission(permission);
}

/**
 * Higher-order component version for wrapping components with permission checks
 */
export function withPermission(permission, FallbackComponent = null) {
  return function(WrappedComponent) {
    return function PermissionProtectedComponent(props) {
      const { hasPermission } = useApp();
      if (hasPermission(permission)) {
        return <WrappedComponent {...props} />;
      }
      return FallbackComponent ? <FallbackComponent {...props} /> : null;
    };
  };
}

PermissionGate.displayName = 'PermissionGate';
