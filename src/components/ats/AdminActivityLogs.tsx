import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CalendarDays, ChevronLeft, ChevronRight, Search, X, Filter, UserCheck } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  userName?: string;
  userEmail?: string;
}

const ENTITY_TYPES = ['board', 'column', 'candidate', 'task', 'comment', 'interview'];
const ACTIONS = [
  'create_card', 'move_card', 'delete_column', 'rename_column',
  'add_candidate_to_board', 'add_comment', 'create_interview',
  'update_interview', 'delete_interview',
];

const PAGE_SIZE = 50;

const ACTION_COLORS: Record<string, string> = {
  create_card: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  move_card: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  delete_column: 'bg-destructive/10 text-destructive',
  rename_column: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  add_candidate_to_board: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  add_comment: 'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  create_interview: 'bg-teal-500/10 text-teal-700 dark:text-teal-400',
  update_interview: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  delete_interview: 'bg-destructive/10 text-destructive',
};

export function AdminActivityLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);

  // Filters
  const [filterAction, setFilterAction] = useState('all');
  const [filterEntityType, setFilterEntityType] = useState('all');
  const [filterUser, setFilterUser] = useState('all');
  const [filterBoard, setFilterBoard] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);

  // Users & boards for filter dropdowns
  const [users, setUsers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadUsers();
    loadBoards();
  }, []);

  useEffect(() => {
    setPage(0);
    fetchLogs(0);
  }, [filterAction, filterEntityType, filterUser, filterBoard, dateFrom, dateTo]);

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, name, email');
    if (data) setUsers(data.map(p => ({ id: p.id, name: p.name || '', email: p.email || '' })));
  };

  const loadBoards = async () => {
    const { data } = await supabase.from('boards').select('id, name').is('deleted_at', null).order('name');
    if (data) setBoards(data.map(b => ({ id: b.id, name: b.name })));
  };

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      let query = (supabase.from('activity_logs' as any).select('*', { count: 'exact' }) as any);

      if (filterAction !== 'all') query = query.eq('action', filterAction);
      if (filterEntityType !== 'all') query = query.eq('entity_type', filterEntityType);
      if (filterUser !== 'all') query = query.eq('user_id', filterUser);
      if (filterBoard !== 'all') query = query.contains('metadata', { board_id: filterBoard });
      if (dateFrom) query = query.gte('created_at', dateFrom.toISOString());
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        query = query.lte('created_at', end.toISOString());
      }

      query = query
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;
      if (error) { console.error('Fetch logs error:', error); setLoading(false); return; }

      const profileMap = new Map(users.map(u => [u.id, u]));
      const enriched = ((data || []) as AuditLog[]).map(log => ({
        ...log,
        userName: profileMap.get(log.user_id)?.name || '',
        userEmail: profileMap.get(log.user_id)?.email || log.user_id,
      }));

      setLogs(enriched);
      setTotalCount(count);
      setHasMore(enriched.length === PAGE_SIZE);
      setPage(pageNum);
    } catch (err) {
      console.error('Fetch logs threw:', err);
    }
    setLoading(false);
  }, [filterAction, filterEntityType, filterUser, filterBoard, dateFrom, dateTo, users]);

  const filteredLogs = searchQuery
    ? logs.filter(l =>
        l.action.includes(searchQuery.toLowerCase()) ||
        l.entity_type.includes(searchQuery.toLowerCase()) ||
        l.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(l.metadata).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : logs;

  const clearFilters = () => {
    setFilterAction('all');
    setFilterEntityType('all');
    setFilterUser('all');
    setFilterBoard('all');
    setSearchQuery('');
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = filterAction !== 'all' || filterEntityType !== 'all' || filterUser !== 'all' || filterBoard !== 'all' || searchQuery || dateFrom || dateTo;
  const activeFilterCount = [filterAction, filterEntityType, filterUser, filterBoard].filter(f => f !== 'all').length + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0);

  const getMetadataSummary = (log: AuditLog) => {
    const m = log.metadata || {};
    const parts: string[] = [];
    if (m.title) parts.push(m.title);
    if (m.name) parts.push(m.name);
    if (m.candidate_name) parts.push(m.candidate_name);
    if (m.old_value && m.new_value) parts.push(`"${m.old_value}" → "${m.new_value}"`);
    if (m.column_from && m.column_to) parts.push(`${m.column_from} → ${m.column_to}`);
    if (m.new_status) parts.push(`→ ${m.new_status}`);
    return parts.join(' · ') || '—';
  };

  const handleQuickFilterUser = (userId: string) => {
    setFilterUser(userId);
  };

  // Find the filtered user's name for the active filter pill
  const filteredUserName = filterUser !== 'all'
    ? users.find(u => u.id === filterUser)?.name || users.find(u => u.id === filterUser)?.email || filterUser
    : null;
  const filteredBoardName = filterBoard !== 'all'
    ? boards.find(b => b.id === filterBoard)?.name || filterBoard
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">Activity Logs</h2>
        {totalCount !== null && (
          <span className="text-xs text-muted-foreground">{totalCount} total entries</span>
        )}
      </div>

      {/* Active filter pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Active:</span>
          {filteredUserName && (
            <Badge variant="secondary" className="text-[11px] gap-1 pr-1">
              User: {filteredUserName}
              <button onClick={() => setFilterUser('all')} className="ml-0.5 rounded-full hover:bg-accent p-0.5"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {filterEntityType !== 'all' && (
            <Badge variant="secondary" className="text-[11px] gap-1 pr-1 capitalize">
              Type: {filterEntityType}
              <button onClick={() => setFilterEntityType('all')} className="ml-0.5 rounded-full hover:bg-accent p-0.5"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {filteredBoardName && (
            <Badge variant="secondary" className="text-[11px] gap-1 pr-1">
              Board: {filteredBoardName}
              <button onClick={() => setFilterBoard('all')} className="ml-0.5 rounded-full hover:bg-accent p-0.5"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {filterAction !== 'all' && (
            <Badge variant="secondary" className="text-[11px] gap-1 pr-1">
              Action: {filterAction.replace(/_/g, ' ')}
              <button onClick={() => setFilterAction('all')} className="ml-0.5 rounded-full hover:bg-accent p-0.5"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {dateFrom && (
            <Badge variant="secondary" className="text-[11px] gap-1 pr-1">
              From: {format(dateFrom, 'dd MMM')}
              <button onClick={() => setDateFrom(undefined)} className="ml-0.5 rounded-full hover:bg-accent p-0.5"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          {dateTo && (
            <Badge variant="secondary" className="text-[11px] gap-1 pr-1">
              To: {format(dateTo, 'dd MMM')}
              <button onClick={() => setDateTo(undefined)} className="ml-0.5 rounded-full hover:bg-accent p-0.5"><X className="h-2.5 w-2.5" /></button>
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-[11px] px-2 text-muted-foreground">
            Clear all
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className="pl-8 h-8 text-sm"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={cn("h-8 text-xs gap-1.5", hasActiveFilters && "border-primary/50 bg-primary/5 text-primary")}>
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] leading-none bg-primary/15 text-primary">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">User</label>
                <Select value={filterUser} onValueChange={setFilterUser}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name || u.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Board</label>
                <Select value={filterBoard} onValueChange={setFilterBoard}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All boards</SelectItem>
                    {boards.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Entity type</label>
                <Select value={filterEntityType} onValueChange={setFilterEntityType}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {ENTITY_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground mb-1 block">Action</label>
                <Select value={filterAction} onValueChange={setFilterAction}>
                  <SelectTrigger className="h-8 text-xs w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {ACTIONS.map(a => (
                      <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">From</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-8 text-xs w-full justify-start gap-1.5", dateFrom && "border-primary text-primary")}>
                        <CalendarDays className="h-3 w-3" />
                        {dateFrom ? format(dateFrom, 'dd MMM') : 'Any'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">To</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className={cn("h-8 text-xs w-full justify-start gap-1.5", dateTo && "border-primary text-primary")}>
                        <CalendarDays className="h-3 w-3" />
                        {dateTo ? format(dateTo, 'dd MMM') : 'Any'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1.5" /> Clear all filters
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[160px]">User</TableHead>
              <TableHead className="w-[150px]">Action</TableHead>
              <TableHead className="w-[100px]">Entity</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="w-[140px] text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  No activity logs found
                </TableCell>
              </TableRow>
            ) : filteredLogs.map(log => (
              <TableRow key={log.id} className="group">
                <TableCell>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{log.userName || '—'}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{log.userEmail}</p>
                    </div>
                    {filterUser !== log.user_id && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleQuickFilterUser(log.user_id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-accent transition-opacity shrink-0"
                          >
                            <UserCheck className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="text-xs">Show only this user</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={cn("text-[10px] font-mono", ACTION_COLORS[log.action] || '')}
                  >
                    {log.action.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-xs text-muted-foreground capitalize">{log.entity_type}</span>
                </TableCell>
                <TableCell>
                  <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                    {getMetadataSummary(log)}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {format(new Date(log.created_at), 'dd MMM HH:mm')}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Page {page + 1}{totalCount !== null ? ` of ${Math.max(1, Math.ceil(totalCount / PAGE_SIZE))}` : ''}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(page - 1)}
            disabled={page === 0 || loading}
            className="h-7 text-xs gap-1"
          >
            <ChevronLeft className="h-3 w-3" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs(page + 1)}
            disabled={!hasMore || loading}
            className="h-7 text-xs gap-1"
          >
            Next <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
