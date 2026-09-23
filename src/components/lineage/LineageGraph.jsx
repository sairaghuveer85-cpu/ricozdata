import React, { useMemo, useEffect } from 'react';
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
import { INITIAL_LINEAGE_NODES, INITIAL_LINEAGE_EDGES } from '../../data/lineage';

const nodeTypes = {
  customLineageNode: LineageNode,
};

function FlowComponent({ onSelectNode, datasetId }) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const { getDatasetLineage } = useApp();

  const lineageData = useMemo(() => {
    if (getDatasetLineage && datasetId) {
      return getDatasetLineage(datasetId);
    }
    return { nodes: INITIAL_LINEAGE_NODES, edges: INITIAL_LINEAGE_EDGES };
  }, [getDatasetLineage, datasetId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(lineageData.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(lineageData.edges);

  useEffect(() => {
    setNodes(lineageData.nodes);
    setEdges(lineageData.edges);
  }, [lineageData, setNodes, setEdges]);

  const themedEdges = useMemo(() => {
    return edges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        stroke: e.style?.stroke === '#2563eb' && isDark ? '#60a5fa' : e.style?.stroke
      }
    }));
  }, [edges, isDark]);

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
