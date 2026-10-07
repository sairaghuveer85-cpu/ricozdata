import React, { useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from '@xyflow/react';
import LineageNode from './LineageNode';
import LineageToolbar from './LineageToolbar';
import { useTheme } from '../../context/ThemeContext';
import { useApp } from '../../context/AppContext';
import { GitFork, Loader2 } from 'lucide-react';
import { lineageApi } from '../../services';

const nodeTypes = {
  customLineageNode: LineageNode,
};

function FlowComponent({ onSelectNode, datasetId }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { datasets } = useApp();

  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    let isMounted = true;
    async function fetchLineage() {
      setLoading(true);
      try {
        const targetId = datasetId || datasets[0]?._id || datasets[0]?.id;
        if (!targetId) {
          if (isMounted) {
            setNodes([]);
            setEdges([]);
            setLoading(false);
          }
          return;
        }

        const res = await lineageApi.getLineageForDataset(targetId);
        if (isMounted && res?.success && res.data) {
          setNodes(res.data.nodes || []);
          setEdges(res.data.edges || []);
        } else if (isMounted) {
          setNodes([]);
          setEdges([]);
        }
      } catch (err) {
        console.warn('Failed to load real lineage:', err);
        if (isMounted) {
          setNodes([]);
          setEdges([]);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchLineage();
    return () => { isMounted = false; };
  }, [datasetId, datasets, setNodes, setEdges]);

  const themedEdges = useMemo(() => {
    return edges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        stroke: e.style?.stroke === '#2563eb' && isDark ? '#60a5fa' : e.style?.stroke
      }
    }));
  }, [edges, isDark]);

  if (loading) {
    return (
      <div className="w-full h-[380px] sm:h-[460px] md:h-[520px] bg-white dark:bg-[#07111F] rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col items-center gap-2 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
          <span className="text-xs">Loading verified lineage graph...</span>
        </div>
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <div className="w-full h-[380px] sm:h-[460px] md:h-[520px] bg-white dark:bg-[#07111F] rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-2xs p-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center mx-auto mb-3">
            <GitFork className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No Lineage Recorded</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No pipeline dependencies or transformations are registered for this dataset yet. Lineage will automatically populate when sources and transformation pipelines are synchronized.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[380px] sm:h-[460px] md:h-[520px] bg-white dark:bg-[#07111F] rounded-xl relative border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors shadow-2xs">
      <ReactFlow
        nodes={nodes}
        edges={themedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onSelectNode && onSelectNode(node)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background
          color={isDark ? '#1E3048' : '#CBD5E1'}
          gap={18}
          size={1}
        />
        <LineageToolbar />
      </ReactFlow>
    </div>
  );
}

export default function LineageGraph({ onSelectNode, datasetId }) {
  return (
    <ReactFlowProvider>
      <FlowComponent onSelectNode={onSelectNode} datasetId={datasetId} />
    </ReactFlowProvider>
  );
}
