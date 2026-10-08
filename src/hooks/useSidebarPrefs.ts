import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY_PINNED = 'ats-sidebar-pinned';
const STORAGE_KEY_RECENT = 'ats-sidebar-recent';
const MAX_RECENT = 8;

interface PinnedItem {
  id: string;
  type: 'company' | 'position';
}

interface RecentItem {
  id: string;
  type: 'company' | 'position';
  timestamp: number;
}

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function useSidebarPrefs() {
  const [pinned, setPinned] = useState<PinnedItem[]>(() => loadFromStorage(STORAGE_KEY_PINNED, []));
  const [recent, setRecent] = useState<RecentItem[]>(() => loadFromStorage(STORAGE_KEY_RECENT, []));

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(pinned));
  }, [pinned]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECENT, JSON.stringify(recent));
  }, [recent]);

  const isPinned = useCallback((id: string) => pinned.some(p => p.id === id), [pinned]);

  const togglePin = useCallback((id: string, type: 'company' | 'position') => {
    setPinned(prev => {
      const exists = prev.some(p => p.id === id);
      if (exists) return prev.filter(p => p.id !== id);
      return [...prev, { id, type }];
    });
  }, []);

  const trackRecent = useCallback((id: string, type: 'company' | 'position') => {
    setRecent(prev => {
      const filtered = prev.filter(r => r.id !== id);
      const next = [{ id, type, timestamp: Date.now() }, ...filtered];
      return next.slice(0, MAX_RECENT);
    });
  }, []);

  const pinnedCompanyIds = pinned.filter(p => p.type === 'company').map(p => p.id);
  const pinnedPositionIds = pinned.filter(p => p.type === 'position').map(p => p.id);
  const recentItems = recent;

  return {
    pinnedCompanyIds,
    pinnedPositionIds,
    isPinned,
    togglePin,
    trackRecent,
    recentItems,
  };
}
