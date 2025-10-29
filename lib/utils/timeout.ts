/**
 * Utility functions for adding timeouts to promises
 */

/**
 * Adds a timeout to a promise
 * @param promise The promise to add timeout to
 * @param ms Timeout in milliseconds
 * @param timeoutMessage Custom error message for timeout
 * @returns Promise that rejects if timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  // Create a timeout promise
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });

  // Race the original promise against the timeout
  return Promise.race([promise, timeoutPromise]);
}

/**
 * Utility function to add timeout to async functions with custom error handling
 */
export async function withTimeoutAndErrorHandling<T>(
  asyncFn: () => Promise<T>,
  ms: number,
  timeoutMessage: string = 'Operation timed out'
): Promise<T> {
  try {
    return await withTimeout(asyncFn(), ms, timeoutMessage);
  } catch (error) {
    if (error instanceof Error && error.message === timeoutMessage) {
      console.warn(timeoutMessage);
    }
    throw error;
  }
}