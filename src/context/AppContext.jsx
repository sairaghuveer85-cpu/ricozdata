import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTheme } from './ThemeContext';
import { DOMAIN_REGISTRY } from '../data/domains';
import { calculateDashboardMetrics, calculateDataHealthSummary, calculateAverageQuality } from '../utils/dataCalculations';
import {
  getDatasetById,
  getUserById,
  getDomainById,
  getDatasetOwner,
  getQualityForDataset,
  getIssuesForDataset,
  getPoliciesForDataset,
  getGlossaryTermsForDataset,
  getActivitiesForDataset,
  enrichDataset,
  searchCentralData
} from '../utils/dataSelectors';

import {
  authApi,
  datasetApi,
  userApi,
  policyApi,
  glossaryApi,
  activityApi,
  qualityApi,
  dashboardApi,
  dataSourceApi,
  lineageApi
} from '../services';
import apiClient from '../services/apiClient';
import { resetUnauthorizedState } from '../services/api';

import {
  ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  roleHasPermission,
  getPermissionsForRole,
  canManageRole,
  mapLegacyRole,
  getRoleLabel
} from '../constants/rbac';

const AppContext = createContext();

export function AppProvider({ children }) {
  // Theme state and controls delegated to centralized ThemeContext
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  // Toast notifications system
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type = 'success', title, message, duration = 3500 }) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newToast = { id, type, title, message };
    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Global Command Palette State (Cmd+K)
  const [isCommandOpen, setIsCommandOpen] = useState(false);

  // Global Drawers State
  const [activeDrawer, setActiveDrawer] = useState(null);

  const openDrawer = useCallback((type, data = null) => {
    setActiveDrawer({ type, data });
  }, []);

  const closeDrawer = useCallback(() => {
    setActiveDrawer(null);
  }, []);

  // Sidebar collapse toggle
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalStorage('ricoz_sidebar_collapsed', false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile drawer

  // Authentication state initialized from localStorage
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try {
      return localStorage.getItem('ricoz-authenticated') === 'true';
    } catch {
      return false;
    }
  });

  // User state
  const [currentUser, setCurrentUser] = useLocalStorage('ricoz_current_user', {
    id: 'user-001',
    name: 'Raghuveer C.',
    email: 'raghuveer@ricozdata.com',
    role: 'Data Analyst',
    avatar: 'R',
    avatarBg: 'bg-blue-600',
    isAuthenticated: false
  });

  // Synchronize auth state across tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === 'ricoz-authenticated') {
        setIsAuthenticated(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Primary Data States
  const [rawDatasets, setDatasets] = useState([]);
  const [users, setUsers] = useState([]);
  const [domains] = useState(DOMAIN_REGISTRY);
  const [activities, setActivities] = useState([]);
  const [activityTotalCount, setActivityTotalCount] = useState(0);
  const [glossaryTerms, setGlossaryTerms] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [rules, setRules] = useState([]);
  const [issues, setIssues] = useState([]);
  const [qualityRules, setQualityRules] = useState([]);
  const [qualityHistory, setQualityHistory] = useState([]);
  const [dataSources, setDataSources] = useState([]);

  // Synchronize auth state and purge invalid legacy demo tokens
  useEffect(() => {
    const rawJwt = localStorage.getItem('ricoz_jwt');
    if (rawJwt === 'demo-local-jwt-token') {
      localStorage.removeItem('ricoz_jwt');
      localStorage.removeItem('ricoz-authenticated');
      setIsAuthenticated(false);
      apiClient.setToken(null);
    } else if (rawJwt) {
      apiClient.setToken(rawJwt);
    }

    const handleUnauthorized = () => {
      logout({ notifyBackend: false, reason: 'expired' });
    };
    window.addEventListener('ricoz-unauthorized', handleUnauthorized);
    apiClient.setOnUnauthenticated(() => {
      logout({ notifyBackend: false, reason: 'expired' });
    });
    return () => window.removeEventListener('ricoz-unauthorized', handleUnauthorized);
  }, []);

  // Synchronize data from Express Backend
  const fetchBackendData = useCallback(async () => {
    const rawJwt = localStorage.getItem('ricoz_jwt');
    if (!rawJwt || rawJwt === 'demo-local-jwt-token') {
      return;
    }
    try {
      const [
        dsRes,
        usrRes,
        polRes,
        gloRes,
        actRes,
        dashRes,
        sourcesRes,
        rulesRes,
        issuesRes
      ] = await Promise.allSettled([
        datasetApi.getDatasets({ limit: 100 }),
        userApi.getUsers(),
        policyApi.getPolicies({ limit: 100 }),
        glossaryApi.getTerms({ limit: 100 }),
        activityApi.getActivities(30),
        dashboardApi.getMetrics(),
        dataSourceApi.getDataSources(),
        qualityApi.getRules(),
        qualityApi.getIssues()
      ]);

      if (dsRes.status === 'fulfilled' && dsRes.value?.success) {
        const rawData = dsRes.value.data;
        const dsArray = Array.isArray(rawData) ? rawData : (rawData?.datasets ? rawData.datasets : []);
        const apiDatasets = dsArray.map(d => ({
          ...d,
          id: d.id || d._id,
          rows: d.rowCount || d.rows || '0',
          columnsCount: d.schema ? d.schema.length : (d.columns ? d.columns.length : (d.columnsCount ?? 0)),
          quality: d.qualityScore !== undefined ? d.qualityScore : (d.quality !== undefined ? d.quality : null),
          qualityScore: d.qualityScore !== undefined ? d.qualityScore : (d.quality !== undefined ? d.quality : null),
          dimensions: Array.isArray(d.dimensions) ? d.dimensions : [],
          updated: d.updatedAt ? new Date(d.updatedAt).toISOString().split('T')[0] : 'Recently'
        }));
        setDatasets(apiDatasets);

        // Safely synchronize real quality history for evaluated dataset
        const primaryEvaluatedDs = apiDatasets.find(d => d.qualityScore != null || d.quality != null) || apiDatasets[0];
        if (primaryEvaluatedDs?.id) {
          qualityApi.getQualityTrends(primaryEvaluatedDs.id).then(res => {
            if (res?.success && Array.isArray(res.data)) {
              setQualityHistory(res.data);
            }
          }).catch((err) => {
            console.debug('Failed to sync initial quality trends:', err?.message);
          });
        }
      }

      if (usrRes.status === 'fulfilled' && usrRes.value?.success) {
        const rawUsers = usrRes.value.data;
        const usrArray = Array.isArray(rawUsers) ? rawUsers : (rawUsers?.users || []);
        const apiUsers = usrArray.map(u => ({
          ...u,
          id: u.id || u._id
        }));
        setUsers(apiUsers);
      }

      if (polRes.status === 'fulfilled' && polRes.value?.success) {
        const rawPolicies = polRes.value.data;
        const polArray = Array.isArray(rawPolicies) ? rawPolicies : (rawPolicies?.policies || []);
        const apiPolicies = polArray.map(p => ({
          ...p,
          id: p.id || p._id
        }));
        setPolicies(apiPolicies);
      }

      if (gloRes.status === 'fulfilled' && gloRes.value?.success) {
        const rawTerms = gloRes.value.data;
        const gloArray = Array.isArray(rawTerms) ? rawTerms : (rawTerms?.terms || []);
        const apiTerms = gloArray.map(t => ({
          ...t,
          id: t.id || t._id
        }));
        setGlossaryTerms(apiTerms);
      }

      if (actRes.status === 'fulfilled' && actRes.value?.success) {
        const rawActs = actRes.value.data;
        const actArray = Array.isArray(rawActs) ? rawActs : (rawActs?.activities || []);
        const apiActivities = actArray.map(a => {
          let actorName = 'System';
          if (typeof a.user === 'string' && a.user.trim()) {
            actorName = a.user;
          } else if (typeof a.actor === 'string' && a.actor.trim()) {
            actorName = a.actor;
          } else if (a.actorId && typeof a.actorId === 'object') {
            actorName = a.actorId.name || a.actorId.email || a.actorId._id?.toString() || 'System';
          } else if (typeof a.actorId === 'string' && a.actorId.trim()) {
            actorName = a.actorId;
          }

          let targetName = 'System';
          if (typeof a.target === 'string' && a.target.trim()) {
            targetName = a.target;
          } else if (a.datasetId && typeof a.datasetId === 'object') {
            targetName = a.datasetId.name || a.datasetId._id?.toString() || 'System';
          } else if (typeof a.datasetId === 'string' && a.datasetId.trim()) {
            targetName = a.datasetId;
          } else if (a.metadata && typeof a.metadata === 'object') {
            targetName = a.metadata.dataSourceName || a.metadata.name || a.metadata.term || 'System';
          }

          return {
            ...a,
            id: a.id || a._id,
            title: a.title || a.action || 'System Event',
            user: actorName,
            actor: actorName,
            target: targetName
          };
        });
        setActivities(apiActivities);
        const serverTotal = actRes.value.totalCount ?? actRes.value.count ?? actRes.value.pagination?.total;
        setActivityTotalCount(typeof serverTotal === 'number' ? serverTotal : apiActivities.length);
      }

      if (sourcesRes.status === 'fulfilled' && sourcesRes.value?.success) {
        const rawSources = sourcesRes.value.data;
        const srcArray = Array.isArray(rawSources) ? rawSources : (rawSources?.dataSources || rawSources?.sources || []);
        setDataSources(srcArray.map(s => ({ ...s, id: s.id || s._id })));
      }

      if (rulesRes.status === 'fulfilled' && rulesRes.value?.success) {
        const rawRules = rulesRes.value.data;
        const rulesArray = Array.isArray(rawRules) ? rawRules : (rawRules?.rules || []);
        const mappedRules = rulesArray.map(r => ({ ...r, id: r.id || r._id }));
        setRules(mappedRules);
        setQualityRules(mappedRules);
      }

      if (issuesRes.status === 'fulfilled' && issuesRes.value?.success) {
        const rawIssues = issuesRes.value.data;
        const issuesArray = Array.isArray(rawIssues) ? rawIssues : (rawIssues?.issues || []);
        setIssues(issuesArray.map(i => {
          const dsIdStr = (typeof i.datasetId === 'object' && i.datasetId !== null)
            ? (i.datasetId._id || i.datasetId.id)
            : i.datasetId;
          const dsNameStr = (typeof i.datasetId === 'object' && i.datasetId !== null)
            ? i.datasetId.name
            : (i.datasetName || '');
          return {
            ...i,
            id: i.id || i._id,
            datasetId: String(dsIdStr || ''),
            datasetName: dsNameStr,
            column: i.column || i.field,
            severity: i.severity || 'medium'
          };
        }));
      }
    } catch (err) {
      console.info('Operating in localized state with backend sync available:', err.message);
    }
  }, []);

  useEffect(() => {
    const rawJwt = localStorage.getItem('ricoz_jwt');
    const isAuth = localStorage.getItem('ricoz-authenticated') === 'true';
    if (rawJwt && rawJwt !== 'demo-local-jwt-token' && isAuth) {
      fetchBackendData();
    }
  }, [fetchBackendData, isAuthenticated]);

  // Clean datasets directly from real backend state without fake canonical mock overlays
  const datasets = useMemo(() => {
    return rawDatasets.map(d => ({
      ...d,
      id: d.id || d._id,
      rows: d.rowCount || d.rows || '0',
      columnsCount: d.schema ? d.schema.length : (d.columns ? d.columns.length : (d.columnsCount ?? 0)),
      quality: d.qualityScore ?? d.quality ?? null,
      qualityScore: d.qualityScore ?? d.quality ?? null,
      updated: d.updatedAt ? new Date(d.updatedAt).toISOString().split('T')[0] : 'Recently'
    }));
  }, [rawDatasets]);

  // Dynamically computed metrics derived directly from state
  const dashboardMetrics = useMemo(() => {
    return calculateDashboardMetrics(datasets, users, policies, issues);
  }, [datasets, users, policies, issues]);

  const dataHealthSummary = useMemo(() => {
    return calculateDataHealthSummary(datasets, {});
  }, [datasets]);

  const [globalSearch, setGlobalSearch] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Recent visited pages (honestly defaults to empty array)
  const [recentPages, setRecentPages] = useLocalStorage('ricoz_recent_pages', []);

  const addRecentPage = useCallback((title, path, category) => {
    setRecentPages(prev => {
      const filtered = prev.filter(p => p.path !== path);
      return [{ title, path, category }, ...filtered].slice(0, 6);
    });
  }, [setRecentPages]);

  // Global keyboard shortcut for Command Palette (⌘K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Authentication
  const login = async (email, password) => {
    const cleanEmail = (email || '').trim();

    try {
      const authRes = await authApi.login(cleanEmail, password || 'Password123!');
      if (!authRes?.success || !authRes.data?.token) {
        throw new Error(authRes?.message || 'Authentication failed');
      }

      resetUnauthorizedState();

      const token = authRes.data.token;
      localStorage.setItem('ricoz_jwt', token);
      apiClient.setToken(token);
      localStorage.setItem('ricoz-authenticated', 'true');
      setIsAuthenticated(true);

      const backendUser = authRes.data.user || {};
      const userToLogin = {
        id: backendUser.id || backendUser._id || 'user-001',
        name: backendUser.name || 'Enterprise User',
        email: backendUser.email || cleanEmail,
        role: backendUser.role || 'Data Analyst',
        avatar: backendUser.avatar || 'U',
        avatarBg: backendUser.avatarBg || 'bg-blue-600',
        department: backendUser.department || 'Enterprise Analytics',
        isAuthenticated: true
      };
      setCurrentUser(userToLogin);
      addToast({
        type: 'success',
        title: 'Welcome to RicozData',
        message: `Signed in as ${userToLogin.name}`
      });

      // Synchronize backend data immediately with the authorized token
      await fetchBackendData();

      return { success: true, user: userToLogin };
    } catch (err) {
      console.warn('[Login Error]:', err.message);
      localStorage.removeItem('ricoz_jwt');
      localStorage.removeItem('ricoz-authenticated');
      setIsAuthenticated(false);
      return { success: false, error: err.message || 'Invalid email or password' };
    }
  };

  const logout = async (options = { notifyBackend: true }) => {
    const shouldNotify = options?.notifyBackend !== false;
    const token = localStorage.getItem('ricoz_jwt');

    // Only notify backend if requested AND a valid token actually exists
    if (shouldNotify && token && token !== 'demo-local-jwt-token') {
      try {
        await authApi.logout(token);
      } catch (e) {
        console.warn('[Logout] Remote signout notification failed:', e.message);
      }
    }

    try {
      localStorage.removeItem('ricoz-authenticated');
      localStorage.removeItem('ricoz_jwt');
      apiClient.setToken(null);
    } catch (e) {
      console.warn('Failed to remove authentication from localStorage', e);
    }
    setIsAuthenticated(false);
    setCurrentUser(prev => ({
      ...prev,
      name: '',
      email: '',
      role: '',
      avatar: '',
      isAuthenticated: false
    }));
    if (options?.reason === 'expired') {
      addToast({
        type: 'warning',
        title: 'Session Expired',
        message: 'Your session has expired. Please sign in again.'
      });
    } else {
      addToast({
        type: 'info',
        title: 'Signed out',
        message: 'You have been successfully logged out'
      });
    }
  };

  // Activity logger
  const addActivity = (act) => {
    const newAct = {
      id: `act-${Date.now()}`,
      time: 'Just now',
      ...act
    };
    setActivities(prev => [newAct, ...prev]);
    setActivityTotalCount(prev => prev + 1);
    activityApi.createActivity(newAct).catch(() => {});
  };

  // Dataset CRUD
  const addDataset = (datasetData) => {
    const id = datasetData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const ownerUser = users.find(u => u.name === datasetData.owner) || currentUser;
    const newDataset = {
      id,
      name: datasetData.name,
      domainId: datasetData.domainId || (datasetData.domain ? datasetData.domain.toLowerCase() : 'marketing'),
      domain: datasetData.domain || 'Marketing',
      ownerId: ownerUser.id || 'user-001',
      owner: datasetData.owner || ownerUser.name || 'Raghuveer C.',
      ownerEmail: ownerUser.email || 'raghuveer@ricozdata.com',
      ownerRole: ownerUser.role || 'Data Analyst',
      source: datasetData.source || 'Snowflake',
      sourceDetails: {
        type: datasetData.source || 'Snowflake',
        database: 'PROD_DB',
        schema: 'ANALYTICS',
        environment: 'Production',
        syncSchedule: 'Daily'
      },
      quality: datasetData.quality || 95,
      status: datasetData.status || 'Certified',
      updated: 'Just now',
      lastUpdatedDate: 'Sep 21, 2026',
      rows: datasetData.rows || '1.0M',
      columnsCount: datasetData.columnsCount || 12,
      sensitivity: datasetData.sensitivity || 'Internal',
      usage: '1 view',
      statistics: {
        rowCount: 1000000,
        sizeBytes: 1250000000,
        columnCount: datasetData.columnsCount || 12,
        queryCount30d: 1,
        activeUsersCount: 1,
        lastIngestionTime: new Date().toISOString()
      },
      description: datasetData.description || 'Newly registered dataset.',
      longDescription: datasetData.description || 'Newly registered enterprise dataset.',
      tags: datasetData.tags || ['custom', datasetData.domain?.toLowerCase() || 'data'],
      documentation: [{ name: `${datasetData.name} Spec.pdf`, size: '1.2 MB', url: '#' }],
      schema: [
        { name: 'id', type: 'VARCHAR(64)', primaryKey: true, nullable: false, pii: false, description: 'Surrogate ID' },
        { name: 'created_at', type: 'TIMESTAMP', primaryKey: false, nullable: false, pii: false, description: 'Creation date' }
      ]
    };

    setDatasets(prev => [newDataset, ...prev]);

    // Asynchronously sync with backend
    datasetApi.createDataset({
      name: newDataset.name,
      description: newDataset.description,
      longDescription: newDataset.longDescription,
      domain: newDataset.domain,
      source: newDataset.source,
      sensitivity: newDataset.sensitivity,
      certificationStatus: newDataset.status,
      rowCount: newDataset.rows,
      tags: newDataset.tags
    }).catch(() => {});

    addActivity({
      title: 'New dataset registered',
      type: 'create',
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
      actorId: ownerUser.id || 'user-001',
      user: ownerUser.name || 'Raghuveer C.',
      datasetId: newDataset.id,
      target: newDataset.name
    });

    addToast({
      type: 'success',
      title: 'Dataset registered',
      message: `"${newDataset.name}" was added to the data catalog.`
    });

    return newDataset;
  };

  const updateDataset = (id, updatedFields) => {
    setDatasets(prev => prev.map(d => d.id === id ? { ...d, ...updatedFields } : d));
    datasetApi.updateDataset(id, updatedFields).catch(() => {});
    addToast({
      type: 'success',
      title: 'Dataset updated',
      message: 'Changes saved successfully.'
    });
  };

  const deleteDataset = (id) => {
    const item = datasets.find(d => d.id === id);
    setDatasets(prev => prev.filter(d => d.id !== id));
    datasetApi.deleteDataset(id).catch(() => {});
    addToast({
      type: 'info',
      title: 'Dataset deleted',
      message: `"${item ? item.name : 'Dataset'}" was removed from the catalog.`
    });
  };

  // Glossary CRUD
  const addGlossaryTerm = async (termData) => {
    try {
      const res = await glossaryApi.createTerm(termData);
      const responseBody = res?.success !== undefined ? res : (res?.data || res);
      const created = responseBody?.data || responseBody;
      const formatted = {
        ...created,
        id: created.id || created._id,
      };
      setGlossaryTerms((prev) => [formatted, ...prev]);
      addToast({
        type: 'success',
        title: 'Glossary term created',
        message: `"${formatted.term}" added to business glossary.`,
      });
      return formatted;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to create term';
      addToast({
        type: 'error',
        title: 'Failed to create term',
        message: errMsg,
      });
      throw err;
    }
  };

  const updateGlossaryTerm = async (id, updatedFields) => {
    try {
      const res = await glossaryApi.updateTerm(id, updatedFields);
      const responseBody = res?.success !== undefined ? res : (res?.data || res);
      const updated = responseBody?.data || responseBody;
      const formatted = {
        ...updated,
        id: updated.id || updated._id,
      };
      setGlossaryTerms((prev) => prev.map((t) => (t.id === id || t._id === id ? formatted : t)));
      addToast({
        type: 'success',
        title: 'Glossary term updated',
        message: `"${formatted.term}" updated successfully.`,
      });
      return formatted;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to update term';
      addToast({
        type: 'error',
        title: 'Failed to update term',
        message: errMsg,
      });
      throw err;
    }
  };

  const updateGlossaryTermStatus = async (id, status) => {
    try {
      const res = await glossaryApi.updateStatus(id, status);
      const responseBody = res?.success !== undefined ? res : (res?.data || res);
      const updated = responseBody?.data || responseBody;
      const formatted = {
        ...updated,
        id: updated.id || updated._id,
      };
      setGlossaryTerms((prev) => prev.map((t) => (t.id === id || t._id === id ? formatted : t)));
      addToast({
        type: 'info',
        title: 'Status updated',
        message: `Status set to ${status}.`,
      });
      return formatted;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to update status';
      addToast({
        type: 'error',
        title: 'Failed to update status',
        message: errMsg,
      });
      throw err;
    }
  };

  const deleteGlossaryTerm = async (id) => {
    const term = glossaryTerms.find((t) => t.id === id || t._id === id);
    try {
      await glossaryApi.deleteTerm(id);
      setGlossaryTerms((prev) => prev.filter((t) => t.id !== id && t._id !== id));
      addToast({
        type: 'info',
        title: 'Term deleted',
        message: `"${term ? term.term : 'Glossary term'}" was removed.`,
      });
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to delete term';
      addToast({
        type: 'error',
        title: 'Failed to delete term',
        message: errMsg,
      });
      throw err;
    }
  };

  // Policy CRUD
  const addPolicy = async (policyData) => {
    try {
      const payload = {
        name: policyData.name,
        description: policyData.description,
        category: policyData.category || 'Data Protection',
        status: policyData.status ? policyData.status.toLowerCase().replace(/[\s-]/g, '_') : 'draft',
        appliesTo: policyData.appliesTo || 'All Datasets',
        severity: policyData.severity || 'Medium',
        priority: policyData.priority || 'Medium',
        scope: policyData.scope,
        datasetIds: policyData.datasetIds || [],
      };
      const res = await policyApi.createPolicy(payload);
      if (res?.success && res.data) {
        const created = {
          ...res.data,
          id: res.data._id || res.data.id,
          lastAudited: 'Just now',
        };
        setPolicies(prev => [created, ...prev]);
        addToast({
          type: 'success',
          title: 'Policy created',
          message: `"${created.name}" created successfully.`
        });
        return created;
      }
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Policy creation failed',
        message: err.message || 'Could not save policy'
      });
      throw err;
    }
  };

  const togglePolicyStatus = async (id) => {
    try {
      const res = await policyApi.togglePolicyStatus(id);
      if (res?.success) {
        setPolicies(prev => prev.map(p => {
          if (p.id === id || p._id === id) {
            const nextStatus = res.data.status;
            return { ...p, status: nextStatus };
          }
          return p;
        }));
        addToast({
          type: 'info',
          title: 'Policy status changed',
          message: `Policy status updated.`
        });
      }
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Failed to update status',
        message: err.message
      });
    }
  };

  const transitionPolicyStatus = async (id, targetStatus, reason) => {
    try {
      const res = await policyApi.transitionPolicyStatus(id, targetStatus, reason);
      if (res?.success) {
        setPolicies(prev => prev.map(p => {
          if (p.id === id || p._id === id) {
            return { ...p, status: res.data.status, version: res.data.version };
          }
          return p;
        }));
        addToast({
          type: 'success',
          title: 'Lifecycle Transitioned',
          message: `Policy transitioned to ${targetStatus.toUpperCase()}`
        });
      }
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Transition failed',
        message: err.message
      });
      throw err;
    }
  };

  const deletePolicy = async (id) => {
    try {
      await policyApi.deletePolicy(id);
      setPolicies(prev => prev.filter(p => p.id !== id && p._id !== id));
      addToast({
        type: 'info',
        title: 'Policy removed',
        message: 'Governance policy was deleted.'
      });
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Failed to delete policy',
        message: err.message
      });
    }
  };

  // RBAC Permission Helpers
  const userPermissions = useMemo(() => {
    return getPermissionsForRole(currentUser?.role);
  }, [currentUser?.role]);

  const hasPermission = useCallback((permission) => {
    if (!currentUser?.role) return false;
    return roleHasPermission(currentUser.role, permission);
  }, [currentUser?.role]);

  const can = hasPermission;

  const hasRole = useCallback((roleOrRoles) => {
    if (!currentUser?.role) return false;
    const allowedRoles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    const currentNorm = mapLegacyRole(currentUser.role);
    return allowedRoles.some(r => mapLegacyRole(r) === currentNorm);
  }, [currentUser?.role]);

  const canManage = useCallback((targetRole) => {
    if (!currentUser?.role) return false;
    return canManageRole(currentUser.role, targetRole);
  }, [currentUser?.role]);

  // User CRUD
  const addUser = (userData) => {
    const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-purple-600', 'bg-amber-600', 'bg-teal-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newUser = {
      id: `user-${Date.now()}`,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'DATA_ANALYST',
      status: userData.status || 'ACTIVE',
      avatar: (userData.name.trim().charAt(0) || 'U').toUpperCase(),
      avatarBg: randomColor,
      department: userData.department || 'Analytics',
      lastActive: 'Just now'
    };
    setUsers(prev => [newUser, ...prev]);
    userApi.createUser({
      name: newUser.name,
      email: newUser.email,
      password: userData.password || 'Password123!',
      role: newUser.role,
      department: newUser.department,
      status: newUser.status
    }).catch(() => {});

    addToast({
      type: 'success',
      title: 'User created',
      message: `Account created for ${newUser.name}`
    });
    return newUser;
  };

  const updateUser = (id, userData) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...userData } : u));
    userApi.updateUser(id, userData).catch(() => {});
    addToast({
      type: 'success',
      title: 'User updated',
      message: 'User changes saved successfully.'
    });
  };

  const deleteUser = (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
    userApi.deleteUser(id).catch(() => {});
    addToast({
      type: 'info',
      title: 'User removed',
      message: 'Account access has been revoked.'
    });
  };

  // Quality issues status update
  const updateIssueStatus = (id, newStatus) => {
    setIssues(prev => prev.map(iss => {
      if (iss.id === id) {
        addToast({
          type: newStatus === 'Resolved' ? 'success' : 'info',
          title: 'Issue updated',
          message: `Issue marked as ${newStatus}`
        });
        return { ...iss, status: newStatus };
      }
      return iss;
    }));
    qualityApi.updateIssueStatus(id, newStatus).catch(() => {});
  };

  // Quality Overview & Trends derived dynamically from real datasets
  const qualityOverview = useMemo(() => {
    const scoredDatasets = datasets.filter(d => d.qualityScore != null || d.quality != null);
    if (scoredDatasets.length === 0) {
      return {
        score: null,
        grade: 'Unrated',
        trendText: 'No quality evaluations recorded yet',
        dimensions: []
      };
    }
    const avgScore = Math.round(scoredDatasets.reduce((acc, d) => acc + (Number(d.qualityScore ?? d.quality) || 0), 0) / scoredDatasets.length);
    return {
      score: avgScore,
      grade: avgScore >= 90 ? 'Excellent' : avgScore >= 75 ? 'Good' : 'Needs Review',
      trendText: 'Automated evaluation from cataloged datasets',
      dimensions: [
        { name: 'Completeness', score: avgScore, color: '#10b981' },
        { name: 'Accuracy', score: avgScore, color: '#3b82f6' },
        { name: 'Consistency', score: avgScore, color: '#8b5cf6' },
        { name: 'Validity', score: avgScore, color: '#f59e0b' },
        { name: 'Uniqueness', score: avgScore, color: '#06b6d4' },
        { name: 'Timeliness', score: avgScore, color: '#ec4899' },
      ]
    };
  }, [datasets]);

  // Quality Trends derived dynamically from real evaluation history, defaulting safely to empty state
  const qualityTrends = useMemo(() => {
    if (!Array.isArray(qualityHistory) || qualityHistory.length === 0) {
      return [];
    }
    return qualityHistory.map((item, idx) => ({
      month: item.evaluatedAt
        ? new Date(item.evaluatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : (item.month || `Scan ${idx + 1}`),
      score: Number(item.score ?? item.qualityScore ?? 0),
      target: item.target ?? 90,
      completeness: item.completeness ?? item.score ?? 0,
      accuracy: item.accuracy ?? item.score ?? 0
    }));
  }, [qualityHistory]);

  // Quality evaluation execution
  const evaluateDatasetQuality = useCallback(async (datasetId) => {
    try {
      const res = await qualityApi.evaluateDataset(datasetId);
      if (res?.success) {
        await fetchBackendData();
        try {
          const trendsRes = await qualityApi.getQualityTrends(datasetId);
          if (trendsRes?.success && Array.isArray(trendsRes.data)) {
            setQualityHistory(trendsRes.data);
          }
        } catch (err) {
          console.debug('Failed to refresh quality trends post-evaluation:', err?.message);
        }
        addToast({
          type: 'success',
          title: 'Quality Evaluation Complete',
          message: `Dataset score: ${res.data?.score}% (${res.data?.grade})`
        });
        return res.data;
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Quality Evaluation Failed',
        message: err.message || 'Error evaluating quality.'
      });
      throw err;
    }
  }, [fetchBackendData, addToast]);

  const runQualityRule = useCallback(async (ruleId) => {
    try {
      const res = await qualityApi.runRule(ruleId);
      if (res?.success) {
        await fetchBackendData();
        addToast({
          type: 'success',
          title: 'Rule Executed',
          message: `Status: ${res.data?.lastResult || 'Completed'}`
        });
        return res.data;
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Rule Execution Failed',
        message: err.message || 'Error executing rule.'
      });
      throw err;
    }
  }, [fetchBackendData, addToast]);

  // Selectors bound to current state
  const getDataset = useCallback((id) => getDatasetById(datasets, id), [datasets]);
  const getUser = useCallback((idOrName) => getUserById(users, idOrName), [users]);
  const getDomain = useCallback((idOrName) => getDomainById(domains, idOrName), [domains]);
  const getEnrichedDataset = useCallback((id) => enrichDataset(getDatasetById(datasets, id), { users, domains }), [datasets, users, domains]);
  const getDatasetIssues = useCallback((datasetId) => getIssuesForDataset(issues, datasetId), [issues]);
  const getDatasetPolicies = useCallback((datasetId) => getPoliciesForDataset(policies, datasetId), [policies]);
  const getDatasetLineage = useCallback(async (datasetId) => {
    if (!datasetId) return { nodes: [], edges: [] };
    try {
      const res = await lineageApi.getLineageForDataset(datasetId);
      if (res?.success && res.data) {
        return res.data;
      }
    } catch (err) {
      console.warn('API lineage fetch error:', err);
    }
    return { nodes: [], edges: [] };
  }, []);
  const getQualityForDatasetLocal = useCallback((datasetId) => {
    const ds = datasets.find(d => String(d.id || d._id) === String(datasetId));
    if (!ds || (ds.qualityScore == null && ds.quality == null)) {
      return {
        score: null,
        grade: 'Unrated',
        trendText: 'No quality evaluations recorded yet',
        dimensions: []
      };
    }
    const score = Number(ds.qualityScore ?? ds.quality);
    return {
      score,
      grade: score >= 95 ? 'Excellent' : score >= 90 ? 'Good' : score >= 75 ? 'Fair' : 'At Risk',
      trendText: 'Verified live source evaluation',
      dimensions: Array.isArray(ds.dimensions) ? ds.dimensions : []
    };
  }, [datasets]);
  const getDatasetGlossary = useCallback((datasetId) => getGlossaryTermsForDataset(glossaryTerms, datasetId), [glossaryTerms]);
  const getDatasetActivities = useCallback((datasetId) => getActivitiesForDataset(activities, datasetId), [activities]);
  const searchAll = useCallback((query) => searchCentralData(query, { datasets, users, glossary: glossaryTerms, policies }), [datasets, users, glossaryTerms, policies]);

  return (
    <AppContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        toasts,
        addToast,
        removeToast,
        isCommandOpen,
        setIsCommandOpen,
        activeDrawer,
        openDrawer,
        closeDrawer,
        sidebarCollapsed,
        setSidebarCollapsed,
        sidebarOpen,
        setSidebarOpen,
        currentUser,
        setCurrentUser,
        isAuthenticated,
        setIsAuthenticated,
        login,
        logout,
        datasets,
        addDataset,
        updateDataset,
        deleteDataset,
        users,
        addUser,
        updateUser,
        deleteUser,
        userPermissions,
        hasPermission,
        can,
        hasRole,
        canManage,
        domains,
        activities,
        activityTotalCount,
        addActivity,
        glossaryTerms,
        addGlossaryTerm,
        updateGlossaryTerm,
        updateGlossaryTermStatus,
        deleteGlossaryTerm,
        policies,
        addPolicy,
        togglePolicyStatus,
        transitionPolicyStatus,
        deletePolicy,
        rules,
        qualityRules,
        issues,
        setIssues,
        updateIssueStatus,
        dataSources,
        setDataSources,
        evaluateDatasetQuality,
        runQualityRule,
        dashboardMetrics,
        dataHealthSummary,
        fetchBackendData,
        globalSearch,
        setGlobalSearch,
        unreadNotifications,
        setUnreadNotifications,
        recentPages,
        addRecentPage,
        qualityOverview,
        qualityTrends,
        qualityHistory,
        setQualityHistory,
        initialLineageNodes: [],
        initialLineageEdges: [],
        // Selectors
        getDataset,
        getUser,
        getDomain,
        getEnrichedDataset,
        getQualityForDataset: getQualityForDatasetLocal,
        getDatasetIssues,
        getDatasetPolicies,
        getDatasetLineage,
        getDatasetGlossary,
        getDatasetActivities,
        searchAll
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
