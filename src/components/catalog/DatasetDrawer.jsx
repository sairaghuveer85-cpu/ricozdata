import React from 'react';
import { useNavigate } from 'react-router-dom';
import Drawer from '../common/Drawer';
import Button from '../common/Button';
import Badge from '../common/Badge';
import {
  Database,
  ExternalLink,
  Share2,
  Layers,
  Columns,
  Shield,
  Eye,
  User,
  Clock,
  Sparkles
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function DatasetDrawer({ dataset, isOpen, onClose }) {
  const navigate = useNavigate();
  const { addToast } = useApp();

  if (!dataset) return null;

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.origin + `/catalog/${dataset.id}`);
    addToast({
      type: 'success',
      title: 'Link copied',
      message: 'Dataset URL copied to clipboard.'
    });
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={dataset.name}
      subtitle={`${dataset.domain} • ${dataset.source}`}
      footer={
        <>
          <Button
            variant="secondary"
            size="sm"
            icon={Share2}
            onClick={handleShare}
          >
            Share
          </Button>
          <Button
            size="sm"
            icon={ExternalLink}
            onClick={() => {
              onClose();
              navigate(`/catalog/${dataset.id}`);
            }}
          >
            Open Full Dataset
          </Button>
        </>
      }
    >
      <div className="space-y-6 text-xs text-slate-600 dark:text-slate-300">
        {/* Status and Health Banner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Badge status={dataset.status} dot size="sm" />
            <span className="text-slate-400">•</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">{dataset.sensitivity}</span>
          </div>
          <div className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
            <span>{dataset.quality}% Quality</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-1.5">
            Description
          </h4>
          <p className="leading-relaxed">
            {dataset.longDescription || dataset.description}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2.5">
            Dataset Metrics
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Layers className="w-3.5 h-3.5" />
                <span>Rows</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{dataset.rows}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Columns className="w-3.5 h-3.5" />
                <span>Columns</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{dataset.columnsCount || 48}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Eye className="w-3.5 h-3.5" />
                <span>Usage</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{dataset.usage || '1.2k views'}</div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-[#111C2E] border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Updated</span>
              </div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{dataset.updated}</div>
            </div>
          </div>
        </div>

        {/* Ownership */}
        <div>
          <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
            Owner & Stewardship
          </h4>
          <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">
              {dataset.owner?.charAt(0) || 'P'}
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">{dataset.owner}</div>
              <div className="text-[11px] text-slate-400">{dataset.ownerRole || 'Data Owner'} • {dataset.domain}</div>
            </div>
          </div>
        </div>

        {/* Tags */}
        {dataset.tags && dataset.tags.length > 0 && (
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] mb-2">
              Classification Tags
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {dataset.tags.map(t => (
                <Badge key={t} variant="tag" size="xs">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}
