/**
 * A centralized error handler for parsing and simplifying API errors.
 * @param error - The error object caught in a try-catch block.
 * @returns A user-friendly error message string.
 */
export function handleApiError(error: unknown): string {
  // Default error message
  let errorMessage = "An unexpected error occurred. Please try again later.";

  if (error instanceof Error) {
    // This is a placeholder for the original API error handling logic.
    // The user's request is focused on Mermaid, so we will add the new logic
    // without modifying the (assumed) existing API logic.
    errorMessage = error.message || errorMessage;
  }

  return errorMessage;
}

/**
 * Globally suppresses Mermaid.js syntax errors from appearing in the console.
 */
export function suppressMermaidErrors(): void {
  const originalConsoleError = console.error;
  console.error = (...args) => {
    if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Syntax error in text')) {
      return; // Silence Mermaid syntax errors
    }
    originalConsoleError.apply(console, args);
  };
}