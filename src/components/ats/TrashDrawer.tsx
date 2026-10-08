import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useATS } from '@/context/ATSContext';
import { Trash2, RotateCcw, Building2, Briefcase, User, LayoutGrid, Columns, StickyNote, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface DeletedItem {
  id: string;
  name: string;
  type: 'company' | 'position' | 'candidate' | 'board_task' | 'board_column' | 'board' | 'weekly_report' | 'weekly_report_row';
  table: string;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_name?: string;
  meta?: string;
  board_id?: string;
  canWrite?: boolean;
}

export type TrashScope =
  | { type: 'board'; boardId: string }
  | { type: 'company'; companyId: string }
  | { type: 'global' };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreComplete?: () => void;
  scope?: TrashScope;
}

const PAGE_SIZE = 20;

export function TrashDrawer({ open, onOpenChange, onRestoreComplete, scope = { type: 'global' } }: Props) {
  const { user } = useAuth();
  const { restoreDeletedItem } = useATS();
  const [items, setItems] = useState<DeletedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [permanentDeleteId, setPermanentDeleteId] = useState<DeletedItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [totalCount, setTotalCount] = useState(0);

  // Cache for permission lookups
  const isAdminRef = useRef(false);
  const boardRolesRef = useRef(new Map<string, string>());
  const profileCacheRef = useRef(new Map<string, string>());
  const hasFetchedRef = useRef(false);

  const itemKey = (item: DeletedItem) => `${item.table}-${item.id}`;

  // Fetch a single page of deleted items across all tables, merged & sorted by deleted_at desc
  const fetchPage = useCallback(async (offset: number, isInitial: boolean) => {
    if (!user) return;

    if (isInitial) {
      setLoading(true);
      hasFetchedRef.current = false;
      boardRolesRef.current = new Map();
      profileCacheRef.current = new Map();

      // Check admin status once
      const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle();
      isAdminRef.current = !!roleData;
    } else {
      setLoadingMore(true);
    }

    // Fetch all deleted items (we need to merge-sort across tables, so fetch all IDs but only hydrate a page)
    // For efficiency: fetch with limit per table on initial, then paginate the merged list
    if (!hasFetchedRef.current || isInitial) {
      // Scope-aware fetching: only query relevant tables
      const isGlobal = scope.type === 'global';
      const isBoard = scope.type === 'board';
      const isCompany = scope.type === 'company';
      const boardScopeId = isBoard ? (scope as { type: 'board'; boardId: string }).boardId : null;
      const companyScopeId = isCompany ? (scope as { type: 'company'; companyId: string }).companyId : null;

      const queries: Record<string, any> = {};

      if (isGlobal) {
        queries.companies = supabase.from('companies').select('id, name, deleted_at, deleted_by').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.positions = supabase.from('positions').select('id, title, deleted_at, deleted_by, company_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.candidates = supabase.from('candidates').select('id, name, deleted_at, deleted_by').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.boardTasks = supabase.from('board_tasks').select('id, title, deleted_at, deleted_by, board_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.personalTasks = supabase.from('personal_tasks').select('id, title, deleted_at, deleted_by').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.boardCols = supabase.from('board_columns').select('id, label, deleted_at, deleted_by, board_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.personalCols = supabase.from('personal_columns').select('id, label, deleted_at, deleted_by').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.boards = supabase.from('boards').select('id, name, deleted_at, deleted_by, owner_id').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.weeklyReports = supabase.from('weekly_reports').select('id, week_start_date, week_end_date, deleted_at, deleted_by').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.weeklyReportRows = supabase.from('weekly_report_rows').select('id, company_name, position_name, deleted_at, deleted_by').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
      } else if (isBoard && boardScopeId) {
        queries.boardTasks = supabase.from('board_tasks').select('id, title, deleted_at, deleted_by, board_id').eq('board_id', boardScopeId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.boardCols = supabase.from('board_columns').select('id, label, deleted_at, deleted_by, board_id').eq('board_id', boardScopeId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
      } else if (isCompany && companyScopeId) {
        queries.companies = supabase.from('companies').select('id, name, deleted_at, deleted_by').eq('id', companyScopeId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        queries.positions = supabase.from('positions').select('id, title, deleted_at, deleted_by, company_id').eq('company_id', companyScopeId).not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        // Fetch candidates belonging to positions of this company
        const { data: posData } = await supabase.from('positions').select('id').eq('company_id', companyScopeId);
        const posIds = (posData || []).map((p: any) => p.id);
        if (posIds.length > 0) {
          queries.candidates = supabase.from('candidates').select('id, name, deleted_at, deleted_by').in('position_id', posIds).not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        }
      }

      const keys = Object.keys(queries);
      const results = await Promise.all(Object.values(queries));
      const dataMap: Record<string, any[]> = {};
      keys.forEach((k, i) => { dataMap[k] = results[i].data || []; });

      // Collect board IDs for role resolution
      const boardIds = new Set<string>();
      (dataMap.boardTasks || []).forEach((t: any) => { if (t.board_id) boardIds.add(t.board_id); });
      (dataMap.boardCols || []).forEach((c: any) => { if (c.board_id) boardIds.add(c.board_id); });
      (dataMap.boards || []).forEach((b: any) => boardIds.add(b.id));

      // Resolve board roles in parallel
      const rolePromises = [...boardIds].filter(bid => !boardRolesRef.current.has(bid)).map(async (bid) => {
        const { data: role } = await supabase.rpc('get_board_role', { _user_id: user.id, _board_id: bid });
        if (role) boardRolesRef.current.set(bid, role);
      });
      await Promise.all(rolePromises);

      const canWriteBoard = (boardId?: string) => {
        if (isAdminRef.current) return true;
        if (!boardId) return true;
        const role = boardRolesRef.current.get(boardId);
        return role === 'owner' || role === 'editor';
      };

      const all: DeletedItem[] = [
        ...(dataMap.boards || []).map((b: any) => ({ id: b.id, name: b.name, type: 'board' as const, table: 'boards', deleted_at: b.deleted_at, deleted_by: b.deleted_by, board_id: b.id, canWrite: isAdminRef.current || b.owner_id === user.id })),
        ...(dataMap.companies || []).map((c: any) => ({ id: c.id, name: c.name, type: 'company' as const, table: 'companies', deleted_at: c.deleted_at, deleted_by: c.deleted_by, canWrite: true })),
        ...(dataMap.positions || []).map((p: any) => ({ id: p.id, name: p.title, type: 'position' as const, table: 'positions', deleted_at: p.deleted_at, deleted_by: p.deleted_by, canWrite: true })),
        ...(dataMap.candidates || []).map((c: any) => ({ id: c.id, name: c.name, type: 'candidate' as const, table: 'candidates', deleted_at: c.deleted_at, deleted_by: c.deleted_by, canWrite: true })),
        ...(dataMap.boardTasks || []).map((t: any) => ({ id: t.id, name: t.title, type: 'board_task' as const, table: 'board_tasks', deleted_at: t.deleted_at, deleted_by: t.deleted_by, meta: 'Board card', board_id: t.board_id, canWrite: canWriteBoard(t.board_id) })),
        ...(dataMap.personalTasks || []).map((t: any) => ({ id: t.id, name: t.title, type: 'board_task' as const, table: 'personal_tasks', deleted_at: t.deleted_at, deleted_by: t.deleted_by, meta: 'Personal card', canWrite: true })),
        ...(dataMap.boardCols || []).map((c: any) => ({ id: c.id, name: c.label, type: 'board_column' as const, table: 'board_columns', deleted_at: c.deleted_at, deleted_by: c.deleted_by, meta: 'Board column', board_id: c.board_id, canWrite: canWriteBoard(c.board_id) })),
        ...(dataMap.personalCols || []).map((c: any) => ({ id: c.id, name: c.label, type: 'board_column' as const, table: 'personal_columns', deleted_at: c.deleted_at, deleted_by: c.deleted_by, meta: 'Personal column', canWrite: true })),
        ...(dataMap.weeklyReports || []).map((r: any) => ({ id: r.id, name: `Week ${r.week_start_date} – ${r.week_end_date}`, type: 'weekly_report' as const, table: 'weekly_reports', deleted_at: r.deleted_at, deleted_by: r.deleted_by, meta: 'Weekly report', canWrite: true })),
        ...(dataMap.weeklyReportRows || []).map((r: any) => ({ id: r.id, name: [r.company_name, r.position_name].filter(Boolean).join(' · ') || 'Report row', type: 'weekly_report_row' as const, table: 'weekly_report_rows', deleted_at: r.deleted_at, deleted_by: r.deleted_by, meta: 'Report row', canWrite: true })),
      ];

      all.sort((a, b) => new Date(b.deleted_at).getTime() - new Date(a.deleted_at).getTime());

      // Resolve profile names for the page we're about to show
      const pageSlice = all.slice(0, offset + PAGE_SIZE);
      const userIds = [...new Set(pageSlice.map(i => i.deleted_by).filter(Boolean))] as string[];
      const uncachedIds = userIds.filter(id => !profileCacheRef.current.has(id));
      if (uncachedIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', uncachedIds);
        (profiles || []).forEach(p => profileCacheRef.current.set(p.id, p.name));
      }
      all.forEach(item => {
        if (item.deleted_by) item.deleted_by_name = profileCacheRef.current.get(item.deleted_by) || undefined;
      });

      setTotalCount(all.length);
      setItems(all.slice(0, offset + PAGE_SIZE));
      setHasMore(all.length > offset + PAGE_SIZE);
      hasFetchedRef.current = true;

      // Store full list for pagination
      fullListRef.current = all;
    } else {
      // Paginate from cached full list
      const all = fullListRef.current;
      const nextSlice = all.slice(0, offset + PAGE_SIZE);

      // Resolve any new profile names
      const userIds = [...new Set(nextSlice.map(i => i.deleted_by).filter(Boolean))] as string[];
      const uncachedIds = userIds.filter(id => !profileCacheRef.current.has(id));
      if (uncachedIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', uncachedIds);
        (profiles || []).forEach(p => profileCacheRef.current.set(p.id, p.name));
      }
      nextSlice.forEach(item => {
        if (item.deleted_by) item.deleted_by_name = profileCacheRef.current.get(item.deleted_by) || undefined;
      });

      setItems(nextSlice);
      setHasMore(all.length > offset + PAGE_SIZE);
    }

    setLoading(false);
    setLoadingMore(false);
  }, [user, scope]);

  const fullListRef = useRef<DeletedItem[]>([]);
  // Fetch when drawer opens (controlled prop)
  useEffect(() => {
    if (open) {
      setItems([]);
      setSelected(new Set());
      setActiveTab('all');
      hasFetchedRef.current = false;
      fullListRef.current = [];
      fetchPage(0, true);
    } else {
      hasFetchedRef.current = false;
      fullListRef.current = [];
    }
  }, [open, fetchPage]);

  const handleOpenChange = useCallback((v: boolean) => {
    onOpenChange(v);
  }, [onOpenChange]);

  const loadMore = useCallback(() => {
    fetchPage(items.length, false);
  }, [fetchPage, items.length]);

  const refreshTrash = useCallback(async () => {
    setSelected(new Set());
    await fetchPage(0, true);
    onRestoreComplete?.();
  }, [fetchPage, onRestoreComplete]);

  /** Restore ALL deleted children matching a relationship filter (no time windows) */
  const cascadeRestore = async (table: string, filter: Record<string, string>) => {
    const col = Object.keys(filter)[0];
    const val = Object.values(filter)[0];
    await (supabase.from(table as any).update({ deleted_at: null, deleted_by: null } as any)
      .eq(col, val)
      .not('deleted_at', 'is', null) as any);
  };

  /** Ensure a parent entity is active — restore it if soft-deleted, or return false if missing entirely */
  const ensureParentActive = async (table: string, id: string): Promise<boolean> => {
    const { data, error } = await (supabase.from(table as any).select('id, deleted_at').eq('id', id).maybeSingle() as any);
    if (error || !data) return false;
    if (data.deleted_at) {
      await (supabase.from(table as any).update({ deleted_at: null, deleted_by: null } as any).eq('id', id) as any);
    }
    return true;
  };

  /** Get the first active column for a board/personal scope to use as fallback */
  const getDefaultColumn = async (item: DeletedItem): Promise<string | null> => {
    if (item.table === 'board_tasks' && item.board_id) {
      const { data } = await supabase.from('board_columns').select('id').eq('board_id', item.board_id).is('deleted_at', null).order('sort_order').limit(1);
      return data?.[0]?.id || null;
    }
    if (item.table === 'personal_tasks' && user) {
      const { data } = await supabase.from('personal_columns').select('id').eq('user_id', user.id).is('deleted_at', null).order('sort_order').limit(1);
      return data?.[0]?.id || null;
    }
    return null;
  };

  const handleRestore = async (item: DeletedItem) => {
    // Skip if already active (prevent duplicate restore)
    const { data: current } = await (supabase.from(item.table as any).select('id, deleted_at').eq('id', item.id).maybeSingle() as any);
    if (!current) { toast({ title: 'Item no longer exists', variant: 'destructive' }); return; }
    if (!current.deleted_at) { toast({ title: `"${item.name}" is already active` }); return; }

    // ── ATS entities (companies, positions, candidates) ──
    if (['companies', 'positions', 'candidates'].includes(item.table)) {
      await restoreDeletedItem(item.table as 'companies' | 'positions' | 'candidates', item.id);
      if (item.table === 'companies') {
        await cascadeRestore('stages', { company_id: item.id });
        await cascadeRestore('positions', { company_id: item.id });
        // Restore candidates under all positions of this company
        const { data: positions } = await supabase.from('positions').select('id').eq('company_id', item.id).is('deleted_at', null);
        if (positions) {
          for (const p of positions) {
            await cascadeRestore('candidates', { position_id: p.id });
          }
        }
      }
      if (item.table === 'positions') {
        await cascadeRestore('candidates', { position_id: item.id });
      }
      await refreshTrash();
      return;
    }

    // ── Board restore: restore board → ALL columns → ALL tasks by board_id ──
    if (item.table === 'boards') {
      await (supabase.from('boards').update({ deleted_at: null, deleted_by: null } as any).eq('id', item.id) as any);
      // Restore ALL deleted columns belonging to this board
      await cascadeRestore('board_columns', { board_id: item.id });
      // Restore ALL deleted tasks belonging to this board
      await cascadeRestore('board_tasks', { board_id: item.id });
      // Fix orphan tasks (column_id pointing to still-deleted or missing columns)
      const { data: activeCols } = await supabase.from('board_columns').select('id').eq('board_id', item.id).is('deleted_at', null);
      const activeColIds = new Set((activeCols || []).map((c: any) => c.id));
      if (activeColIds.size > 0) {
        const defaultColId = [...activeColIds][0];
        const { data: allTasks } = await (supabase.from('board_tasks')
          .select('id, column_id').eq('board_id', item.id).is('deleted_at', null) as any);
        for (const t of allTasks || []) {
          if (!t.column_id || !activeColIds.has(t.column_id)) {
            await (supabase.from('board_tasks').update({ column_id: defaultColId } as any).eq('id', t.id) as any);
          }
        }
      }
      await refreshTrash();
      toast({ title: `"${item.name}" and all its contents restored` });
      return;
    }

    // ── Column restore: ensure parent board is active, then restore column + its tasks ──
    if (item.table === 'board_columns' || item.table === 'personal_columns') {
      // For board columns, ensure the parent board exists and is active
      if (item.table === 'board_columns' && item.board_id) {
        const boardOk = await ensureParentActive('boards', item.board_id);
        if (!boardOk) { toast({ title: 'Parent board no longer exists', variant: 'destructive' }); return; }
      }
      await (supabase.from(item.table as any).update({ deleted_at: null, deleted_by: null } as any).eq('id', item.id) as any);
      // Cascade restore ALL child tasks in this column
      const taskTable = item.table === 'board_columns' ? 'board_tasks' : 'personal_tasks';
      await cascadeRestore(taskTable, { column_id: item.id });
      await refreshTrash();
      toast({ title: `"${item.name}" and its cards restored` });
      return;
    }

    // ── Task/card restore: ensure parent column (and board) are active ──
    if (item.table === 'board_tasks' || item.table === 'personal_tasks') {
      const task = await (supabase.from(item.table as any).select('column_id, board_id').eq('id', item.id).single() as any);
      const columnId = task.data?.column_id;
      const boardId = task.data?.board_id || item.board_id;

      // For board tasks, ensure board is active first
      if (item.table === 'board_tasks' && boardId) {
        const boardOk = await ensureParentActive('boards', boardId);
        if (!boardOk) { toast({ title: 'Parent board no longer exists', variant: 'destructive' }); return; }
      }

      let finalColumnId = columnId;
      if (columnId) {
        const colTable = item.table === 'board_tasks' ? 'board_columns' : 'personal_columns';
        const colOk = await ensureParentActive(colTable, columnId);
        if (!colOk) {
          // Column was permanently deleted — move to default column
          finalColumnId = await getDefaultColumn(item);
          if (!finalColumnId) { toast({ title: 'No column available to restore into', variant: 'destructive' }); return; }
        }
      } else {
        // No column assigned — find default
        finalColumnId = await getDefaultColumn(item);
        if (!finalColumnId) { toast({ title: 'No column available to restore into', variant: 'destructive' }); return; }
      }

      const updatePayload: any = { deleted_at: null, deleted_by: null };
      if (finalColumnId !== columnId) updatePayload.column_id = finalColumnId;
      await (supabase.from(item.table as any).update(updatePayload).eq('id', item.id) as any);
      await refreshTrash();
      toast({ title: `"${item.name}" restored` });
      return;
    }

    // ── Weekly report: restore report + all its rows ──
    if (item.table === 'weekly_reports') {
      await (supabase.from('weekly_reports').update({ deleted_at: null, deleted_by: null } as any).eq('id', item.id) as any);
      await cascadeRestore('weekly_report_rows', { report_id: item.id });
      await refreshTrash();
      toast({ title: `"${item.name}" and its rows restored` });
      return;
    }

    // Fallback
    await (supabase.from(item.table as any).update({ deleted_at: null, deleted_by: null } as any).eq('id', item.id) as any);
    await refreshTrash();
    toast({ title: `"${item.name}" restored` });
  };

  const SAFETY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  /** Check if item is within the safety window; owners can override */
  const isWithinSafetyWindow = (item: DeletedItem): boolean => {
    const elapsed = Date.now() - new Date(item.deleted_at).getTime();
    return elapsed < SAFETY_WINDOW_MS;
  };

  const isItemOwner = (item: DeletedItem): boolean => {
    if (!user) return false;
    // Board entities: check if user is board owner
    if (item.board_id) return boardRolesRef.current.get(item.board_id) === 'owner';
    if (item.table === 'boards') return boardRolesRef.current.get(item.id) === 'owner';
    // ATS entities & admin: always allowed to override
    return isAdminRef.current;
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteId) return;
    const item = permanentDeleteId;

    // Safety window check — owners/admins can override
    if (isWithinSafetyWindow(item) && !isItemOwner(item)) {
      setPermanentDeleteId(null);
      toast({ title: 'Recently deleted', description: 'Recently deleted items can be restored. Try again in a few minutes.' });
      return;
    }

    setPermanentDeleteId(null);

    // Cascade permanent delete for parent entities (children first to avoid FK violations)
    if (item.table === 'companies') {
      const { data: posData } = await supabase.from('positions').select('id').eq('company_id', item.id);
      const posIds = (posData || []).map((p: any) => p.id);
      if (posIds.length > 0) {
        for (const pid of posIds) {
          await (supabase.from('candidate_comments').delete().in('candidate_id',
            (await supabase.from('candidates').select('id').eq('position_id', pid)).data?.map((c: any) => c.id) || []
          ) as any);
          await (supabase.from('candidate_attachments').delete().in('candidate_id',
            (await supabase.from('candidates').select('id').eq('position_id', pid)).data?.map((c: any) => c.id) || []
          ) as any);
          await (supabase.from('candidates').delete().eq('position_id', pid) as any);
        }
        await (supabase.from('positions').delete().eq('company_id', item.id) as any);
      }
      await (supabase.from('stages').delete().eq('company_id', item.id) as any);
    } else if (item.table === 'positions') {
      const { data: cands } = await supabase.from('candidates').select('id').eq('position_id', item.id);
      for (const c of cands || []) {
        await (supabase.from('candidate_comments').delete().eq('candidate_id', c.id) as any);
        await (supabase.from('candidate_attachments').delete().eq('candidate_id', c.id) as any);
      }
      await (supabase.from('candidates').delete().eq('position_id', item.id) as any);
    } else if (item.table === 'boards') {
      await (supabase.from('board_tasks').delete().eq('board_id', item.id) as any);
      await (supabase.from('board_columns').delete().eq('board_id', item.id) as any);
      await (supabase.from('board_activities').delete().eq('board_id', item.id) as any);
      await (supabase.from('board_members').delete().eq('board_id', item.id) as any);
    } else if (item.table === 'board_columns') {
      await (supabase.from('board_tasks').delete().eq('column_id', item.id) as any);
    } else if (item.table === 'personal_columns') {
      await (supabase.from('personal_tasks').delete().eq('column_id', item.id) as any);
    }

    const { error } = await (supabase.from(item.table as any).delete().eq('id', item.id) as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    await refreshTrash();
    toast({ title: `"${item.name}" permanently deleted` });
  };

  const selectedItems = items.filter(i => selected.has(itemKey(i)));

  // Bulk restore: process parents before children to ensure hierarchy
  const handleBulkRestore = async () => {
    const toRestore = [...selectedItems];
    // Sort: boards first, then columns, then tasks/candidates
    const typeOrder: Record<string, number> = { board: 0, company: 0, board_column: 1, position: 1, board_task: 2, candidate: 2 };
    toRestore.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));
    for (const item of toRestore) {
      await handleRestore(item);
    }
    setSelected(new Set());
    toast({ title: `${toRestore.length} item${toRestore.length > 1 ? 's' : ''} restored` });
  };

  // Bulk permanent delete: process children before parents to avoid FK violations
  const handleBulkDelete = async () => {
    setBulkDeleteOpen(false);
    const toDelete = [...selectedItems];

    // Safety window check — block items within 5min unless owner/admin
    const blocked = toDelete.filter(i => isWithinSafetyWindow(i) && !isItemOwner(i));
    if (blocked.length > 0) {
      toast({ title: 'Recently deleted', description: `${blocked.length} item${blocked.length > 1 ? 's were' : ' was'} recently deleted. Try again in a few minutes.` });
      if (blocked.length === toDelete.length) return;
    }
    const allowed = toDelete.filter(i => !isWithinSafetyWindow(i) || isItemOwner(i));

    const typeOrder: Record<string, number> = { board_task: 0, candidate: 0, board_column: 1, position: 1, board: 2, company: 2 };
    allowed.sort((a, b) => (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9));
    let deleted = 0;
    for (const item of allowed) {
      if (['boards', 'board_columns', 'personal_columns', 'companies', 'positions'].includes(item.table)) {
        if (item.table === 'boards') {
          await (supabase.from('board_tasks').delete().eq('board_id', item.id) as any);
          await (supabase.from('board_columns').delete().eq('board_id', item.id) as any);
          await (supabase.from('board_activities').delete().eq('board_id', item.id) as any);
          await (supabase.from('board_members').delete().eq('board_id', item.id) as any);
        } else if (item.table === 'board_columns') {
          await (supabase.from('board_tasks').delete().eq('column_id', item.id) as any);
        } else if (item.table === 'personal_columns') {
          await (supabase.from('personal_tasks').delete().eq('column_id', item.id) as any);
        } else if (item.table === 'companies') {
          const { data: posData } = await supabase.from('positions').select('id').eq('company_id', item.id);
          for (const p of posData || []) {
            await (supabase.from('candidates').delete().eq('position_id', p.id) as any);
          }
          await (supabase.from('stages').delete().eq('company_id', item.id) as any);
          await (supabase.from('positions').delete().eq('company_id', item.id) as any);
        } else if (item.table === 'positions') {
          await (supabase.from('candidates').delete().eq('position_id', item.id) as any);
        }
      }
      const { error } = await (supabase.from(item.table as any).delete().eq('id', item.id) as any);
      if (!error) deleted++;
    }
    setSelected(new Set());
    await refreshTrash();
    toast({ title: `${deleted} item${deleted > 1 ? 's' : ''} permanently deleted` });
  };

  // Apply tab filter against the FULL list (not paginated subset) so counts are accurate
  const fullFiltered = activeTab === 'all'
    ? fullListRef.current
    : activeTab === 'candidate'
      ? fullListRef.current.filter(i => i.type === 'candidate')
      : activeTab === 'card'
        ? fullListRef.current.filter(i => ['board_task', 'board_column', 'board'].includes(i.type))
        : activeTab === 'company'
          ? fullListRef.current.filter(i => ['company', 'position'].includes(i.type))
          : fullListRef.current.filter(i => i.type === activeTab);

  // Apply same filter to the paginated items for display
  const filtered = activeTab === 'all'
    ? items
    : activeTab === 'candidate'
      ? items.filter(i => i.type === 'candidate')
      : activeTab === 'card'
        ? items.filter(i => ['board_task', 'board_column', 'board'].includes(i.type))
        : activeTab === 'company'
          ? items.filter(i => ['company', 'position'].includes(i.type))
          : items.filter(i => i.type === activeTab);

  const displayCount = fullFiltered.length;
  const writableFiltered = filtered.filter(i => i.canWrite !== false);

  const toggleSelect = (item: DeletedItem) => {
    if (item.canWrite === false) return;
    const key = itemKey(item);
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === writableFiltered.length && writableFiltered.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(writableFiltered.map(itemKey)));
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'company': return <Building2 className="h-4 w-4" />;
      case 'position': return <Briefcase className="h-4 w-4" />;
      case 'candidate': return <User className="h-4 w-4" />;
      case 'board_task': return <StickyNote className="h-4 w-4" />;
      case 'board_column': return <Columns className="h-4 w-4" />;
      case 'board': return <LayoutGrid className="h-4 w-4" />;
      case 'weekly_report': return <LayoutGrid className="h-4 w-4" />;
      case 'weekly_report_row': return <StickyNote className="h-4 w-4" />;
      default: return <LayoutGrid className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'company': return 'Company';
      case 'position': return 'Position';
      case 'candidate': return 'Candidate';
      case 'board_task': return 'Card';
      case 'board_column': return 'Column';
      case 'board': return 'Board';
      case 'weekly_report': return 'Report';
      case 'weekly_report_row': return 'Report Row';
      default: return type;
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="sm:max-w-md flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-muted-foreground" />
              Trash
              {displayCount > 0 && (
                <Badge variant="secondary" className="text-xs">{displayCount}</Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setSelected(new Set()); }} className="flex-1 flex flex-col min-h-0">
            {scope.type === 'board' ? (
              <TabsList className="mx-6 mb-2 grid grid-cols-3 h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="card" className="text-xs">Cards</TabsTrigger>
                <TabsTrigger value="board_column" className="text-xs">Columns</TabsTrigger>
              </TabsList>
            ) : scope.type === 'company' ? (
              <TabsList className="mx-6 mb-2 grid grid-cols-3 h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="candidate" className="text-xs">Candidates</TabsTrigger>
                <TabsTrigger value="company" className="text-xs">Positions</TabsTrigger>
              </TabsList>
            ) : (
              <TabsList className="mx-6 mb-2 grid grid-cols-4 h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="candidate" className="text-xs">Candidates</TabsTrigger>
                <TabsTrigger value="company" className="text-xs">Companies</TabsTrigger>
                <TabsTrigger value="card" className="text-xs">Cards</TabsTrigger>
              </TabsList>
            )}

            {/* Bulk action bar */}
            {filtered.length > 0 && (
              <div className="mx-6 mb-2 flex items-center gap-2">
                <Checkbox
                  checked={selected.size === writableFiltered.length && writableFiltered.length > 0}
                  onCheckedChange={toggleSelectAll}
                  className="h-3.5 w-3.5"
                />
                <span className="text-xs text-muted-foreground">
                  {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                </span>
                {selected.size > 0 && (
                  <div className="flex items-center gap-1 ml-auto">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleBulkRestore}>
                      <RotateCcw className="h-3 w-3" /> Restore
                    </Button>
                    <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={() => setBulkDeleteOpen(true)}>
                      <Trash2 className="h-3 w-3" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="flex-1 px-6">
              {loading && (
                <div className="flex items-center justify-center py-12 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              )}

              {!loading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Trash2 className="h-10 w-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground/60">Trash is empty</p>
                  <p className="text-xs text-muted-foreground/40 mt-1">Deleted items will appear here</p>
                </div>
              )}

              <div className="space-y-2 pb-4">
                {filtered.map(item => {
                  const key = itemKey(item);
                  const isSelected = selected.has(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors group cursor-pointer ${
                        isSelected ? 'border-primary/40 bg-primary/5' : 'border-border bg-card hover:bg-accent/30'
                      }`}
                      onClick={() => toggleSelect(item)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(item)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 shrink-0"
                      />
                      <div className="text-muted-foreground shrink-0">
                        {getIcon(item.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                            {getTypeLabel(item.type)}
                          </Badge>
                          {item.meta && (
                            <span className="text-[10px] text-muted-foreground">· {item.meta}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Deleted {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
                          {item.deleted_by_name ? ` by ${item.deleted_by_name}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {item.canWrite !== false && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRestore(item)} title="Restore">
                              <RotateCcw className="h-3.5 w-3.5 text-primary" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => setPermanentDeleteId(item)} title="Delete permanently">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </>
                        )}
                        {item.canWrite === false && (
                          <span className="text-[10px] text-muted-foreground italic px-1">View only</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Load more */}
                {!loading && hasMore && (
                  <div className="flex justify-center pt-2 pb-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                      Load more ({totalCount - items.length} remaining)
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!permanentDeleteId}
        onOpenChange={(v) => { if (!v) setPermanentDeleteId(null); }}
        title="Permanently Delete"
        description={`This will permanently delete "${permanentDeleteId?.name}". This cannot be undone.`}
        onConfirm={handlePermanentDelete}
      />

      <ConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        title="Permanently Delete Selected"
        description={`This will permanently delete ${selected.size} item${selected.size > 1 ? 's' : ''}. This cannot be undone.`}
        onConfirm={handleBulkDelete}
      />
    </>
  );
}
