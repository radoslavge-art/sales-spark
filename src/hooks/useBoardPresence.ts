import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PresenceUser {
  userId: string;
  name: string;
  email: string;
  onlineAt: string;
}

export function useBoardPresence(boardId: string | undefined, currentUser: { id: string; name?: string; email?: string } | null) {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!boardId || !currentUser?.id) {
      setPresentUsers([]);
      return;
    }

    const channel = supabase.channel(`board-presence:${boardId}`, {
      config: { presence: { key: currentUser.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<{ userId: string; name: string; email: string; onlineAt: string }>();
        const users: PresenceUser[] = [];
        const seen = new Set<string>();
        for (const key of Object.keys(state)) {
          const entries = state[key];
          if (entries && entries.length > 0) {
            const entry = entries[0];
            if (!seen.has(entry.userId)) {
              seen.add(entry.userId);
              users.push({
                userId: entry.userId,
                name: entry.name,
                email: entry.email,
                onlineAt: entry.onlineAt,
              });
            }
          }
        }
        setPresentUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: currentUser.id,
            name: currentUser.name || '',
            email: currentUser.email || '',
            onlineAt: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [boardId, currentUser?.id, currentUser?.name, currentUser?.email]);

  return presentUsers;
}
