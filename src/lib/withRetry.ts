import { toast } from 'sonner';

/**
 * Execute a Supabase operation with retry logic and detailed error reporting.
 * Retries up to `maxRetries` times on failure, with exponential backoff.
 * Shows actual error.message in toast + logs to console.
 */
export async function withRetry(
  operation: () => Promise<any> | any,
  options: {
    context?: string;
    maxRetries?: number;
    silent?: boolean;
  } = {}
): Promise<any> {
  const { context = 'Operation', maxRetries = 2, silent = false } = options;

  let lastError: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      if (result?.error) {
        lastError = result.error;
        console.error(`[Board] ${context} failed (attempt ${attempt + 1}/${maxRetries + 1}):`, result.error);

        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }

        if (!silent) {
          toast.error(`${context}: ${result.error.message || 'Unknown error'}`);
        }
        return result;
      }

      return result;
    } catch (err: any) {
      lastError = err;
      console.error(`[Board] ${context} threw (attempt ${attempt + 1}/${maxRetries + 1}):`, err);

      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }

      if (!silent) {
        toast.error(`${context}: ${err?.message || 'Unknown error'}`);
      }
      throw err;
    }
  }

  if (!silent) toast.error(`${context}: ${lastError?.message || 'Failed after retries'}`);
  return { error: lastError };
}
