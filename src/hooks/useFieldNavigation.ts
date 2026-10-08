import { useCallback, useRef } from 'react';

/**
 * Manages keyboard-first field navigation within a container.
 * Tab/Shift+Tab cycle through fields, Enter saves & advances, Escape cancels.
 */
export function useFieldNavigation(fieldIds: string[]) {
  const containerRef = useRef<HTMLDivElement>(null);

  const focusField = useCallback((index: number) => {
    if (!containerRef.current || index < 0 || index >= fieldIds.length) return;
    const id = fieldIds[index];
    const el = containerRef.current.querySelector<HTMLElement>(`[data-field-id="${id}"]`);
    if (el) {
      el.focus();
      // Select text in input/textarea
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.select();
      }
    }
  }, [fieldIds]);

  const getCurrentIndex = useCallback((target: EventTarget | null): number => {
    if (!target || !(target instanceof HTMLElement)) return -1;
    const fieldEl = target.closest<HTMLElement>('[data-field-id]');
    if (!fieldEl) return -1;
    const id = fieldEl.getAttribute('data-field-id');
    return id ? fieldIds.indexOf(id) : -1;
  }, [fieldIds]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA';
    if (!isInput) return;

    const idx = getCurrentIndex(e.target);
    if (idx === -1) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
      if (nextIdx >= 0 && nextIdx < fieldIds.length) {
        // Blur current to trigger auto-save
        (e.target as HTMLElement).blur();
        setTimeout(() => focusField(nextIdx), 0);
      }
      return;
    }

    if (e.key === 'Enter' && tag === 'INPUT') {
      e.preventDefault();
      // Blur to auto-save, then advance
      (e.target as HTMLElement).blur();
      const nextIdx = idx + 1;
      if (nextIdx < fieldIds.length) {
        setTimeout(() => focusField(nextIdx), 0);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
  }, [fieldIds, focusField, getCurrentIndex]);

  return { containerRef, handleKeyDown, focusField };
}
