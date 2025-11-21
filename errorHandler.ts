/**
 * A centralized error handler for parsing and simplifying API errors.
 * @param error - The error object caught in a try-catch block.
 * @returns A user-friendly error message string.
 */
export function handleApiError(error: unknown): string {
  // Default error message
  let errorMessage = "An unexpected error occurred. Please try again later.";

  if (error instanceof Error) {
    // The @google/genai SDK often throws errors with a nested structure.
    // We'll try to parse the specific Gemini API error message.
    try {
      // The actual error from the API is often a JSON string in the message.
      const errorDetails = JSON.parse(error.message.match(/{\s*"error"[\s\S]*}/)![0]);
      const apiError = errorDetails.error;

      if (apiError) {
        console.error("Gemini API Error:", apiError);

        switch (apiError.status) {
          case "RESOURCE_EXHAUSTED":
            // This is a 429 Rate Limit error
            errorMessage =
              "You've exceeded your API request limit. Please check your plan or wait a moment before trying again.";
            break;
          case "INVALID_ARGUMENT":
            errorMessage = "There was an issue with the request. Please check your input.";
            break;
          default:
            errorMessage = apiError.message || errorMessage;
            break;
        }
      }
    } catch (e) {
      // If parsing fails, use the generic error message.
      console.error("Generic Error:", error);
      errorMessage = error.message || errorMessage;
    }
  }

  return errorMessage;
}