// utils/mermaidValidator.ts

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
  let sanitized = diagram.trim();

  if (!sanitized) {
    return {
      valid: false,
      sanitized: '',
      errors: ['Diagram is empty']
    };
  }

  const lines = sanitized.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const rebuiltLines: string[] = [];
  
  // Diagram type validation
  const firstLine = lines[0];
  const diagramTypes = [
    'graph TD', 'graph LR', 'graph BT', 'graph RL',
    'sequenceDiagram', 'mindmap', 'pie', 'gantt', 
    'journey', 'classDiagram', 'stateDiagram', 'erDiagram'
  ];
  
  let hasValidDiagramType = false;
  for (const type of diagramTypes) {
    if (firstLine.startsWith(type)) {
      hasValidDiagramType = true;
      break;
    }
  }
  
  if (!hasValidDiagramType) {
    errors.push('Missing or invalid diagram type on first line.');
    rebuiltLines.push('graph TD');
  } else {
    rebuiltLines.push(firstLine);
  }

  // Process each line
  for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    if (!line || line.startsWith('%%')) {
      if (line) rebuiltLines.push(line);
      continue;
    }

    // NEW: ENHANCED CONCATENATION DETECTION - ADDED MORE PATTERNS
    const concatenationPatterns = [
      /(\][A-Za-z0-9_]+\[)/,                    // Existing pattern: ]B[
      /\]\s*[A-Za-z0-9_]+\s*-->/,              // NEW: ]B --> (your specific error)
      /\]\s*-->/,                              // NEW: ] --> (your specific error)
      /[A-Za-z0-9_]+\[.*\]\s*[A-Za-z0-9_]+$/, // NEW: A[Label]B (node concatenation)
      /\]\s*\|/,                               // NEW: ]| (pipe without space)
      /\|\s*\[/                                // NEW: |[ (pipe without space)
    ];

    let hasConcatenation = false;
    for (const pattern of concatenationPatterns) {
      if (pattern.test(line)) {
        hasConcatenation = true;
        break;
      }
    }

    if (hasConcatenation) {
      errors.push(`Found concatenated syntax on line ${i + 1}, applying enhanced fixes...`);
      
      // ENHANCED FIXES FOR ALL CONCATENATION PATTERNS
      line = line
        // Fix: ]B --> becomes ]\nB --> (your specific error)
        .replace(/(\])\s*([A-Za-z][A-Za-z0-9_]*\s*-->)/g, '$1\n$2')
        // Fix: ] --> becomes ]\nMissingNode --> (add missing node)
        .replace(/(\])\s*(-->)/g, '$1\nMissingNode$2')
        // Fix: A[Label]B becomes A[Label]\nB (node concatenation)
        .replace(/([A-Za-z0-9_]+\[[^\]]+\])\s*([A-Za-z0-9_]+$)/g, '$1\n$2')
        // Fix: ]| becomes ] | (add space)
        .replace(/(\])\s*(\|)/g, '$1 $2')
        // Fix: |[ becomes | [ (add space)
        .replace(/(\|)\s*(\[)/g, '$1 $2')
        // Existing fix: ]B[ becomes ]\nB[
        .replace(/(\])([A-Za-z0-9_]+\[)/g, '$1\n$2');

      // If line was modified and contains newlines, split into multiple lines
      if (line.includes('\n')) {
        const newLines = line.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        newLines.forEach(newLine => rebuiltLines.push(newLine));
        continue;
      }
    }

    // Handle arrows
    if (line.includes('-->')) {
      const arrowParts = line.split('-->').map(part => part.trim());
      if (arrowParts.length === 2) {
        const [leftSide, rightSide] = arrowParts;
        
        let leftNode = sanitizeNode(leftSide, errors, i);
        let rightNode = sanitizeNode(rightSide, errors, i);
        
        line = `${leftNode} --> ${rightNode}`;
      }
    } else {
      // Single node processing
      line = sanitizeNode(line, errors, i);
    }
    
    rebuiltLines.push(line);
  }

  sanitized = rebuiltLines.join('\n');

  // Final validation
  const openBrackets = (sanitized.match(/\[/g) || []).length;
  const closeBrackets = (sanitized.match(/\]/g) || []).length;
  
  if (openBrackets !== closeBrackets) {
    errors.push(`Mismatched brackets: ${openBrackets} opening vs ${closeBrackets} closing`);
    const bracketDiff = openBrackets - closeBrackets;
    if (bracketDiff > 0) {
      sanitized += ']'.repeat(bracketDiff);
    }
  }

  return {
    valid: errors.length === 0,
    sanitized,
    errors
  };
}

