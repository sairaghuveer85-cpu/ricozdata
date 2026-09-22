import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useTheme } from './ThemeContext';
import { INITIAL_DATASETS } from '../data/datasets';
import { INITIAL_USERS } from '../data/users';
import { INITIAL_ACTIVITIES } from '../data/activities';
import { INITIAL_GLOSSARY_TERMS } from '../data/glossary';
import { INITIAL_POLICIES, INITIAL_RULES } from '../data/policies';
import { QUALITY_OVERVIEW, QUALITY_ISSUES, QUALITY_TRENDS } from '../data/quality';
import { INITIAL_LINEAGE_NODES, INITIAL_LINEAGE_EDGES } from '../data/lineage';

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
  // type: 'dataset' | 'issue' | 'glossary' | 'policy' | 'user' | 'filter' | null
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
    name: 'Raghuveer C.',
    email: 'raghuveer@ricozdata.com',
    role: 'Data Analyst',
    avatar: 'R',
    avatarBg: 'bg-blue-600',
    isAuthenticated: false
  });

  // Synchronize auth state on mount
  useEffect(() => {
    const isAuth = localStorage.getItem('ricoz-authenticated') === 'true';
    setIsAuthenticated(isAuth);
    if (!isAuth && currentUser?.isAuthenticated) {
      setCurrentUser(prev => ({ ...prev, isAuthenticated: false }));
    }
  }, []);

  // Persistent Mock Data
  const [datasets, setDatasets] = useLocalStorage('ricoz_datasets', INITIAL_DATASETS);
  const [users, setUsers] = useLocalStorage('ricoz_users', INITIAL_USERS);
  const [activities, setActivities] = useLocalStorage('ricoz_activities', INITIAL_ACTIVITIES);
  const [glossaryTerms, setGlossaryTerms] = useLocalStorage('ricoz_glossary', INITIAL_GLOSSARY_TERMS);
  const [policies, setPolicies] = useLocalStorage('ricoz_policies', INITIAL_POLICIES);
  const [rules] = useLocalStorage('ricoz_rules', INITIAL_RULES);
  const [issues, setIssues] = useLocalStorage('ricoz_issues', QUALITY_ISSUES);
  
  const [globalSearch, setGlobalSearch] = useState('');
  const [unreadNotifications, setUnreadNotifications] = useState(3);

  // Recent visited pages
  const [recentPages, setRecentPages] = useLocalStorage('ricoz_recent_pages', [
    { title: 'Customer Database', path: '/catalog/customer-database', category: 'Dataset' },
    { title: 'Data Lineage', path: '/lineage/customer-database', category: 'Lineage' },
    { title: 'PII Data Access Policy', path: '/governance', category: 'Policy' },
    { title: 'Data Quality Dashboard', path: '/quality/customer-database', category: 'Quality' }
  ]);

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
  const login = (email, _password) => {
    try {
      localStorage.setItem('ricoz-authenticated', 'true');
    } catch (e) {
      console.warn('Failed to store authentication in localStorage', e);
    }
    setIsAuthenticated(true);

    const cleanEmail = (email || '').trim();
    const existing = users.find(u => u.email.toLowerCase() === cleanEmail.toLowerCase());

    let userName = 'Raghuveer C.';
    let userAvatar = 'R';
    if (existing) {
      userName = existing.name;
      userAvatar = existing.avatar;
    } else if (cleanEmail) {
      const prefix = cleanEmail.split('@')[0];
      userName = prefix
        .split(/[._-]/)
        .map(p => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ') || 'Enterprise User';
      userAvatar = (cleanEmail.charAt(0) || 'U').toUpperCase();
    }

    const userToLogin = {
      name: userName,
      email: cleanEmail,
      role: existing ? existing.role : 'Data Analyst',
      avatar: userAvatar,
      avatarBg: existing ? existing.avatarBg : 'bg-blue-600',
      isAuthenticated: true
    };
    setCurrentUser(userToLogin);
    addToast({
      type: 'success',
      title: 'Welcome to RicozData',
      message: `Signed in as ${userToLogin.name}`
    });
    return true;
  };

  const logout = () => {
    try {
      localStorage.removeItem('ricoz-authenticated');
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
    addToast({
      type: 'info',
      title: 'Signed out',
      message: 'You have been successfully logged out'
    });
  };

  // Activity logger
  const addActivity = (act) => {
    const newAct = {
      id: `act-${Date.now()}`,
      time: 'Just now',
      ...act
    };
    setActivities(prev => [newAct, ...prev]);
  };

  // Dataset CRUD
  const addDataset = (datasetData) => {
    const id = datasetData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newDataset = {
      id,
      name: datasetData.name,
      domain: datasetData.domain || 'Marketing',
      owner: datasetData.owner || currentUser.name || 'Raghuveer C.',
      ownerEmail: currentUser.email || 'raghuveer@ricozdata.com',
      ownerRole: currentUser.role || 'Data Analyst',
      source: datasetData.source || 'Snowflake',
      quality: datasetData.quality || 95,
      status: datasetData.status || 'Certified',
      updated: 'Just now',
      lastUpdatedDate: 'Sep 21, 2026',
      rows: datasetData.rows || '1.0M',
      columnsCount: datasetData.columnsCount || 12,
      sensitivity: datasetData.sensitivity || 'Internal',
      usage: '1 view',
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

    addActivity({
      title: 'New dataset registered',
      type: 'create',
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-50 dark:bg-blue-950/40',
      user: currentUser.name || 'Raghuveer C.',
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
    addToast({
      type: 'success',
      title: 'Dataset updated',
      message: 'Changes saved successfully.'
    });
  };

  const deleteDataset = (id) => {
    const item = datasets.find(d => d.id === id);
    setDatasets(prev => prev.filter(d => d.id !== id));
    addToast({
      type: 'info',
      title: 'Dataset deleted',
      message: `"${item ? item.name : 'Dataset'}" was removed from the catalog.`
    });
  };

  // Glossary CRUD
  const addGlossaryTerm = (termData) => {
    const newTerm = {
      id: `term-${Date.now()}`,
      term: termData.term,
      definition: termData.definition,
      domain: termData.domain || 'Marketing',
      owner: termData.owner || currentUser.name,
      status: 'Approved',
      usageCount: 1,
      synonyms: termData.synonyms ? (Array.isArray(termData.synonyms) ? termData.synonyms : termData.synonyms.split(',').map(s => s.trim())) : []
    };
    setGlossaryTerms(prev => [newTerm, ...prev]);
    addToast({
      type: 'success',
      title: 'Glossary term created',
      message: `"${newTerm.term}" added to business glossary.`
    });
    return newTerm;
  };

  const deleteGlossaryTerm = (id) => {
    setGlossaryTerms(prev => prev.filter(t => t.id !== id));
    addToast({
      type: 'info',
      title: 'Term deleted',
      message: 'Glossary term removed.'
    });
  };

  // Policy CRUD
  const addPolicy = (policyData) => {
    const newPolicy = {
      id: `pol-${Date.now()}`,
      name: policyData.name,
      description: policyData.description,
      appliesTo: policyData.appliesTo || 'All Datasets',
      status: policyData.status || 'Active',
      category: policyData.category || 'Security',
      lastAudited: 'Sep 21, 2026',
      enforcementLevel: policyData.enforcementLevel || 'Automated'
    };
    setPolicies(prev => [newPolicy, ...prev]);
    addToast({
      type: 'success',
      title: 'Policy created',
      message: `"${newPolicy.name}" active in governance engine.`
    });
    return newPolicy;
  };

  const togglePolicyStatus = (id) => {
    setPolicies(prev => prev.map(p => {
      if (p.id === id) {
        const nextStatus = p.status === 'Active' ? 'Inactive' : 'Active';
        addToast({
          type: 'info',
          title: 'Policy status changed',
          message: `"${p.name}" is now ${nextStatus}.`
        });
        return { ...p, status: nextStatus };
      }
      return p;
    }));
  };

  const deletePolicy = (id) => {
    setPolicies(prev => prev.filter(p => p.id !== id));
    addToast({
      type: 'info',
      title: 'Policy removed',
      message: 'Governance policy was deleted.'
    });
  };

  // User CRUD
  const addUser = (userData) => {
    const colors = ['bg-blue-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-purple-600', 'bg-amber-600', 'bg-teal-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newUser = {
      id: `user-${Date.now()}`,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'Data Analyst',
      status: userData.status || 'Active',
      avatar: (userData.name.trim().charAt(0) || 'U').toUpperCase(),
      avatarBg: randomColor,
      department: userData.department || 'Analytics',
      lastActive: 'Just now'
    };
    setUsers(prev => [newUser, ...prev]);
    addToast({
      type: 'success',
      title: 'User created',
      message: `Account created for ${newUser.name}`
    });
    return newUser;
  };

  const deleteUser = (id) => {
    setUsers(prev => prev.filter(u => u.id !== id));
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
  };

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
        deleteUser,
        activities,
        addActivity,
        glossaryTerms,
        addGlossaryTerm,
        deleteGlossaryTerm,
        policies,
        addPolicy,
        togglePolicyStatus,
        deletePolicy,
        rules,
        issues,
        setIssues,
        updateIssueStatus,
        globalSearch,
        setGlobalSearch,
        unreadNotifications,
        setUnreadNotifications,
        recentPages,
        addRecentPage,
        qualityOverview: QUALITY_OVERVIEW,
        qualityTrends: QUALITY_TRENDS,
        initialLineageNodes: INITIAL_LINEAGE_NODES,
        initialLineageEdges: INITIAL_LINEAGE_EDGES
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
