import React, { useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import {
  User,
  Building2,
  Bell,
  Palette,
  ShieldCheck,
  Blocks,
  Sun,
  Moon,
  Laptop,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export default function Settings() {
  const { currentUser, setCurrentUser, theme, setTheme, addToast } = useApp();

  const [activeSection, setActiveSection] = useState('profile');
  const [profileName, setProfileName] = useState(currentUser?.name || 'Raghuveer C.');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || 'raghuveer@ricozdata.com');
  const [profileRole, setProfileRole] = useState(currentUser?.role || 'Data Analyst');
  const [workspaceName, setWorkspaceName] = useState('RicozData Production');
  const [retentionDays, setRetentionDays] = useState('90');

  // Notification toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(true);
  const [driftAlerts, setDriftAlerts] = useState(true);

  // Appearance
  const [density, setDensity] = useState('compact');

  const handleSaveProfile = (e) => {
    e.preventDefault();
    setCurrentUser(prev => ({
      ...prev,
      name: profileName,
      email: profileEmail,
      role: profileRole
    }));
    addToast({
      title: 'Profile Updated',
      message: 'Your personal information has been saved.',
      type: 'success'
    });
  };

  const handleSaveWorkspace = (e) => {
    e.preventDefault();
    addToast({
      title: 'Workspace Saved',
      message: 'Workspace settings and retention rules have been updated.',
      type: 'success'
    });
  };

  const navSections = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'workspace', label: 'Workspace', icon: Building2 },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security', icon: ShieldCheck },
    { id: 'integrations', label: 'Integrations', icon: Blocks }
  ];

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Settings"
        subtitle="Manage personal preferences, workspace governance rules, and integrations."
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="bg-white dark:bg-[#0B1628] rounded-lg border border-slate-200 dark:border-slate-800 p-1.5 shadow-2xs space-y-0.5">
          {navSections.map(sec => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => setActiveSection(sec.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer text-left ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-900/50'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Pane */}
        <div className="md:col-span-3">
          {/* 1. PROFILE */}
          {activeSection === 'profile' && (
            <div className="bg-white dark:bg-[#0B1628] rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Personal Profile</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage your credentials, role, and avatar</p>
              </div>

              <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className={`w-12 h-12 rounded-full ${currentUser?.avatarBg || 'bg-blue-600'} text-white font-bold text-lg flex items-center justify-center`}>
                  {profileName.trim().charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">{profileName}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{profileRole} • Central Operations</div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-3.5">
                <Input
                  label="Full Name"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={profileEmail}
                  onChange={(e) => setProfileEmail(e.target.value)}
                />
                <Input
                  label="Role Title"
                  value={profileRole}
                  onChange={(e) => setProfileRole(e.target.value)}
                />

                <div className="pt-2">
                  <Button type="submit" size="sm">
                    Save Profile Changes
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 2. WORKSPACE */}
          {activeSection === 'workspace' && (
            <div className="bg-white dark:bg-[#0B1628] rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Workspace Configuration</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage enterprise domain boundaries and governance limits</p>
              </div>

              <form onSubmit={handleSaveWorkspace} className="space-y-3.5">
                <Input
                  label="Workspace Name"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Default Audit Retention (Days)
                  </label>
                  <select
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-2 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="30">30 Days</option>
                    <option value="90">90 Days (Enterprise Standard)</option>
                    <option value="180">180 Days</option>
                    <option value="365">1 Year (SOC 2 Long-term)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Primary Data Center / Cloud Region
                  </label>
                  <select className="w-full rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] p-2 text-xs text-slate-900 dark:text-white">
                    <option>US-East (AWS N. Virginia)</option>
                    <option>EU-Central (Frankfurt)</option>
                    <option>AP-South (Mumbai)</option>
                  </select>
                </div>

                <div className="pt-2">
                  <Button type="submit" size="sm">
                    Save Workspace Config
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* 3. NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <div className="bg-white dark:bg-[#0B1628] rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Alert Notifications</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Control how and when RicozData dispatches incident notifications</p>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs space-y-3">
                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Email Incident Digest</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">Daily executive summary of quality scores and unresolved issues</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="w-4 h-4 rounded-xs text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20 cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Slack Webhook Routing</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">Real-time broadcasts for High Severity violations</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={slackAlerts}
                    onChange={(e) => setSlackAlerts(e.target.checked)}
                    className="w-4 h-4 rounded-xs text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20 cursor-pointer"
                  />
                </div>

                <div className="pt-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Automated Schema Drift Alerts</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">Instant alert when warehouse schema changes violate constraints</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={driftAlerts}
                    onChange={(e) => setDriftAlerts(e.target.checked)}
                    className="w-4 h-4 rounded-xs text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500/20 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4. APPEARANCE: Light, Dark, System */}
          {activeSection === 'appearance' && (
            <div className="bg-white dark:bg-[#0B1628] rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Theme & Appearance</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize UI contrast, dark mode, and layout density</p>
              </div>

              {/* Theme Options: Light, Dark, System */}
              <div>
                <label className="font-semibold text-slate-900 dark:text-white block mb-2.5 text-xs">
                  Interface Theme
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-md border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      theme === 'light'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium">Light Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('system')}
                    className={`p-3 rounded-md border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      theme === 'system'
                        ? 'border-blue-600 bg-blue-50/50 dark:bg-[#111C2E] text-blue-900 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Laptop className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-medium">System Preference</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-md border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-[#111C2E] text-white font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-medium">Dark Mode (#07111F)</span>
                  </button>
                </div>
              </div>

              {/* Display Density */}
              <div>
                <label className="font-semibold text-slate-900 dark:text-white block mb-2 text-xs">
                  Display Data Density
                </label>
                <div className="grid grid-cols-2 gap-3 max-w-sm text-xs">
                  <button
                    type="button"
                    onClick={() => setDensity('compact')}
                    className={`p-2.5 rounded-md border text-left cursor-pointer transition-colors ${
                      density === 'compact'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Compact (Default)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDensity('spacious')}
                    className={`p-2.5 rounded-md border text-left cursor-pointer transition-colors ${
                      density === 'spacious'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Spacious
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. SECURITY */}
          {activeSection === 'security' && (
            <div className="bg-white dark:bg-[#0B1628] rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Security & API Keys</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage two-factor authentication, personal access tokens, and sessions</p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-md bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Two-Factor Authentication (2FA / WebAuthn)</div>
                    <div className="text-slate-500 dark:text-slate-400 text-[11px]">Enforce hardware security key or TOTP authenticator</div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                    Enforced by Policy
                  </span>
                </div>

                <div className="p-3.5 rounded-md bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">Production API Access Token</div>
                    <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px] mt-0.5">
                      rz_live_••••••••••••••••382b
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="xs"
                    icon={RefreshCw}
                    onClick={() =>
                      addToast({
                        title: 'API Token Rotated',
                        message: 'New production API token generated and previous revoked.',
                        type: 'info'
                      })
                    }
                  >
                    Rotate Token
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 6. INTEGRATIONS */}
          {activeSection === 'integrations' && (
            <div className="bg-white dark:bg-[#0B1628] rounded-lg p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Connected Platforms & Connectors</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage bidirectional syncs across cloud data warehouses and catalogs</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { name: 'Snowflake Enterprise', status: 'Connected', type: 'Cloud Warehouse', sync: '14m ago' },
                  { name: 'dbt Cloud', status: 'Connected', type: 'Lineage & Metadata', sync: '30m ago' },
                  { name: 'Google BigQuery', status: 'Connected', type: 'Analytics Warehouse', sync: '1h ago' },
                  { name: 'AWS S3 Data Lake', status: 'Connected', type: 'Object Storage', sync: '2h ago' },
                  { name: 'Tableau Server', status: 'Connected', type: 'BI Consumer', sync: '3h ago' },
                  { name: 'Slack Enterprise', status: 'Active', type: 'Alert Webhooks', sync: 'Real-time' }
                ].map((integ, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-[#111C2E] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{integ.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{integ.type} • Synced {integ.sync}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                      <CheckCircle2 className="w-3 h-3" />
                      {integ.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
