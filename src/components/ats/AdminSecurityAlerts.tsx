import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, CheckCircle2, Eye, Clock } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface SecurityAlert {
  id: string;
  user_id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  metadata: Record<string, any>;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  userName?: string;
  userEmail?: string;
}

const SEVERITY_CONFIG: Record<string, { icon: typeof AlertTriangle; color: string; bg: string }> = {
  high: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/20' },
  medium: { icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  low: { icon: Shield, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  open: { label: 'Open', variant: 'default' },
  investigating: { label: 'Investigating', variant: 'secondary' },
  dismissed: { label: 'Dismissed', variant: 'outline' },
  resolved: { label: 'Resolved', variant: 'outline' },
};

export function AdminSecurityAlerts() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  const [profiles, setProfiles] = useState<Map<string, { name: string; email: string }>>(new Map());

  useEffect(() => {
    loadProfiles();
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [showResolved]);

  const loadProfiles = async () => {
    const { data } = await supabase.from('profiles').select('id, name, email');
    if (data) {
      setProfiles(new Map(data.map(p => [p.id, { name: p.name || '', email: p.email || '' }])));
    }
  };

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    let query = (supabase.from('security_alerts' as any).select('*') as any)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!showResolved) {
      query = query.in('status', ['open', 'investigating']);
    }

    const { data, error } = await query;
    if (error) { console.error('Fetch alerts error:', error); setLoading(false); return; }

    const enriched = ((data || []) as SecurityAlert[]).map(a => ({
      ...a,
      userName: profiles.get(a.user_id)?.name || '',
      userEmail: profiles.get(a.user_id)?.email || a.user_id,
    }));

    setAlerts(enriched);
    setLoading(false);
  }, [showResolved, profiles]);

  const updateStatus = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    const updates: Record<string, any> = { status };
    if (status === 'resolved' || status === 'dismissed') {
      updates.resolved_by = user?.id;
      updates.resolved_at = new Date().toISOString();
    }

    await (supabase.from('security_alerts' as any).update(updates).eq('id', id) as any);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
    toast({ title: `Alert marked as ${status}` });
  };

  const openCount = alerts.filter(a => a.status === 'open').length;
  const investigatingCount = alerts.filter(a => a.status === 'investigating').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Security Alerts</h2>
          {openCount > 0 && (
            <Badge variant="destructive" className="text-xs">{openCount} open</Badge>
          )}
          {investigatingCount > 0 && (
            <Badge variant="secondary" className="text-xs">{investigatingCount} investigating</Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowResolved(!showResolved)}
          className="text-xs"
        >
          {showResolved ? 'Hide resolved' : 'Show all'}
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-4">Loading alerts...</p>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center border border-dashed rounded-lg">
          <ShieldCheck className="h-10 w-10 text-emerald-500/40 mb-3" />
          <p className="text-sm font-medium text-foreground">All clear</p>
          <p className="text-xs text-muted-foreground mt-1">No suspicious activity detected</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map(alert => {
            const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
            const SevIcon = sev.icon;
            const statusCfg = STATUS_CONFIG[alert.status] || STATUS_CONFIG.open;
            const isActive = alert.status === 'open' || alert.status === 'investigating';

            return (
              <div
                key={alert.id}
                className={cn(
                  'rounded-lg border p-4 transition-colors',
                  isActive ? sev.bg : 'bg-muted/30 border-border opacity-70'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <SevIcon className={cn('h-5 w-5 mt-0.5 shrink-0', sev.color)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{alert.title}</p>
                        <Badge variant={statusCfg.variant} className="text-[10px]">
                          {statusCfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{alert.description}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {alert.userName || alert.userEmail}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                        </span>
                        {alert.resolved_at && (
                          <>
                            <span>·</span>
                            <span>Resolved {format(new Date(alert.resolved_at), 'dd MMM HH:mm')}</span>
                          </>
                        )}
                      </div>

                      {/* Metadata details */}
                      {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {alert.metadata.delete_count && (
                            <Badge variant="outline" className="text-[10px]">
                              {alert.metadata.delete_count} deletes
                            </Badge>
                          )}
                          {alert.metadata.action_count && (
                            <Badge variant="outline" className="text-[10px]">
                              {alert.metadata.action_count} actions
                            </Badge>
                          )}
                          {alert.metadata.move_count && (
                            <Badge variant="outline" className="text-[10px]">
                              {alert.metadata.move_count} moves
                            </Badge>
                          )}
                          {alert.metadata.unique_entities && (
                            <Badge variant="outline" className="text-[10px]">
                              {alert.metadata.unique_entities} entities
                            </Badge>
                          )}
                          {alert.metadata.window_minutes && (
                            <Badge variant="outline" className="text-[10px]">
                              in {alert.metadata.window_minutes}min window
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isActive && (
                    <div className="flex items-center gap-1 shrink-0">
                      {alert.status === 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] gap-1"
                          onClick={() => updateStatus(alert.id, 'investigating')}
                        >
                          <Eye className="h-3 w-3" /> Investigate
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => updateStatus(alert.id, 'resolved')}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] gap-1 text-muted-foreground"
                        onClick={() => updateStatus(alert.id, 'dismissed')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
