import React, { useState, useEffect } from 'react';
import { Node, Edge } from 'reactflow';
import mermaid from 'mermaid';
import { ReactFlowDiagram } from './ReactFlowDiagram';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

interface HybridDiagramProps {
  chart: string;
}

export const HybridDiagram: React.FC<HybridDiagramProps> = ({ chart }) => {
  const [content, setContent] = useState<React.ReactNode>(null);

  useEffect(() => {
    if (!chart) {
      setContent(<TextFallback content="No diagram provided" />);
      return;
    }
    renderWithFallbacks(chart);
  }, [chart]);

  const renderWithFallbacks = async (rawCode: string) => {
    // Clean the code first
    const cleanCode = cleanMermaidCode(rawCode);
    
    // TRY 1: Mermaid
    try {
      const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
      const { svg } = await mermaid.render(id, cleanCode);
      setContent(<MermaidSuccess svg={svg} />);
      return;
    } catch (error) {
      // Silent failure - no console logs
    }

    // TRY 2: React Flow
    try {
      const flowData = simpleMermaidToReactFlow(cleanCode);
      if (flowData.nodes.length > 0) {
        setContent(<ReactFlowFallback data={flowData} />);
        return;
      }
    } catch (error) {
      // Silent failure - no console logs
    }

    // TRY 3: Text
    setContent(<TextFallback content={cleanCode} />);
  };

  return (
    <div className="my-6 min-h-[200px]">
      {content || <LoadingSpinner />}
    </div>
  );
};

// Simple cleaner - no validator messages
const cleanMermaidCode = (code: string): string => {
  return code
      .replace(/([A-Za-z0-9_]+\[[^\]]+\])([A-Za-z0-9_]+\[)/g, '$1\n$2')
      .replace(/(\])\s*-->\s*$/gm, '$1 --> TempNode[Continue]')
      .replace(/^\s*-->\s*([A-Za-z0-9_]+\[)/gm, 'StartNode[Start] --> $1')
      .replace(/\*\*/g, '')
      .replace(/[()<>]/g, '')
      .replace(/"/g, '')
      .trim();
};

// Simple converter - no complex logic
const simpleMermaidToReactFlow = (code: string): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Extract nodes
  const nodeRegex = /([A-Za-z0-9_]+)\[([^\]]+)\]/g;
  let match;
  let yPos = 50;
  
  while ((match = nodeRegex.exec(code)) !== null) {
    const [_, id, label] = match;
    nodes.push({
      id,
      data: { label: label.substring(0, 40) },
      position: { x: 250, y: yPos },
      type: nodes.length === 0 ? 'input' : 'default'
    });
    yPos += 120;
  }
  
  // Create simple linear flow
  for (let i = 0; i < nodes.length - 1; i++) {
    edges.push({
      id: `edge-${i}`,
      source: nodes[i].id,
      target: nodes[i + 1].id
    });
  }
  
  return { nodes, edges };
};

// Component pieces
const MermaidSuccess = ({ svg }: { svg: string }) => (
  <div className="relative">
    <div className="absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800 z-10">
      ✓ Mermaid
    </div>
    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-center overflow-x-auto">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  </div>
);

const ReactFlowFallback = ({ data }: { data: { nodes: Node[]; edges: Edge[] } }) => (
  <div className="relative">
    <div className="absolute top-2 right-2 text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-800 z-10">
      🔄 React Flow
    </div>
    <ReactFlowDiagram nodes={data.nodes} edges={data.edges} />
  </div>
);

const TextFallback = ({ content }: { content: string }) => (
  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
    <div className="font-semibold mb-2">📋 Process Description</div>
    <div className="text-sm font-mono">
      {content.substring(0, 300)}
      {content.length > 300 ? '...' : ''}
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="h-64 bg-slate-50 animate-pulse rounded-xl border border-slate-100"></div>
);