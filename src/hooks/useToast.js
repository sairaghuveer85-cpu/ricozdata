import { useApp } from '../context/AppContext';

/**
 * Custom hook for accessing the global toast notification system.
 * Provides convenience access to addToast, removeToast, and active toasts.
 */
export function useToast() {
  const { addToast, removeToast, toasts } = useApp();
  return { addToast, removeToast, toasts };
}

export default useToast;
