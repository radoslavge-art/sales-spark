import { supabase } from '@/integrations/supabase/client';

export async function logActivity(action: string, entityType: string, entityId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('activities' as any).insert({
    user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
  });
}
