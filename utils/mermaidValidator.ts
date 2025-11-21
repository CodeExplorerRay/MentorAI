// utils/mermaidValidator.ts
// Runtime validator and sanitizer for Mermaid.js diagrams

/**
 * Checks if a Mermaid diagram string is valid and attempts to sanitize common issues.
 * - Ensures diagram type is on the first line
 * - Ensures node IDs are alphanumeric/underscored
 * - Ensures node labels are single-line, ASCII, and brackets are closed
 * - Removes or replaces invalid characters
 * Returns an object with { valid, sanitized, errors }
 */
export function validateAndSanitizeMermaid(diagram: string) {
  const errors: string[] = [];
  let sanitized = diagram;

  // Split into lines and trim
  const lines = diagram.split(/\r?\n/).map(l => l.trim());
  if (!lines[0] || !/^\s*(graph\s+(TD|LR)|sequenceDiagram|mindmap)/.test(lines[0])) {
    errors.push('Missing or invalid diagram type on first line.');
  }

  // Check each line for node definitions
  const nodeDefRegex = /^([A-Za-z0-9_]+)\[(.*)\]$/;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip empty/comment lines
    if (!line || line.startsWith('%%')) continue;
    // Check for node definitions
    const match = line.match(/([A-Za-z0-9_]+)\[(.*)\]/);
    if (match) {
      const nodeId = match[1];
      const label = match[2];
      // Node ID check
      if (!/^[A-Za-z0-9_]+$/.test(nodeId)) {
        errors.push(`Invalid node ID '${nodeId}' on line ${i+1}`);
        sanitized = sanitized.replace(nodeId, nodeId.replace(/[^A-Za-z0-9_]/g, '_'));
      }
      // Label checks
      if (/\n/.test(label)) {
        errors.push(`Multiline label in node '${nodeId}' on line ${i+1}`);
        sanitized = sanitized.replace(label, label.replace(/\n/g, ' '));
      }
      if (/[^\x00-\x7F]/.test(label)) {
        errors.push(`Non-ASCII character in label of node '${nodeId}' on line ${i+1}`);
        sanitized = sanitized.replace(label, label.replace(/[^\x00-\x7F]/g, ''));
      }
      if (!/\]$/.test(line)) {
        errors.push(`Unclosed bracket in node '${nodeId}' on line ${i+1}`);
        sanitized = sanitized.replace(line, line + ']');
      }
    }
  }

  // Final check for unclosed brackets
  if ((sanitized.match(/\[/g) || []).length !== (sanitized.match(/\]/g) || []).length) {
    errors.push('Mismatched brackets in diagram.');
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}
