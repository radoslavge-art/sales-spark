import { supabase } from '@/integrations/supabase/client';

/** Fire-and-forget board activity logging. Never blocks UI. */
export function logBoardActivity(boardId: string, userId: string, action: string) {
  supabase
    .from('board_activities' as any)
    .insert({ board_id: boardId, user_id: userId, action } as any)
    .then(({ error }) => {
      if (error) console.warn('[BoardActivity] log failed:', error.message);
    });
}