function sanitizeNode(nodeStr: string, errors: string[], lineNum: number): string {
  // If it's already a valid node, return as is
  if (/^[A-Za-z0-9_]+\[[^\]]+\]$/.test(nodeStr)) {
    const nodeMatch = nodeStr.match(/^([A-Za-z0-9_]+)\[([^\]]+)\]$/);
    if (nodeMatch) {
      const nodeId = nodeMatch[1];
      let label = nodeMatch[2];
      
      // Enhanced cleaning with markdown formatting detection
      let cleanLabel = label;
      let wasModified = false;
      
      // NEW: Better markdown detection and removal
      if (/\*\*.*\*\*/.test(cleanLabel) || /\*[^*]/.test(cleanLabel)) {
        cleanLabel = cleanLabel.replace(/\*\*/g, '').replace(/\*([^*])/g, '$1');
        wasModified = true;
        errors.push(`Removed markdown formatting from node '${nodeId}' on line ${lineNum + 1}`);
      }
      
      // Preserve existing cleaning logic
      const specialCharsRegex = /[()<>]/g;
      if (specialCharsRegex.test(cleanLabel) && !cleanLabel.startsWith('"') && !cleanLabel.endsWith('"')) {
        // FIX: Remove special characters instead of wrapping in quotes
        cleanLabel = cleanLabel.replace(/[()<>]/g, '');
        wasModified = true;
        errors.push(`Removed special characters from node '${nodeId}' on line ${lineNum + 1}`);
      }
      
      // Existing cleaning logic
      if (/\n/.test(cleanLabel)) {
        cleanLabel = cleanLabel.replace(/\n/g, ' ');
        wasModified = true;
      }
      if (/[^\x00-\x7F]/.test(cleanLabel)) {
        cleanLabel = cleanLabel.replace(/[^\x00-\x7F]/g, '');
        wasModified = true;
      }
      
      if (wasModified) {
        return `${nodeId}[${cleanLabel}]`;
      }
    }
    return nodeStr;
  }

  // Extract node ID and label from malformed nodes
  const nodeMatch = nodeStr.match(/^([A-Za-z0-9_]+)\[(.*)$/);
  if (!nodeMatch) {
    return nodeStr;
  }

  const nodeId = nodeMatch[1];
  let labelContent = nodeMatch[2];

  let cleanLabel = labelContent;

  // Close unclosed brackets
  if (!cleanLabel.includes(']')) {
    cleanLabel += ']';
    errors.push(`Fixed unclosed bracket in node '${nodeId}' on line ${lineNum + 1}`);
  } else {
    const bracketParts = cleanLabel.split(']');
    cleanLabel = bracketParts[0] + ']';
  }

  // Enhanced aggressive cleaning
  cleanLabel = cleanLabel
    .replace(/\*\*/g, '')  // Remove bold markdown
    .replace(/\*([^*])/g, '$1') // Remove italic markdown but preserve asterisks in words
    .replace(/_/g, '')     // Remove underline
    .replace(/[^\x20-\x7E]/g, '') // Remove non-ASCII
    .replace(/"/g, '')     // Remove quotes
    .replace(/\\"/g, '');  // Remove escaped quotes

  // FIX: Remove special characters instead of wrapping in quotes
  cleanLabel = cleanLabel.replace(/[()<>]/g, '');

  cleanLabel = cleanLabel.replace(/\]$/, '');
  
  return `${nodeId}[${cleanLabel}]`;
}