import React, { useState, useMemo } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  Node,
  Edge,
} from 'reactflow';
import CustomFlowNode from './CustomFlowNode';
import { Info } from 'lucide-react';

import 'reactflow/dist/style.css';

interface ReactFlowDiagramProps {
  nodes: Node[];
  edges: Edge[];
}

// Define custom node and edge types outside the component
// This prevents them from being recreated on every render
const nodeTypes = {
  custom: CustomFlowNode,
};

const edgeTypes = {
  // No custom edge types needed, so we define an empty object here
};

export const ReactFlowDiagram: React.FC<ReactFlowDiagramProps> = ({ nodes, edges }) => {
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Add the 'custom' type to all nodes
  const customNodes = useMemo(() => nodes.map(node => ({ ...node, type: 'custom' })), [nodes]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  return (
    <div className="my-6 h-[500px] rounded-xl border border-slate-200 shadow-sm relative bg-slate-50">
      <ReactFlow
        nodes={customNodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        onPaneClick={() => setSelectedNode(null)}
        nodeTypes={nodeTypes} // Now using the stable object from outside
        edgeTypes={edgeTypes} // Now using the stable object from outside
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        }}
        fitView
      >
        <Controls position="bottom-right" />
        <MiniMap position="top-right" nodeColor="#a78bfa" />
        <Background gap={24} color="#e2e8f0" />
      </ReactFlow>

      {/* Information Panel */}
      <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-sm p-4 rounded-lg shadow-lg border border-slate-200 w-64 max-h-[450px] overflow-y-auto transition-opacity duration-300">
        <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2"><Info size={16} /> Node Information</h3>
        {selectedNode ? (
          <div className="text-sm space-y-2">
            <p><strong className="text-slate-600">ID:</strong> <span className="font-mono bg-slate-100 px-1 rounded">{selectedNode.id}</span></p>
            <p><strong className="text-slate-600">Label:</strong> {selectedNode.data.label}</p>
            <p className="text-xs text-slate-500 pt-2 border-t mt-2">This is where you would display more detailed information, notes, or actions related to the '{selectedNode.data.label}' node.</p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Click on a node to see its details.</p>
        )}
      </div>
    </div>
  );
};