import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Subscribe to realtime changes on board_tasks and board_columns
 * for a specific shared board. Patches local state instead of full reload.
 *
 * Soft-delete aware:
 * - UPDATE with deleted_at set (null → timestamp) → emitted as DELETE
 * - UPDATE with deleted_at cleared (timestamp → null) → emitted as INSERT (restore)
 * - Regular UPDATE → emitted as UPDATE with last-write-wins via updated_at
 */
export function useBoardRealtime({
  boardId,
  isShared,
  userId,
  onTaskChange,
  onColumnChange,
}: {
  boardId: string;
  isShared: boolean;
  userId: string | undefined;
  onTaskChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: any, oldRecord?: any) => void;
  onColumnChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: any, oldRecord?: any) => void;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const recentMutationsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isShared || !boardId || !userId) return;

    const handlePayload = (
      payload: any,
      type: 'task' | 'col',
      onChange: (event: 'INSERT' | 'UPDATE' | 'DELETE', record: any, oldRecord?: any) => void,
    ) => {
      const record = payload.new || {};
      const oldRecord = payload.old || {};
      const id = record.id || oldRecord.id;

      // Skip echoed local mutations
      const key = `${type}-${id}-${payload.eventType}`;
      if (recentMutationsRef.current.has(key)) {
        recentMutationsRef.current.delete(key);
        return;
      }

      if (payload.eventType === 'UPDATE') {
        const wasDeleted = oldRecord.deleted_at != null;
        const isNowDeleted = record.deleted_at != null;

        if (!wasDeleted && isNowDeleted) {
          // Soft-delete: treat as DELETE
          onChange('DELETE', record, oldRecord);
          return;
        }

        if (wasDeleted && !isNowDeleted) {
          // Restore (undo): treat as INSERT so the item re-appears in UI
          onChange('INSERT', record, oldRecord);
          return;
        }

        // Skip if still deleted (e.g. updating deleted_by on an already-deleted record)
        if (isNowDeleted) return;
      }

      if (payload.eventType === 'INSERT' && record.deleted_at) {
        // Inserted already-deleted — ignore
        return;
      }

      onChange(payload.eventType, record, oldRecord);
    };

    const channel = supabase
      .channel(`board-${boardId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_tasks', filter: `board_id=eq.${boardId}` },
        (payload: any) => handlePayload(payload, 'task', onTaskChange),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_columns', filter: `board_id=eq.${boardId}` },
        (payload: any) => handlePayload(payload, 'col', onColumnChange),
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, isShared, userId, onTaskChange, onColumnChange]);

  /** Mark a mutation as local so the echo event is ignored */
  const markLocalMutation = (type: 'task' | 'col', id: string, event: 'INSERT' | 'UPDATE' | 'DELETE') => {
    const key = `${type}-${id}-${event}`;
    recentMutationsRef.current.add(key);
    setTimeout(() => recentMutationsRef.current.delete(key), 5000);
  };

  return { markLocalMutation };
}
