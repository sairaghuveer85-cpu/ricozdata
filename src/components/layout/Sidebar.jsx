import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Database,
  ShieldCheck,
  GitFork,
  BookOpen,
  Shield,
  BarChart2,
  Users,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import Dropdown from '../common/Dropdown';
import ThemeSelector from '../common/ThemeSelector';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    sidebarCollapsed,
    setSidebarCollapsed,
    sidebarOpen,
    setSidebarOpen,
    currentUser,
    logout
  } = useApp();

  const [currentWorkspace, setCurrentWorkspace] = useState('Production');

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Data Catalog', path: '/catalog', icon: Database, matchPrefix: '/catalog' },
    { name: 'Data Quality', path: '/quality/customer-database', icon: ShieldCheck, matchPrefix: '/quality' },
    { name: 'Data Lineage', path: '/lineage/customer-database', icon: GitFork, matchPrefix: '/lineage' },
    { name: 'Business Glossary', path: '/glossary', icon: BookOpen },
    { name: 'Governance', path: '/governance', icon: Shield },
    { name: 'Reports', path: '/reports', icon: BarChart2 },
    { name: 'Users', path: '/users', icon: Users },
    { name: 'Settings', path: '/settings', icon: Settings }
  ];

  const isActive = (item) => {
    if (item.matchPrefix) {
      return location.pathname.startsWith(item.matchPrefix);
    }
    return location.pathname === item.path;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const desktopSidebarContent = (
    <div
      className={`flex flex-col h-full bg-[#07111F] text-slate-300 select-none border-r border-[#172337] transition-all duration-150 ${
        sidebarCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Top Header: Logo */}
      <div className="h-16 px-4 border-b border-[#172337] flex items-center justify-between">
        {!sidebarCollapsed ? (
          <div className="flex items-center justify-between w-full">
            <NavLink to="/dashboard" className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Database className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm font-bold text-white tracking-tight leading-none">RicozData</span>
            </NavLink>

            {/* Collapse toggle button */}
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#111C2E] transition-colors cursor-pointer"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center w-full">
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white cursor-pointer"
              title="Expand Sidebar"
            >
              <Database className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item);
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={sidebarCollapsed ? item.name : undefined}
              className={`
                group flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors duration-150
                ${active
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C2E]'
                }
                ${sidebarCollapsed ? 'justify-center px-0' : ''}
              `}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
              
              {!sidebarCollapsed && (
                <span className="truncate">{item.name}</span>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Bottom User Profile */}
      <div className="p-3 border-t border-[#172337]">
        <div className="flex items-center justify-between px-1 py-1">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-7 h-7 rounded-full ${currentUser?.avatarBg || 'bg-blue-600'} text-white font-semibold text-xs flex items-center justify-center shrink-0`}>
              {currentUser?.avatar || 'R'}
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white truncate leading-tight">
                  {currentUser?.name || 'Raghuveer'}
                </div>
                <div className="text-[11px] text-slate-400 truncate leading-tight">
                  {currentUser?.role || 'Data Analyst'}
                </div>
              </div>
            )}
          </div>

          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-[#111C2E] transition-colors cursor-pointer"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Persistent) */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0 z-30">
        {desktopSidebarContent}
      </aside>

      {/* Mobile Drawer (Enterprise Framer Motion Drawer) */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Mobile Drawer Panel */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative flex-1 flex flex-col max-w-[280px] sm:max-w-xs w-full bg-[#07111F] text-slate-300 z-10 border-r border-[#172337] shadow-2xl h-full select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Header: Logo + Close Button */}
              <div className="h-16 px-4 border-b border-[#172337] flex items-center justify-between shrink-0">
                <NavLink
                  to="/dashboard"
                  onClick={() => setSidebarOpen(false)}
                  className="flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center text-white shrink-0">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-bold text-white tracking-tight leading-none">RicozData</span>
                </NavLink>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#111C2E] transition-colors cursor-pointer"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        group flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors duration-150
                        ${active
                          ? 'bg-blue-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#111C2E]'
                        }
                      `}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`} />
                      <span className="truncate">{item.name}</span>
                    </NavLink>
                  );
                })}
              </div>

              {/* Theme Control in Mobile Navigation (Accessible) */}
              <div className="px-4 py-3 border-t border-[#172337] flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-400 font-medium">Appearance</span>
                <ThemeSelector compact />
              </div>

              {/* Bottom User Profile with Logout */}
              <div className="p-3 border-t border-[#172337] shrink-0">
                <div className="flex items-center justify-between px-1 py-1">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-full ${currentUser?.avatarBg || 'bg-blue-600'} text-white font-semibold text-xs flex items-center justify-center shrink-0`}>
                      {currentUser?.avatar || 'R'}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate leading-tight">
                        {currentUser?.name || 'Raghuveer'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate leading-tight">
                        {currentUser?.role || 'Data Analyst'}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-[#111C2E] transition-colors cursor-pointer"
                    title="Sign out"
                    aria-label="Sign out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
