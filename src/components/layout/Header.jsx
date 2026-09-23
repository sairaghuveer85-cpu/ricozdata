import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, NavLink } from 'react-router-dom';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  Settings,
  LogOut,
  Shield,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Dropdown from '../common/Dropdown';
import ThemeSelector from '../common/ThemeSelector';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    currentUser,
    logout,
    setIsCommandOpen,
    setSidebarOpen,
    unreadNotifications,
    setUnreadNotifications,
    activities
  } = useApp();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);

  // Close notifications on click outside or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && notificationsOpen) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [notificationsOpen]);

  // Dynamic breadcrumbs based on route
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path.startsWith('/catalog/')) {
      return [
        { label: 'Data Catalog', path: '/catalog' },
        { label: 'Customer Database', path: null }
      ];
    }
    if (path.startsWith('/quality')) {
      return [
        { label: 'Data Catalog', path: '/catalog' },
        { label: 'Data Quality', path: null }
      ];
    }
    if (path.startsWith('/lineage')) {
      return [
        { label: 'Data Catalog', path: '/catalog' },
        { label: 'Data Lineage', path: null }
      ];
    }
    if (path === '/catalog') return [{ label: 'Data Catalog', path: null }];
    if (path === '/glossary') return [{ label: 'Business Glossary', path: null }];
    if (path === '/governance') return [{ label: 'Governance & Policies', path: null }];
    if (path === '/reports') return [{ label: 'Reports & Audits', path: null }];
    if (path === '/users') return [{ label: 'User Management', path: null }];
    if (path === '/settings') return [{ label: 'Settings', path: null }];
    return [{ label: 'Dashboard', path: null }];
  };

  const breadcrumbs = getBreadcrumbs();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      className="h-16 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 transition-colors"
      style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)' }}
    >
      {/* Left: Mobile Toggle & Breadcrumbs / Page Context */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-1 rounded-md text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        {/* Dynamic Breadcrumbs for sm+ */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0">
          <NavLink to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium shrink-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded">
            RicozData
          </NavLink>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={idx}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" aria-hidden="true" />
              {crumb.path ? (
                <NavLink to={crumb.path} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded">
                  {crumb.label}
                </NavLink>
              ) : (
                <span aria-current="page" className="text-slate-900 dark:text-white font-semibold truncate">
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>

        {/* Mobile Page Context Header */}
        <div className="sm:hidden font-semibold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
          {breadcrumbs[breadcrumbs.length - 1]?.label || 'RicozData'}
        </div>
      </div>

      {/* Center: Global Search trigger matching Command Palette */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <button
          type="button"
          onClick={() => setIsCommandOpen(true)}
          className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-md transition-colors cursor-pointer text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Open Command Center (Command K)"
          style={{
            backgroundColor: 'var(--input-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)'
          }}
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            <span style={{ color: 'var(--text-muted)' }}>Search datasets, tables, or users...</span>
          </div>
          <kbd
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
          >
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Theme Switcher, Notifications, Help, User Profile */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Mobile search button */}
        <button
          type="button"
          onClick={() => setIsCommandOpen(true)}
          aria-label="Search"
          className="md:hidden p-2 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Search className="w-4 h-4" aria-hidden="true" />
        </button>

        {/* Polished 3-Option Theme Switcher (Available on sm+; mobile access in drawer) */}
        <div className="hidden sm:block">
          <ThemeSelector compact />
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              if (unreadNotifications > 0) setUnreadNotifications(0);
            }}
            aria-haspopup="true"
            aria-expanded={notificationsOpen}
            className="relative p-2 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`Notifications ${unreadNotifications > 0 ? `(${unreadNotifications} unread)` : ''}`}
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" aria-hidden="true" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white dark:ring-[#0D1828]" aria-hidden="true" />
            )}
          </button>

          {notificationsOpen && (
            <div
              role="dialog"
              aria-label="Alerts & Events"
              className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm rounded-md shadow-2xl py-2 z-50 animate-in fade-in zoom-in-95 duration-150"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Alerts & Events</span>
                <button
                  type="button"
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                  onClick={() => setNotificationsOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto" style={{ borderColor: 'var(--border)' }}>
                {activities.slice(0, 5).map((act) => (
                  <div key={act.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-3 text-xs">
                    <div className={`p-1.5 rounded-md ${act.iconBg} ${act.iconColor} shrink-0 mt-0.5`} aria-hidden="true">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{act.title}</p>
                      <p className="text-slate-400 text-[11px] mt-0.5">{act.target} • {act.time}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-slate-100 dark:border-slate-800 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/dashboard');
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-medium hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 rounded"
                >
                  View all in Activity Timeline
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="hidden sm:block h-5 w-px bg-slate-200 dark:bg-slate-800" aria-hidden="true" />

        {/* User Profile Dropdown */}
        <Dropdown
          align="right"
          width="w-56"
          trigger={
            <div className="flex items-center gap-2.5 p-1 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer">
              <div className={`w-8 h-8 rounded-full ${currentUser?.avatarBg || 'bg-blue-600'} text-white font-bold text-xs flex items-center justify-center shadow-xs`}>
                {currentUser?.avatar || 'R'}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {currentUser?.name || 'Raghuveer'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                  {currentUser?.role || 'Data Analyst'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:block" aria-hidden="true" />
            </div>
          }
          items={[
            {
              label: 'User Settings',
              icon: Settings,
              onClick: () => navigate('/settings')
            },
            {
              label: 'Governance Policies',
              icon: Shield,
              onClick: () => navigate('/governance')
            },
            { divider: true },
            {
              label: 'Sign out',
              icon: LogOut,
              danger: true,
              onClick: handleLogout
            }
          ]}
        />
      </div>
    </header>
  );
}
