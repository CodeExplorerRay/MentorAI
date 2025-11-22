import { Node, Edge } from 'reactflow';
import { getLayoutedElements } from '../utils/autoLayout';

interface ConversionResult {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Cleans a Mermaid node label by removing common markdown and quotes.
 * @param label The raw label string.
 * @returns A cleaned label string.
 */
function cleanLabel(label: string): string {
  // Removes **bold**, *italic*, and quotes
  return label.replace(/[*"`]/g, '').trim();
}

/**
 * Converts a string of basic Mermaid syntax into React Flow nodes and edges.
 * Handles simple node declarations (e.g., A[Label]) and connections (e.g., A --> B).
 * @param mermaidSyntax The Mermaid diagram string.
 * @returns An object containing arrays of nodes and edges for React Flow.
 */
export function convertMermaidToReactFlow(mermaidSyntax: string): ConversionResult {
  const nodes: Map<string, Node> = new Map();
  const edges: Edge[] = [];
  const lines = mermaidSyntax.split('\n');

  // Regex to find node definitions like A, A[Label], or "A[Label]"
  const nodeRegex = /(\w+)(?:\["?(.*?)"?\])?/g;

  lines.forEach((line, index) => {
    line = line.trim();
    if (!line || line.startsWith('graph')) {
      return; // Skip graph definition or empty lines
    }

    // Check for an edge
    if (line.includes('-->')) {
      const parts = line.split('-->');
      const sourceMatch = parts[0].trim().match(/^(\w+)/);
      const targetMatch = parts[1].trim().match(/^(\w+)/);

      if (sourceMatch && targetMatch) {
        const sourceId = sourceMatch[1];
        const targetId = targetMatch[1];

        // Add nodes from the edge definition if they don't exist
        [parts[0].trim(), parts[1].trim()].forEach(part => {
          const nodeParts = new RegExp(nodeRegex).exec(part);
          if (nodeParts && !nodes.has(nodeParts[1])) {
            const id = nodeParts[1];
            const label = nodeParts[2] ? cleanLabel(nodeParts[2]) : id;
            nodes.set(id, { id, position: { x: 0, y: 0 }, data: { label } });
          }
        });

        // Add the edge
        edges.push({
          id: `e-${sourceId}-${targetId}-${index}`,
          source: sourceId,
          target: targetId,
        });
      }
    } else {
      // It's a node definition
      const nodeParts = new RegExp(nodeRegex).exec(line);
      if (nodeParts && !nodes.has(nodeParts[1])) {
        const id = nodeParts[1];
        const label = nodeParts[2] ? cleanLabel(nodeParts[2]) : id;
        nodes.set(id, { id, position: { x: 0, y: 0 }, data: { label } });
      }
    }
  });

  // Use Dagre for auto-layout
  return getLayoutedElements(Array.from(nodes.values()), edges);
}