import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import {
  Database,
  Server,
  Cloud,
  HardDrive,
  Layers,
  Lock,
  KeyRound,
  Play,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import apiClient from '../../services/apiClient';

const SOURCE_TYPES = [
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    category: 'Relational Database',
    description: 'Postgres 12+ relational database with schema support',
    badge: 'SQL',
    badgeColor: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border-sky-200 dark:border-sky-800',
    defaultPort: '5432',
    icon: Database
  },
  {
    id: 'mysql',
    name: 'MySQL',
    category: 'Relational Database',
    description: 'MySQL 5.7+ and MariaDB transactional storage',
    badge: 'SQL',
    badgeColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    defaultPort: '3306',
    icon: Database
  },
  {
    id: 'sqlserver',
    name: 'Microsoft SQL Server',
    category: 'Enterprise RDBMS',
    description: 'MS SQL Server & Azure SQL with multi-database support',
    badge: 'Enterprise',
    badgeColor: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
    defaultPort: '1433',
    icon: Server
  },
  {
    id: 'snowflake',
    name: 'Snowflake',
    category: 'Cloud Data Warehouse',
    description: 'Snowflake analytics warehouse with multi-cluster compute',
    badge: 'Warehouse',
    badgeColor: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
    defaultPort: '',
    icon: Cloud
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'NoSQL Document Store',
    description: 'MongoDB replica sets, sharded clusters & Atlas',
    badge: 'Document',
    badgeColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    defaultPort: '27017',
    icon: Layers
  },
  {
    id: 's3',
    name: 'Amazon S3',
    category: 'Object Storage Data Lake',
    description: 'AWS S3 buckets with Parquet, CSV, and JSON datasets',
    badge: 'Data Lake',
    badgeColor: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border-orange-200 dark:border-orange-800',
    defaultPort: '',
    icon: HardDrive
  }
];

const AWS_REGIONS = [
  { id: 'us-east-1', name: 'US East (N. Virginia) — us-east-1' },
  { id: 'us-east-2', name: 'US East (Ohio) — us-east-2' },
  { id: 'us-west-1', name: 'US West (N. California) — us-west-1' },
  { id: 'us-west-2', name: 'US West (Oregon) — us-west-2' },
  { id: 'eu-west-1', name: 'EU (Ireland) — eu-west-1' },
  { id: 'eu-central-1', name: 'EU (Frankfurt) — eu-central-1' },
  { id: 'ap-south-1', name: 'Asia Pacific (Mumbai) — ap-south-1' },
  { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore) — ap-southeast-1' },
  { id: 'ap-northeast-1', name: 'Asia Pacific (Tokyo) — ap-northeast-1' }
];

