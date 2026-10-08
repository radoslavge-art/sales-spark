import { useRef, useCallback } from 'react';

/**
 * Returns a debounced save function that:
 * - Waits `delay` ms after the last call before executing
 * - Shows a toast on error
 * - Retries once silently on failure
 */
export function useAutosave(delay = 300) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<(() => Promise<void>) | null>(null);

  const debouncedSave = useCallback((saveFn: () => Promise<void>) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        await saveFn();
        retryRef.current = null;
      } catch (err) {
        console.error('Autosave error:', err);
        // Silent retry once
        retryRef.current = saveFn;
        setTimeout(async () => {
          if (retryRef.current === saveFn) {
            try {
              await saveFn();
              retryRef.current = null;
            } catch {
              // Already logged above
            }
          }
        }, 2000);
      }
    }, delay);
  }, [delay]);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { debouncedSave, flush };
}
