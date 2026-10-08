import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, differenceInMinutes } from 'date-fns';
import { Circle, Clock, RefreshCw, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SessionRow {
  id: string;
  user_id: string;
  login_at: string;
  last_active_at: string;
  logout_at: string | null;
}

interface UserSummary {
  user_id: string;
  name: string;
  email: string;
  isActive: boolean;
  lastSeen: Date;
  totalSessions: number;
  totalMinutes: number;
}

export function AdminUserSessions() {
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    setLoading(true);
    const { data: sessionData } = await (supabase
      .from('user_sessions' as any)
      .select('*')
      .order('login_at', { ascending: false })
      .limit(1000) as any);

    if (!sessionData || sessionData.length === 0) {
      setUsers([]);
      setLoading(false);
      return;
    }

    const userIds = [...new Set((sessionData as SessionRow[]).map(s => s.user_id))];
    const { data: profiles } = await (supabase
      .from('profiles' as any)
      .select('id, name, email')
      .in('id', userIds) as any);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, { name: p.name, email: p.email }]));

    // Aggregate per user
    const userMap = new Map<string, UserSummary>();

    for (const s of sessionData as SessionRow[]) {
      const existing = userMap.get(s.user_id);
      const end = s.logout_at ? new Date(s.logout_at) : new Date(s.last_active_at);
      const mins = Math.max(0, differenceInMinutes(end, new Date(s.login_at)));
      const active = !s.logout_at && differenceInMinutes(new Date(), new Date(s.last_active_at)) < 10;
      const lastSeen = new Date(s.last_active_at);

      if (existing) {
        existing.totalSessions += 1;
        existing.totalMinutes += mins;
        if (active) existing.isActive = true;
        if (lastSeen > existing.lastSeen) existing.lastSeen = lastSeen;
      } else {
        const p = profileMap.get(s.user_id) as { name: string; email: string } | undefined;
        userMap.set(s.user_id, {
          user_id: s.user_id,
          name: p?.name || '—',
          email: p?.email || '',
          isActive: active,
          lastSeen,
          totalSessions: 1,
          totalMinutes: mins,
        });
      }
    }

    // Sort: active first, then by last seen
    const sorted = [...userMap.values()].sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.lastSeen.getTime() - a.lastSeen.getTime();
    });

    setUsers(sorted);
    setLoading(false);
  };

  useEffect(() => { fetchSessions(); }, []);

  const formatDuration = (mins: number) => {
    if (mins < 1) return '< 1m';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    if (hours < 24) return `${hours}h ${rem}m`;
    const days = Math.floor(hours / 24);
    const remH = hours % 24;
    return `${days}d ${remH}h`;
  };

  const activeCount = users.filter(u => u.isActive).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Activity</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeCount > 0 ? (
              <span className="flex items-center gap-1.5">
                <Circle className="h-2.5 w-2.5 fill-emerald-500 text-emerald-500" />
                {activeCount} online now
              </span>
            ) : (
              'No active users'
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchSessions} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sessions recorded yet.</p>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Total Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.user_id} className={u.isActive ? 'bg-emerald-500/5' : ''}>
                  <TableCell>
                    {u.isActive ? (
                      <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-[10px] gap-1">
                        <Circle className="h-1.5 w-1.5 fill-current" /> Online
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Offline</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-sm text-foreground">{u.name}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.isActive ? 'Now' : formatDistanceToNow(u.lastSeen, { addSuffix: true })}
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {u.totalSessions}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatDuration(u.totalMinutes)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
