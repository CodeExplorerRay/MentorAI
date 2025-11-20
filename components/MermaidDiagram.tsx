import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'Inter, sans-serif',
});

interface MermaidDiagramProps {
  chart: string;
}

export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  
  useEffect(() => {
    const renderDiagram = async () => {
      if (!chart) return;
      setError(false);
      
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        // mermaid.render returns an object { svg: string }
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(true);
      }
    };

    renderDiagram();
  }, [chart]);

  if (error) {
    return (
        <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-mono">
            Failed to render diagram.
            <pre className="mt-2 opacity-50">{chart}</pre>
        </div>
    );
  }

  if (!svg) {
      return <div className="h-24 bg-slate-50 animate-pulse rounded-xl border border-slate-100"></div>;
  }

  return (
    <div className="my-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex justify-center overflow-x-auto">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};