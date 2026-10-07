import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import {
  Database,
  Server,
  Cloud,
  Layers,
  HardDrive,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle
} from 'lucide-react';
import apiClient from '../../services/apiClient';

export default function EditDataSourceModal({
  isOpen,
  onClose,
  dataSource,
  onSuccess
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [database, setDatabase] = useState('');
  const [schema, setSchema] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('ACTIVE');

  // Snowflake
  const [account, setAccount] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [role, setRole] = useState('');

  // SQL Server
  const [instanceName, setInstanceName] = useState('');

  // S3
  const [region, setRegion] = useState('');
  const [bucket, setBucket] = useState('');
  const [prefix, setPrefix] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && dataSource) {
      setName(dataSource.name || '');
      setDescription(dataSource.description || '');
      setStatus(dataSource.status || 'ACTIVE');
      setTags(Array.isArray(dataSource.tags) ? dataSource.tags.join(', ') : '');

      const cfg = dataSource.configuration || dataSource.connectionConfig || {};
      setHost(cfg.host || '');
      setPort(cfg.port ? String(cfg.port) : '');
      setDatabase(cfg.database || '');
      setSchema(cfg.schema || '');
      setAccount(cfg.account || '');
      setWarehouse(cfg.warehouse || '');
      setRole(cfg.role || '');
      setRegion(cfg.region || 'us-east-1');
      setBucket(cfg.bucket || '');
      setPrefix(cfg.prefix || '');
      setInstanceName(cfg.instanceName || '');

      // Password and secrets are never populated back to client for security
      setPassword('');
      setSecretAccessKey('');
      setUsername('');
      setAccessKeyId('');
      setError(null);
    }
  }, [isOpen, dataSource]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!dataSource) return;

    setIsSubmitting(true);
    setError(null);

    const dsId = dataSource._id || dataSource.id;
    const type = dataSource.type;

    let configuration = { ...(dataSource.configuration || {}) };

    if (type === 'snowflake') {
      configuration.account = account.trim();
      configuration.warehouse = warehouse.trim();
      configuration.database = database.trim();
      configuration.schema = schema.trim();
      configuration.role = role.trim();
    } else if (type === 's3') {
      configuration.region = region.trim();
      configuration.bucket = bucket.trim();
      configuration.prefix = prefix.trim();
    } else {
      if (host) configuration.host = host.trim();
      if (port) configuration.port = parseInt(port, 10);
      if (database) configuration.database = database.trim();
      if (schema) configuration.schema = schema.trim();
      if (type === 'sqlserver') {
        configuration.instanceName = instanceName.trim() || undefined;
      }
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      status,
      configuration,
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
    };

    // Include credentials only if user explicitly typed new credentials to rotate
    if (type === 's3') {
      if (accessKeyId || secretAccessKey) {
        payload.credentials = {};
        if (accessKeyId) payload.credentials.accessKeyId = accessKeyId.trim();
        if (secretAccessKey) payload.credentials.secretAccessKey = secretAccessKey.trim();
      }
    } else {
      if (username || password) {
        payload.credentials = {};
        if (username) payload.credentials.username = username.trim();
        if (password) payload.credentials.password = password;
      }
    }

    try {
      const res = await apiClient.put(`/data-sources/${dsId}`, payload);
      if (res.success) {
        if (typeof onSuccess === 'function') {
          onSuccess(res.data);
        }
        onClose();
      } else {
        setError(res.error?.message || 'Failed to update data source.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Update failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const type = dataSource?.type || 'postgresql';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Data Source: ${dataSource?.name || ''}`}
      subtitle="Update connection properties, tags, and rotate credentials securely."
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
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
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <div className="space-y-4 text-xs">
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-800 dark:text-rose-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-md border border-slate-200 dark:border-[#1D3047] bg-white dark:bg-[#0D1828] text-xs text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </select>
          </div>
        </div>

        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Input
          label="Tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          helperText="Comma separated values"
        />

        {/* Configuration Parameters */}
        <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
          <div className="font-semibold text-slate-900 dark:text-white text-xs">
            {type.toUpperCase()} Parameters
          </div>

          {type === 'snowflake' ? (
            <div className="space-y-3">
              <Input
                label="Snowflake Account"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Warehouse"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                />
                <Input
                  label="Database"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Schema"
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                />
                <Input
                  label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
            </div>
          ) : type === 's3' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="AWS Region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
                <Input
                  label="S3 Bucket"
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                />
              </div>
              <Input
                label="Prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Input
                    label="Host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div>
                  <Input
                    label="Port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Database"
                  value={database}
                  onChange={(e) => setDatabase(e.target.value)}
                />
                <Input
                  label="Schema"
                  value={schema}
                  onChange={(e) => setSchema(e.target.value)}
                />
              </div>
              {type === 'sqlserver' && (
                <Input
                  label="Instance Name (Optional)"
                  placeholder="e.g. SQLEXPRESS"
                  value={instanceName}
                  onChange={(e) => setInstanceName(e.target.value)}
                  helperText="Named SQL Server instance"
                />
              )}
            </div>
          )}
        </div>

        {/* Rotate Credentials */}
        <div className="p-3.5 bg-slate-50 dark:bg-[#111C2E] rounded-lg border border-slate-200 dark:border-[#1D3047] space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-blue-500" />
              Rotate Credentials (Optional)
            </span>
            <span className="text-[10px] text-slate-400">Leave blank to retain existing credentials</span>
          </div>

          {type === 's3' ? (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="New AWS Access Key ID"
                placeholder="Leave blank to keep unchanged"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
              />
              <Input
                label="New AWS Secret Access Key"
                type="password"
                placeholder="Leave blank to keep unchanged"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="New Username"
                placeholder="Leave blank to keep unchanged"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <div className="relative">
                <Input
                  label="New Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Leave blank to keep unchanged"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
