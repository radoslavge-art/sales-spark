import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity } from '@/types/activity';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Props {
  entityId: string;
  entityType?: string;
}

export function ActivityFeed({ entityId, entityType = 'candidate' }: Props) {
  const [activities, setActivities] = useState<(Activity & { userName: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data } = await (supabase.from('activities' as any)
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false })
        .limit(20) as any);

      const items = (data as Activity[]) || [];

      // Get unique user IDs and fetch names
      const userIds = [...new Set(items.map(a => a.user_id).filter(Boolean))] as string[];
      let nameMap: Record<string, string> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await (supabase.from('profiles' as any)
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
        userName: (a.user_id && nameMap[a.user_id]) || 'Unknown user',
      })));
      setLoading(false);
    };
    fetchData();
  }, [entityId, entityType]);

  if (loading) return <p className="text-xs text-muted-foreground">Loading activity...</p>;
  if (!activities.length) return <p className="text-xs text-muted-foreground">No activity yet.</p>;

  return (
    <ScrollArea className="max-h-48">
      <div className="space-y-2">
        {activities.map((a) => (
          <div key={a.id}>
            <p className="text-xs text-foreground">
              <span className="font-medium">{a.userName}</span>{' '}
              {a.action}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
            </p>
            <Separator className="mt-2" />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
