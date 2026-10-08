import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, Plus, ArrowRightLeft, UserPlus, Pencil } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';

interface BoardActivity {
  id: string;
  board_id: string;
  user_id: string;
  action: string;
  created_at: string;
  profiles?: { name: string } | null;
}

interface Props {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const actionIcon: Record<string, typeof Plus> = {
  task_created: Plus,
  task_moved: ArrowRightLeft,
  candidate_added: UserPlus,
  column_renamed: Pencil,
};

function getActionIcon(action: string) {
  const key = action.split(':')[0];
  const Icon = actionIcon[key] || Activity;
  return <Icon className="h-3 w-3" />;
}

function getActionText(action: string, t: (key: string, params?: Record<string, any>) => string) {
  const [type, ...rest] = action.split(':');
  const detail = rest.join(':').trim();
  switch (type) {
    case 'task_created': return t('boardActivityLog.createdTask', { detail });
    case 'task_moved': return t('boardActivityLog.movedTask', { detail });
    case 'candidate_added': return t('boardActivityLog.addedCandidate', { detail });
    case 'column_renamed': return t('boardActivityLog.renamedColumn', { detail });
    default: return action;
  }
}

export function BoardActivityLog({ boardId, open, onOpenChange }: Props) {
  const { t } = useLanguage();
  const [activities, setActivities] = useState<BoardActivity[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('board_activities')
        .select('id, board_id, user_id, action, created_at')
        .eq('board_id', boardId)
        .order('created_at', { ascending: false })
        .limit(20) as any);

      if (error) {
        console.warn('[BoardActivityLog] fetch error:', error.message);
        setActivities([]);
        setLoading(false);
        return;
      }

      const items = (data || []) as BoardActivity[];

      // Fetch profile names separately (no FK join needed)
      const userIds = [...new Set(items.map(a => a.user_id).filter(Boolean))];
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds) as any);
        if (profiles) {
          for (const p of profiles as { id: string; name: string }[]) {
            nameMap[p.id] = p.name || '';
          }
        }
      }

      setActivities(items.map(a => ({
        ...a,
        profiles: { name: nameMap[a.user_id] || '' },
      })));
    } catch (err) {
      console.warn('[BoardActivityLog] error:', err);
      setActivities([]);
    }
    setLoading(false);
  }, [boardId]);

  useEffect(() => {
    if (open) fetchActivities();
  }, [open, fetchActivities]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96 p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4 text-primary" />
            {t('boardActivityLog.title')}
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="px-4 py-3 space-y-1">
            {loading && <p className="text-xs text-muted-foreground text-center py-8">{t('boardActivityLog.loading')}</p>}
            {!loading && activities.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">{t('boardActivityLog.noActivity')}</p>
            )}
            {activities.map((a) => (
              <div key={a.id} className="flex gap-2.5 py-2 border-b border-border/50 last:border-0">
                <Avatar className="h-6 w-6 mt-0.5 shrink-0">
                  <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                    {(a.profiles?.name || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-muted-foreground shrink-0">{getActionIcon(a.action)}</span>
                    <p className="text-xs text-foreground leading-relaxed">
                      <span className="font-medium">{a.profiles?.name || 'Unknown'}</span>{' '}
                      {getActionText(a.action, t)}
                    </p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}