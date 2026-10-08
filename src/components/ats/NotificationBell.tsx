import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { Bell, Check, CheckCheck, X, MessageSquare, CalendarDays, AtSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string; user_id: string; type: string; entity_type: string;
  entity_id: string | null; content: string; read: boolean; created_at: string;
}

interface Props { onOpenCandidate?: (candidateId: string) => void; }

const TYPE_ICONS: Record<string, typeof Bell> = {
  mention: AtSign, comment: MessageSquare, interview: CalendarDays,
};

export function NotificationBell({ onOpenCandidate }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase.from('notifications' as any).select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50) as any);
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => { const n = payload.new as Notification; setNotifications(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev]); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const markAsRead = async (id: string) => { await (supabase.from('notifications' as any).update({ read: true }).eq('id', id) as any); setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n)); };
  const markAllAsRead = async () => { if (!user) return; const unreadIds = notifications.filter(n => !n.read).map(n => n.id); if (unreadIds.length === 0) return; await (supabase.from('notifications' as any).update({ read: true }).in('id', unreadIds) as any); setNotifications(prev => prev.map(n => ({ ...n, read: true }))); };
  const handleClick = (n: Notification) => { markAsRead(n.id); if (n.entity_type === 'candidate' && n.entity_id && onOpenCandidate) { onOpenCandidate(n.entity_id); setOpen(false); } };
  const deleteNotification = async (id: string) => { await (supabase.from('notifications' as any).delete().eq('id', id) as any); setNotifications(prev => prev.filter(n => n.id !== id)); };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] px-1 text-[10px] font-bold bg-destructive text-destructive-foreground rounded-full flex items-center justify-center leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold">{t('notifications.title')}</span>
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="text-[11px] text-primary hover:text-primary/80 font-medium flex items-center gap-1">
              <CheckCheck className="h-3 w-3" />
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/60">{t('notifications.noNotifications')}</p>
            </div>
          ) : (
            <div>
              {notifications.map(n => {
                const Icon = TYPE_ICONS[n.type] || Bell;
                return (
                  <div key={n.id} className={`group flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50 ${!n.read ? 'bg-primary/5' : ''}`} onClick={() => handleClick(n)}>
                    <div className={`mt-0.5 h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${!n.read ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{n.content}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</p>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteNotification(n.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 mt-1"><X className="h-3 w-3" /></button>
                    {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-2" />}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
