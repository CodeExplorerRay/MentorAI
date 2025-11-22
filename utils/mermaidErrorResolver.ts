// utils/mermaidErrorResolver.ts
/**
 * Comprehensive Mermaid error resolver that handles common syntax issues
 * before they reach the validator
 */
export const MERMAID_ERROR_RESOLVER_PROMPT = `
### MERMAID JS ERROR RESOLUTION GUIDE

When generating Mermaid diagrams, ALWAYS follow these rules to prevent syntax errors:

**CRITICAL FIXES FOR RECURRING ERRORS:**

1.  **NODE SEPARATION:** Every node must be on its own line. Never concatenate nodes.
    - ❌ WRONG: \`A[Label]B[Label] --> C[Label]\`
    - ✅ RIGHT: 
      \`\`\`
      A[Label]
      B[Label] 
      A --> B
      B --> C
      \`\`\`

2.  **ARROW COMPLETION:** Every arrow \`-->\` must connect two complete nodes.
    - ❌ WRONG: \`A[Label] -->\` (incomplete)
    - ❌ WRONG: \`--> B[Label]\` (incomplete)  
    - ✅ RIGHT: \`A[Label] --> B[Label]\`

3.  **PIPE SYNTAX:** When using \`|text|\` on arrows, ensure proper spacing.
    - ❌ WRONG: \`A -->|Yes|B\`
    - ✅ RIGHT: \`A --> |Yes| B\`

4.  **CONSISTENT LABELS:** Never mix quoted and unquoted labels in the same diagram.
    - ❌ WRONG: \`A["Label"] --> B[Label]\`
    - ✅ RIGHT: \`A[Label] --> B[Label]\` OR \`A["Label"] --> B["Label"]\`

**AUTO-FIX TEMPLATE:**

Before generating any Mermaid code, use this template:

\`\`\`mermaid
graph TD
    %% Always start with graph TD on first line
    A[Node A]
    B[Node B]
    C[Node C]
    
    %% Arrows on separate lines
    A --> B
    B --> C
    A --> C
    
    %% Simple labels only - no special chars
    Start[Start Process]
    Step1[First Step]
    Step2[Second Step]
    End[End Process]
    
    Start --> Step1
    Step1 --> Step2  
    Step2 --> End
\`\`\`

**VALIDATION CHECKLIST:**
- [ ] Diagram type on first line
- [ ] One node per line
- [ ] All arrows connect two nodes
- [ ] No special characters in labels
- [ ] No markdown formatting in labels
- [ ] All brackets are closed
- [ ] Consistent label style (all quoted or all unquoted)
- [ ] No concatenated nodes
`;