import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { validateAndSanitizeMermaid } from '../utils/mermaidValidator';

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
  const [error, setError] = useState<string | null>(null);
  const [sanitized, setSanitized] = useState<string>(chart);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!chart) return;
    setError(null);
    setSvg('');
    // Validate and sanitize
    const { valid, sanitized: safeChart, errors } = validateAndSanitizeMermaid(chart);
    setSanitized(safeChart);
    setValidationErrors(errors);
    if (!valid) {
      setError('Diagram contains syntax issues.');
      return;
    }
    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, safeChart);
        setSvg(svg);
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError('Failed to render diagram.');
      }
    };
    renderDiagram();
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-100 rounded-lg text-red-600 text-xs font-mono">
        {error}
        {validationErrors.length > 0 && (
          <ul className="mt-2 list-disc list-inside">
            {validationErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        <pre className="mt-2 opacity-50">{sanitized}</pre>
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