export default function AddDataSourceModal({
  isOpen,
  onClose,
  onSuccess
}) {
  const [selectedType, setSelectedType] = useState('postgresql');
  const [connectionMode, setConnectionMode] = useState('fields'); // 'fields' | 'url'
  const [connectionUrl, setConnectionUrl] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('5432');
  const [database, setDatabase] = useState('analytics_db');
  const [schema, setSchema] = useState('public');
  const [username, setUsername] = useState('postgres');
  const [password, setPassword] = useState('');
  const [ssl, setSsl] = useState(false);
  const [connectTimeout, setConnectTimeout] = useState('5000');
  const [tags, setTags] = useState('production, warehouse');

  // SQL Server specific
  const [trustServerCertificate, setTrustServerCertificate] = useState(true);
  const [encrypt, setEncrypt] = useState(true);
  const [sqlServerInstanceName, setSqlServerInstanceName] = useState('');
  const [sqlServerAuthType, setSqlServerAuthType] = useState('sql'); // 'sql' | 'windows'
  const [sqlServerDomain, setSqlServerDomain] = useState('');

  // Snowflake specific
  const [account, setAccount] = useState('');
  const [warehouse, setWarehouse] = useState('COMPUTE_WH');
  const [role, setRole] = useState('ACCOUNTADMIN');
  const [snowflakeAuthMethod, setSnowflakeAuthMethod] = useState('password'); // 'password' | 'keypair'
  const [privateKey, setPrivateKey] = useState('');
  const [privateKeyPassphrase, setPrivateKeyPassphrase] = useState('');
  const [clientSessionKeepAlive, setClientSessionKeepAlive] = useState(false);
  const [showPrivateKeyPassphrase, setShowPrivateKeyPassphrase] = useState(false);

  // MongoDB specific
  const [authSource, setAuthSource] = useState('admin');
  const [authMechanism, setAuthMechanism] = useState('');
  const [replicaSet, setReplicaSet] = useState('');

  // S3 specific
  const [region, setRegion] = useState('us-east-1');
  const [bucket, setBucket] = useState('');
  const [prefix, setPrefix] = useState('data/');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');

  // Live Test State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success: boolean, latencyMs?: number, message?: string, error?: string }

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Reset or initialize when modal opens or type changes
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTestResult(null);
      setFormErrors({});
    }
  }, [isOpen]);

  const handleTypeSelect = (typeId) => {
    setSelectedType(typeId);
    setTestResult(null);
    setFormErrors({});
    const typeObj = SOURCE_TYPES.find(t => t.id === typeId);
    if (typeObj?.defaultPort) {
      setPort(typeObj.defaultPort);
    }

    if (typeId === 'postgresql') {
      if (!name || name.includes('MySQL') || name.includes('Snowflake') || name.includes('MongoDB') || name.includes('S3') || name.includes('SQL Server')) {
        setName('Postgres Analytics Primary');
      }
      setDatabase('analytics_db');
      setSchema('public');
      setUsername('postgres');
    } else if (typeId === 'mysql') {
      if (!name || name.includes('Postgres') || name.includes('Snowflake') || name.includes('MongoDB') || name.includes('S3') || name.includes('SQL Server')) {
        setName('MySQL Commerce DB');
      }
      setDatabase('commerce_db');
      setUsername('root');
    } else if (typeId === 'sqlserver') {
      if (!name || name.includes('Postgres') || name.includes('MySQL') || name.includes('Snowflake') || name.includes('MongoDB') || name.includes('S3')) {
        setName('SQL Server Enterprise ERP');
      }
      setDatabase('master');
      setSchema('dbo');
      setUsername('sa');
      setPort('1433');
      setConnectTimeout('15000');
    } else if (typeId === 'snowflake') {
      if (!name || name.includes('Postgres') || name.includes('MySQL') || name.includes('MongoDB') || name.includes('S3') || name.includes('SQL Server')) {
        setName('Snowflake Enterprise Data Warehouse');
      }
      setDatabase('ANALYTICS_DW');
      setSchema('PUBLIC');
      setWarehouse('COMPUTE_WH');
      setRole('ACCOUNTADMIN');
      setUsername('');
      setPassword('');
      setConnectTimeout('15000');
    } else if (typeId === 'mongodb') {
      if (!name || name.includes('Postgres') || name.includes('MySQL') || name.includes('Snowflake') || name.includes('S3') || name.includes('SQL Server')) {
        setName('MongoDB Customer Collections');
      }
      setDatabase('customer_store');
      setAuthSource('admin');
      setUsername('');
      setPassword('');
      setReplicaSet('');
      setAuthMechanism('');
    } else if (typeId === 's3') {
      if (!name || name.includes('Postgres') || name.includes('MySQL') || name.includes('Snowflake') || name.includes('MongoDB') || name.includes('SQL Server')) {
        setName('AWS S3 Raw Events Lake');
      }
      setBucket('ricoz-analytics-datalake');
      setPrefix('raw/events/');
    }
  };

  // Build configuration and credentials objects
  const buildPayload = () => {
    let configuration = {};
    let credentials = {};

    if (selectedType === 'postgresql') {
      configuration = {
        host: host.trim(),
        port: parseInt(port, 10) || 5432,
        database: database.trim() || 'postgres',
        schema: schema.trim() || 'public',
        ssl: Boolean(ssl),
        connectTimeout: parseInt(connectTimeout, 10) || 5000
      };
      if (username) credentials.username = username.trim();
      if (password !== undefined && password !== null && password !== '') credentials.password = String(password);
    } else if (selectedType === 'mysql') {
      configuration = {
        host: host.trim(),
        port: parseInt(port, 10) || 3306,
        database: database.trim() || 'mysql',
        ssl: Boolean(ssl),
        connectTimeout: parseInt(connectTimeout, 10) || 5000
      };
      if (username) credentials.username = username.trim();
      if (password !== undefined && password !== null && password !== '') credentials.password = String(password);
    } else if (selectedType === 'sqlserver') {
      configuration = {
        host: host.trim(),
        port: parseInt(port, 10) || 1433,
        database: database.trim() || 'master',
        schema: schema.trim() || 'dbo',
        instanceName: sqlServerInstanceName.trim() || undefined,
        authType: sqlServerAuthType,
        domain: sqlServerDomain.trim() || undefined,
        trustServerCertificate: Boolean(trustServerCertificate),
        encrypt: Boolean(encrypt),
        connectTimeout: parseInt(connectTimeout, 10) || 15000
      };
      if (username) credentials.username = username.trim();
      if (password !== undefined && password !== null && password !== '') credentials.password = String(password);
    } else if (selectedType === 'snowflake') {
      configuration = {
        account: account.trim(),
        warehouse: warehouse.trim() || undefined,
        database: database.trim() || undefined,
        schema: schema.trim() || undefined,
        role: role.trim() || undefined,
        authMethod: snowflakeAuthMethod,
        clientSessionKeepAlive: Boolean(clientSessionKeepAlive),
        connectTimeout: parseInt(connectTimeout, 10) || 15000
      };
      if (username) credentials.username = username.trim();
      if (snowflakeAuthMethod === 'keypair') {
        if (privateKey) credentials.privateKey = privateKey.trim();
        if (privateKeyPassphrase) credentials.privateKeyPassphrase = privateKeyPassphrase;
      } else {
        if (password !== undefined && password !== null && password !== '') credentials.password = String(password);
      }
    } else if (selectedType === 'mongodb') {
      configuration = {
        host: host.trim(),
        port: parseInt(port, 10) || 27017,
        database: database.trim() || 'customer_store',
        authSource: authSource.trim() || 'admin',
        ssl: Boolean(ssl),
        connectTimeout: parseInt(connectTimeout, 10) || 5000
      };
      if (replicaSet.trim()) configuration.replicaSet = replicaSet.trim();
      if (authMechanism.trim()) configuration.authMechanism = authMechanism.trim();
      if (connectionMode === 'url' && connectionUrl.trim()) {
        configuration.connectionUrl = connectionUrl.trim();
        configuration.uri = connectionUrl.trim();
      }
      if (username) credentials.username = username.trim();
      if (password !== undefined && password !== null && password !== '') credentials.password = String(password);
    } else if (selectedType === 's3') {
      configuration = {
        region: region.trim(),
        bucket: bucket.trim(),
        prefix: prefix.trim()
      };
      if (accessKeyId) credentials.accessKeyId = accessKeyId.trim();
      if (secretAccessKey) credentials.secretAccessKey = secretAccessKey.trim();
    }

    const payload = {
      name: name.trim(),
      type: selectedType,
      description: description.trim(),
      configuration,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
    };

    if (Object.keys(credentials).length > 0) {
      payload.credentials = credentials;
    }

    return payload;
  };

  const validateForm = () => {
    const errors = {};
    if (!name.trim()) errors.name = 'Data Source name is required';

    if (selectedType === 'snowflake') {
      if (!account.trim()) errors.account = 'Snowflake Account identifier is required (e.g. xy12345.us-east-1 or orgname-accountname)';
      if (!username.trim()) errors.username = 'Username is required to authenticate with Snowflake';
      if (snowflakeAuthMethod === 'keypair') {
        if (!privateKey.trim()) errors.privateKey = 'Private key (PEM PKCS#8 format) is required for Key-Pair authentication';
      } else {
        if (!password || (typeof password === 'string' && !password.trim())) {
          errors.password = 'Password is required to authenticate with Snowflake';
        }
      }
    } else if (selectedType === 's3') {
      if (!bucket.trim()) errors.bucket = 'Bucket name is required';
      if (!region.trim()) errors.region = 'Region is required';
    } else {
      if (!host.trim()) errors.host = 'Host is required';
      if (!port) {
        errors.port = 'Port is required';
      } else {
        const portNum = parseInt(port, 10);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
          errors.port = 'Port must be between 1 and 65535';
        }
      }
      if (selectedType === 'postgresql') {
        if (!username.trim()) errors.username = 'Username is required';
        if (!password || (typeof password === 'string' && !password.trim())) {
          errors.password = 'Password is required to authenticate with PostgreSQL';
        }
      } else if (selectedType === 'sqlserver') {
        if (!username.trim()) {
          errors.username = sqlServerAuthType === 'windows'
            ? 'Windows Username is required'
            : 'Username is required for SQL Server authentication';
        }
        if (!password || (typeof password === 'string' && !password.trim())) {
          errors.password = sqlServerAuthType === 'windows'
            ? 'Windows Password is required'
            : 'Password is required for SQL Server authentication';
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Live Test Connection before saving
  const handleTestConnection = async () => {
    if (!validateForm()) return;
    setIsTesting(true);
    setTestResult(null);

    const payload = buildPayload();

    try {
      // Test directly via transient endpoint without polluting database before user clicks Save
      const testRes = await apiClient.post('/data-sources/test', payload);
      if (testRes.success) {
        setTestResult({
          success: true,
          latencyMs: testRes.data?.latencyMs || 12,
          status: testRes.data?.status || 'HEALTHY',
          message: `Successfully connected to ${selectedType.toUpperCase()}! Latency: ${testRes.data?.latencyMs || 12}ms.`
        });
      } else {
        setTestResult({
          success: false,
          error: testRes.error?.message || testRes.message || testRes.data?.error || 'Connection failed on remote host.',
          details: testRes.data?.details
        });
      }
    } catch (err) {
      setTestResult({
        success: false,
        error: err.response?.data?.message || err.message || 'Connection test failed.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setTestResult(null);

    const payload = buildPayload();

    try {
      const res = await apiClient.post('/data-sources', payload);
      if (res.success) {
        if (typeof onSuccess === 'function') {
          onSuccess(res.data);
        }
        onClose();
      } else {
        setFormErrors({ submit: res.error?.message || 'Failed to save data source' });
      }
    } catch (err) {
      setFormErrors({ submit: err.response?.data?.message || err.message || 'Failed to register data source' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeTypeObj = SOURCE_TYPES.find(t => t.id === selectedType) || SOURCE_TYPES[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Enterprise Data Source"
      subtitle="Connect database engines, warehouses, and object stores with AES-256-GCM envelope encryption."
      maxWidth="max-w-3xl"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={isTesting ? RefreshCw : Play}
              disabled={isTesting || isSubmitting}
              onClick={handleTestConnection}
            >
              {isTesting ? 'Testing Connection...' : 'Test Connection'}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={isTesting}
              onClick={handleSave}
            >
              Save Data Source
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5 text-xs">
        {/* Step 1: Select Connector Type */}
        <div>
          <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">
            1. Select Data Source Engine
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {SOURCE_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => handleTypeSelect(type.id)}
                  className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 shadow-xs ring-1 ring-blue-500'
                      : 'border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className={`p-1.5 rounded-md ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${type.badgeColor}`}>
                      {type.badge}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white text-xs">{type.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">{type.category}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Connection Mode Selector (for SQL/Mongo) */}
        {(selectedType === 'postgresql' || selectedType === 'mysql' || selectedType === 'mongodb') && (
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#1D3047] pb-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
              2. Connection Configuration
            </span>
            <div className="inline-flex rounded-md border border-slate-200 dark:border-[#1D3047] p-0.5 bg-slate-50 dark:bg-[#111C2E]">
              <button
                type="button"
                onClick={() => setConnectionMode('fields')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  connectionMode === 'fields'
                    ? 'bg-white dark:bg-[#0D1828] text-blue-600 dark:text-blue-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Structured Fields
              </button>
              <button
                type="button"
                onClick={() => setConnectionMode('url')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                  connectionMode === 'url'
                    ? 'bg-white dark:bg-[#0D1828] text-blue-600 dark:text-blue-400 font-semibold shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Connection URI / URL
              </button>
            </div>
          </div>
        )}

        {/* General Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Data Source Display Name *"
            placeholder="e.g. Analytics Postgres Primary"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={formErrors.name}
            required
          />

          <Input
            label="Environment / Tags"
            placeholder="e.g. production, warehouse, analytics"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            helperText="Comma-separated labels for catalog governance"
          />
        </div>

        <Input
          label="Description"
          placeholder="e.g. Primary read replica for data science and executive BI dashboards"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* Dynamic Fields: Connection URL Mode */}
        {connectionMode === 'url' && (selectedType === 'postgresql' || selectedType === 'mysql' || selectedType === 'mongodb') ? (
          <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white text-[11px]">
                {activeTypeObj.name} Connection URI
              </span>
              <span className="text-[10px] text-slate-400">URI credentials will be encrypted</span>
            </div>
            <Input
              placeholder={
                selectedType === 'postgresql'
                  ? 'postgresql://user:password@host:5432/dbname?sslmode=require'
                  : selectedType === 'mysql'
                  ? 'mysql://user:password@host:3306/dbname'
                  : 'mongodb+srv://user:password@cluster.mongodb.net/dbname?retryWrites=true'
              }
              value={connectionUrl}
              onChange={(e) => {
                const val = e.target.value;
                setConnectionUrl(val);
                // Attempt optimistic URI parsing
                try {
                  if (val.startsWith('postgres') || val.startsWith('mysql')) {
                    const u = new URL(val);
                    if (u.hostname) setHost(u.hostname);
                    if (u.port) setPort(u.port);
                    if (u.pathname) setDatabase(u.pathname.replace(/^\//, ''));
                    if (u.username) setUsername(decodeURIComponent(u.username));
                    if (u.password) setPassword(decodeURIComponent(u.password));
                  } else if (val.startsWith('mongodb')) {
                    const cleanVal = val.replace(/^mongodb(\+srv)?:\/\//, '');
                    const atIdx = cleanVal.indexOf('@');
                    let hostPortPart = cleanVal;
                    if (atIdx !== -1) {
                      const authPart = cleanVal.slice(0, atIdx);
                      hostPortPart = cleanVal.slice(atIdx + 1);
                      const colonIdx = authPart.indexOf(':');
                      if (colonIdx !== -1) {
                        setUsername(decodeURIComponent(authPart.slice(0, colonIdx)));
                        setPassword(decodeURIComponent(authPart.slice(colonIdx + 1)));
                      } else {
                        setUsername(decodeURIComponent(authPart));
                      }
                    }
                    const slashIdx = hostPortPart.indexOf('/');
                    let hostPort = slashIdx !== -1 ? hostPortPart.slice(0, slashIdx) : hostPortPart;
                    const rest = slashIdx !== -1 ? hostPortPart.slice(slashIdx + 1) : '';
                    const qIdx = rest.indexOf('?');
                    const db = qIdx !== -1 ? rest.slice(0, qIdx) : rest;
                    if (db) setDatabase(decodeURIComponent(db));

                    if (qIdx !== -1) {
                      const queryParams = new URLSearchParams(rest.slice(qIdx + 1));
                      if (queryParams.has('authSource')) setAuthSource(queryParams.get('authSource'));
                      if (queryParams.has('replicaSet')) setReplicaSet(queryParams.get('replicaSet'));
                    }

                    if (hostPort.includes(':')) {
                      const [h, p] = hostPort.split(':');
                      if (h) setHost(h);
                      if (p) setPort(p.split(',')[0]);
                    } else if (hostPort) {
                      setHost(hostPort);
                    }
                  }
                } catch {
                  // Ignore parse errors while typing
                }
              }}
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Paste standard connection strings. The host and credentials will be parsed and encrypted.
            </p>
          </div>
        ) : (
          /* Dynamic Fields: Structured Fields Mode */
          <div className="space-y-3.5">
            {/* 1. PostgreSQL */}
            {selectedType === 'postgresql' && (
              <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
                <div className="font-semibold text-slate-900 dark:text-white text-[11px] flex items-center justify-between">
                  <span>PostgreSQL Network & Schema Parameters</span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 font-medium">Default Port: 5432</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Host / Server *"
                      placeholder="db.internal or 10.0.1.20"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      error={formErrors.host}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Port *"
                      placeholder="5432"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      error={formErrors.port}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Database Name"
                    placeholder="analytics_db"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                  />
                  <Input
                    label="Schema Name"
                    placeholder="public"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    helperText="Default: public"
                  />
                  <Input
                    label="Timeout (ms)"
                    placeholder="5000"
                    value={connectTimeout}
                    onChange={(e) => setConnectTimeout(e.target.value)}
                    helperText="Default: 5000ms"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="pg-ssl-toggle"
                    checked={ssl}
                    onChange={(e) => setSsl(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="pg-ssl-toggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                    Enable TLS/SSL encryption for network transit
                  </label>
                </div>
              </div>
            )}

            {/* 2. MySQL */}
            {selectedType === 'mysql' && (
              <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
                <div className="font-semibold text-slate-900 dark:text-white text-[11px] flex items-center justify-between">
                  <span>MySQL Network Parameters</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Default Port: 3306</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Host / Server *"
                      placeholder="mysql.internal or 127.0.0.1"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      error={formErrors.host}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Port *"
                      placeholder="3306"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      error={formErrors.port}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Database Name"
                    placeholder="commerce_db"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    helperText="Target database to introspect and query"
                  />
                  <Input
                    label="Timeout (ms)"
                    placeholder="5000"
                    value={connectTimeout}
                    onChange={(e) => setConnectTimeout(e.target.value)}
                    helperText="Default: 5000ms"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="mysql-ssl-toggle"
                    checked={ssl}
                    onChange={(e) => setSsl(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="mysql-ssl-toggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                    Require SSL/TLS encrypted connection
                  </label>
                </div>
              </div>
            )}

            {/* 3. SQL Server */}
            {selectedType === 'sqlserver' && (
              <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
                <div className="font-semibold text-slate-900 dark:text-white text-[11px] flex items-center justify-between">
                  <span>Microsoft SQL Server Parameters</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">Default Port: 1433</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Server / Host *"
                      placeholder="sqlserver.internal or localhost"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      error={formErrors.host}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Port *"
                      placeholder="1433"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      error={formErrors.port}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Instance Name (Optional)"
                    placeholder="e.g. SQLEXPRESS"
                    value={sqlServerInstanceName}
                    onChange={(e) => setSqlServerInstanceName(e.target.value)}
                    helperText="Named instance if applicable"
                  />
                  <Input
                    label="Database Name"
                    placeholder="erp_enterprise or master"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                  />
                  <Input
                    label="Schema Name"
                    placeholder="dbo"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                    helperText="Default: dbo"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Connection Timeout (ms)"
                    placeholder="15000"
                    value={connectTimeout}
                    onChange={(e) => setConnectTimeout(e.target.value)}
                    helperText="Default: 15000ms"
                  />
                  <div className="flex flex-col justify-center space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={trustServerCertificate}
                        onChange={(e) => setTrustServerCertificate(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Trust Server Certificate (Self-signed)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={encrypt}
                        onChange={(e) => setEncrypt(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Encrypt Connection</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Snowflake */}
            {selectedType === 'snowflake' && (
              <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
                <div className="font-semibold text-slate-900 dark:text-white text-[11px] flex items-center justify-between">
                  <span>Snowflake Cloud Data Warehouse Parameters</span>
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium">Cloud Native</span>
                </div>
                <Input
                  label="Snowflake Account Identifier *"
                  placeholder="e.g. xy12345.us-east-1 or orgname-accountname"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  error={formErrors.account}
                  helperText="Your Snowflake full account locator or organization-account identifier"
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Warehouse"
                    placeholder="COMPUTE_WH"
                    value={warehouse}
                    onChange={(e) => setWarehouse(e.target.value)}
                  />
                  <Input
                    label="Database"
                    placeholder="ANALYTICS_DW"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Schema"
                    placeholder="PUBLIC"
                    value={schema}
                    onChange={(e) => setSchema(e.target.value)}
                  />
                  <Input
                    label="Role"
                    placeholder="ACCOUNTADMIN or DATA_ANALYST"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Connection Timeout (ms)"
                    placeholder="15000"
                    value={connectTimeout}
                    onChange={(e) => setConnectTimeout(e.target.value)}
                    helperText="Default: 15000ms"
                  />
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="sf-keepalive-toggle"
                      checked={clientSessionKeepAlive}
                      onChange={(e) => setClientSessionKeepAlive(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="sf-keepalive-toggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                      Enable Client Session Keep Alive
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* 5. MongoDB */}
            {selectedType === 'mongodb' && (
              <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
                <div className="font-semibold text-slate-900 dark:text-white text-[11px] flex items-center justify-between">
                  <span>MongoDB Cluster Parameters</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Default Port: 27017</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <Input
                      label="Host / Replica Set *"
                      placeholder="cluster0.mongodb.net or localhost"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      error={formErrors.host}
                      required
                    />
                  </div>
                  <div>
                    <Input
                      label="Port *"
                      placeholder="27017"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      error={formErrors.port}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Database Name"
                    placeholder="customer_store"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    helperText="Target MongoDB database"
                  />
                  <Input
                    label="Auth Source Database"
                    placeholder="admin"
                    value={authSource}
                    onChange={(e) => setAuthSource(e.target.value)}
                    helperText="Authentication DB (usually admin)"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label="Replica Set Name"
                    placeholder="rs0 (optional)"
                    value={replicaSet}
                    onChange={(e) => setReplicaSet(e.target.value)}
                    helperText="For replica set clusters"
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Auth Mechanism
                    </label>
                    <select
                      value={authMechanism}
                      onChange={(e) => setAuthMechanism(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="">Default (SCRAM)</option>
                      <option value="SCRAM-SHA-256">SCRAM-SHA-256</option>
                      <option value="SCRAM-SHA-1">SCRAM-SHA-1</option>
                      <option value="MONGODB-CR">MONGODB-CR</option>
                    </select>
                  </div>
                  <Input
                    label="Timeout (ms)"
                    placeholder="5000"
                    value={connectTimeout}
                    onChange={(e) => setConnectTimeout(e.target.value)}
                    helperText="Default: 5000ms"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="mongo-ssl-toggle"
                    checked={ssl}
                    onChange={(e) => setSsl(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 dark:border-slate-700 focus:ring-blue-500 cursor-pointer"
                  />
                  <label htmlFor="mongo-ssl-toggle" className="text-xs text-slate-700 dark:text-slate-300 cursor-pointer font-medium">
                    Require TLS/SSL encrypted connection
                  </label>
                </div>
              </div>
            )}

            {/* 6. Amazon S3 */}
            {selectedType === 's3' && (
              <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
                <div className="font-semibold text-slate-900 dark:text-white text-[11px] flex items-center justify-between">
                  <span>Amazon S3 Object Storage Parameters</span>
                  <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">AWS IAM Authentication</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      AWS Region *
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      {AWS_REGIONS.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="S3 Bucket Name *"
                    placeholder="e.g. company-data-lake-prod"
                    value={bucket}
                    onChange={(e) => setBucket(e.target.value)}
                    error={formErrors.bucket}
                    required
                  />
                </div>
                <Input
                  label="Prefix / Folder Path"
                  placeholder="e.g. raw/events/ or warehouse/sales/"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  helperText="Optional subdirectory filter to discover specific dataset directories"
                />
              </div>
            )}

            {/* Credentials Section */}
            <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
              <div className="font-semibold text-slate-900 dark:text-white text-[11px] flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-blue-500" />
                  <span>Authentication Credentials</span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  AES-256-GCM Encrypted
                </span>
              </div>

              {selectedType === 'snowflake' && (
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-[#0D1828] rounded-lg w-fit">
                  <button
                    type="button"
                    onClick={() => setSnowflakeAuthMethod('password')}
                    className={`px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
                      snowflakeAuthMethod === 'password'
                        ? 'bg-white dark:bg-[#1E293B] text-cyan-600 dark:text-cyan-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Password Authentication
                  </button>
                  <button
                    type="button"
                    onClick={() => setSnowflakeAuthMethod('keypair')}
                    className={`px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
                      snowflakeAuthMethod === 'keypair'
                        ? 'bg-white dark:bg-[#1E293B] text-cyan-600 dark:text-cyan-400 shadow-2xs font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Key-Pair Authentication (RSA)
                  </button>
                </div>
              )}

              {selectedType === 'sqlserver' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-[#0D1828] rounded-lg w-fit">
                    <button
                      type="button"
                      onClick={() => setSqlServerAuthType('sql')}
                      className={`px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
                        sqlServerAuthType === 'sql'
                          ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      SQL Server Authentication
                    </button>
                    <button
                      type="button"
                      onClick={() => setSqlServerAuthType('windows')}
                      className={`px-3 py-1 text-xs font-medium rounded cursor-pointer transition-colors ${
                        sqlServerAuthType === 'windows'
                          ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      Windows / Domain Authentication (NTLM)
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {sqlServerAuthType === 'sql'
                      ? 'Authenticate with SQL Server instance credentials (e.g. sa).'
                      : 'Authenticate with Windows Active Directory / Domain credentials via NTLM.'}
                  </p>
                </div>
              )}

              {selectedType === 'snowflake' && snowflakeAuthMethod === 'keypair' ? (
                <div className="space-y-3">
                  <Input
                    label="Snowflake Username *"
                    placeholder="e.g. DATA_ENG_USER"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    error={formErrors.username}
                    required
                  />
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Private Key (PKCS#8 PEM format) *
                    </label>
                    <textarea
                      rows={4}
                      value={privateKey}
                      onChange={(e) => setPrivateKey(e.target.value)}
                      placeholder="-----BEGIN ENCRYPTED PRIVATE KEY-----&#10;MIIFDjBABgkqhkiG9w0BBQ0wMzAbBgkqhkiG9w0BBQwwDgQI...&#10;-----END ENCRYPTED PRIVATE KEY-----"
                      className="w-full font-mono text-xs rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-slate-900 dark:text-white p-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    {formErrors.privateKey && (
                      <p className="text-xs text-rose-500 mt-1">{formErrors.privateKey}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      PKCS#8 PEM-encoded private key associated with your Snowflake user's public key.
                    </p>
                  </div>
                  <div>
                    <div className="relative">
                      <Input
                        label="Private Key Passphrase (optional)"
                        type={showPrivateKeyPassphrase ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={privateKeyPassphrase}
                        onChange={(e) => setPrivateKeyPassphrase(e.target.value)}
                        helperText="Required only if your private key is passphrase-encrypted"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPrivateKeyPassphrase(!showPrivateKeyPassphrase)}
                        className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                        tabIndex={-1}
                        aria-label={showPrivateKeyPassphrase ? 'Hide passphrase' : 'Show passphrase'}
                      >
                        {showPrivateKeyPassphrase ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedType === 's3' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="AWS Access Key ID"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    value={accessKeyId}
                    onChange={(e) => setAccessKeyId(e.target.value)}
                  />
                  <div>
                    <div className="relative">
                      <Input
                        label="AWS Secret Access Key"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                        value={secretAccessKey}
                        onChange={(e) => setSecretAccessKey(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide Secret Key' : 'Show Secret Key'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedType === 'sqlserver' && sqlServerAuthType === 'windows' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="Domain (Optional)"
                      placeholder="e.g. CORP or AD"
                      value={sqlServerDomain}
                      onChange={(e) => setSqlServerDomain(e.target.value)}
                      helperText="Active Directory / NetBIOS domain"
                    />
                    <Input
                      label="Windows Username *"
                      placeholder="e.g. svc_ricoz"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      error={formErrors.username}
                      required
                    />
                    <div>
                      <div className="relative">
                        <Input
                          label="Password *"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          error={formErrors.password}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                          tabIndex={-1}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-[11px] text-amber-800 dark:text-amber-300">
                    <strong>Note on Windows Authentication:</strong> Authenticates Windows accounts via NTLM handshake with domain, username, and password. Native Kerberos SSPI single-sign-on without credentials is not supported in cross-platform Node.js environments.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label={selectedType === 'sqlserver' ? 'SQL Server Username' : 'Username'}
                    placeholder={selectedType === 'sqlserver' ? 'sa' : 'db_admin'}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    error={formErrors.username}
                  />
                  <div>
                    <div className="relative">
                      <Input
                        label="Password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={formErrors.password}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Live Test Connection Result Banner */}
        {testResult && (
          <div
            className={`p-3.5 rounded-lg border text-xs space-y-1 ${
              testResult.success
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200'
            }`}
          >
            <div className="font-bold flex items-center gap-1.5">
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{testResult.success ? 'Connection Succeeded' : 'Connection Failed'}</span>
              {testResult.latencyMs != null && (
                <span className="font-normal font-mono text-[11px] ml-auto">
                  {testResult.latencyMs}ms latency
                </span>
              )}
            </div>
            <p className="text-[11px] pl-5.5 opacity-90">
              {testResult.success ? testResult.message : testResult.error}
            </p>
          </div>
        )}

        {/* Submission Error Banner */}
        {formErrors.submit && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-800 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
            <span>{formErrors.submit}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
