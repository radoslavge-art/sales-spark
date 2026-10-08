import { supabase } from '@/integrations/supabase/client';

interface AuditLogParams {
  action: string;
  entity_type: string;
  entity_id?: string;
  metadata?: Record<string, any>;
}

/**
 * Fire-and-forget audit logging. Never blocks UI.
 * Only logs when a user session is active.
 */
export async function logAuditActivity(params: AuditLogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from('activity_logs' as any).insert({
      user_id: user.id,
      action: params.action,
      entity_type: params.entity_type,
      entity_id: params.entity_id || null,
      metadata: params.metadata || {},
    }) as any);
  } catch (err) {
    console.warn('[AuditLog] failed:', err);
  }
}
