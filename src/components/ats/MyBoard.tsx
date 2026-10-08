import { useState, useEffect, useCallback, useMemo, useRef, memo, useLayoutEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { withRetry } from '@/lib/withRetry';
import { validateTaskInsert, validateCandidateInsert, validateColumnInsert } from '@/lib/boardValidation';
import { useAuth } from '@/context/AuthContext';
import { useATS } from '@/context/ATSContext';
import { useLanguage } from '@/context/LanguageContext';
import { STAGE_COLORS } from '@/types/ats';
import {
  Plus, Trash2, MoreHorizontal, Pencil, X, Users, StickyNote, Mail, Phone,
  ArrowRightLeft, MessageSquare, DollarSign, Clock, ChevronRight, ChevronLeft,
  Search, Eye, EyeOff, Zap, Check, Palette, GripVertical, Activity,
  Calendar, Flag, User, Filter, CheckSquare, ListTodo, UserPlus, BarChart3,
  LayoutGrid, LayoutList, Copy, Share2,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { useBoardManager, type LocalColumn, type LocalTask } from '@/hooks/useBoardManager';
import { useAutosave } from '@/hooks/useAutosave';
import { useBoardRealtime } from '@/hooks/useBoardRealtime';
import { ShareBoardDialog } from './ShareBoardDialog';
import { BoardSwitcher } from './BoardSwitcher';
import { BoardMembersAvatars } from './BoardMembersAvatars';
import { BoardActivityLog } from './BoardActivityLog';
import { logBoardActivity } from '@/lib/logBoardActivity';
import { logAuditActivity } from '@/lib/logAuditActivity';
import { useBoardPresence } from '@/hooks/useBoardPresence';
import { BoardPresenceAvatars } from './BoardPresenceAvatars';
import { TrashDrawer } from './TrashDrawer';
import { BoardAnalytics } from './BoardAnalytics';
import { CandidateDetailSheet } from './CandidateDetailSheet';
import { Candidate } from '@/types/ats';


const COLUMN_TYPES = [
  { key: 'sourcing', label: 'Sourcing' },
  { key: 'screening', label: 'Screening' },
  { key: 'interview', label: 'Interview' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
] as const;

type ColumnType = typeof COLUMN_TYPES[number]['key'] | null;

interface PersonalColumn {
  id: string;
  user_id: string;
  label: string;
  sort_order: number;
  color: string;
  column_type?: string | null;
  max_cards?: number | null;
}

interface PersonalTask {
  id: string;
  user_id: string;
  column_id: string | null;
  title: string;
  notes: string;
  candidate_id: string | null;
  sort_order: number;
  created_at?: string;
  priority?: string;
  due_date?: string | null;
  assigned_to?: string;
  card_type?: string;
}

type CardTypeFilter = 'all' | 'candidate' | 'task';


const PRIORITY_CONFIG: Record<string, { label: string; color: string; icon: string; bg: string }> = {
  low: { label: 'Low', color: 'text-emerald-600 dark:text-emerald-400', icon: '↓', bg: 'bg-emerald-500/10' },
  medium: { label: 'Med', color: 'text-amber-600 dark:text-amber-400', icon: '→', bg: 'bg-amber-500/10' },
  high: { label: 'High', color: 'text-destructive', icon: '↑', bg: 'bg-destructive/10' },
};

const DEFAULT_COLUMNS = ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

const DEFAULT_COLUMN_TYPES: Record<string, string> = {
  'Applied': 'sourcing',
  'Screening': 'screening',
  'Interview': 'interview',
  'Offer': 'offer',
  'Hired': 'hired',
  'Rejected': 'rejected',
};

const DEFAULT_COLUMN_COLORS: Record<string, string> = {
  'Applied': 'blue',
  'Screening': 'teal',
  'Interview': 'amber',
  'Offer': 'purple',
  'Hired': 'green',
  'Rejected': 'red',
};

interface CandidateInfo {
  candidate: any;
  position: any;
  company: any;
  stage: any;
}



// ─── Quick Add Input (inline per column) ───
function QuickAddInput({ columnId, userId, onAdded, boardId, isDefault, isShared, autoFocus, onDone, forceCardType }: { columnId: string; userId: string; onAdded: (optimisticTask: PersonalTask) => void; boardId: string; isDefault: boolean; isShared?: boolean; autoFocus?: boolean; onDone?: () => void; forceCardType?: 'candidate' | 'task' }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const justSubmittedRef = useRef(false);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const handleSubmit = async () => {
    const raw = value.trim();
    if (!raw) { onDone?.(); return; }
    if (submittingRef.current) return;
    submittingRef.current = true;
    justSubmittedRef.current = true;

    let cardType: 'candidate' | 'task';
    let title: string;
    if (forceCardType) {
      cardType = forceCardType;
      title = raw;
    } else {
      const isTask = raw.startsWith('/task ') || raw === '/task';
      cardType = isTask ? 'task' : 'candidate';
      title = isTask ? raw.replace(/^\/task\s*/, '').trim() : raw;
    }
    if (!title) { submittingRef.current = false; return; }

    if (!validateTaskInsert({ title, columnId, userId, boardId, isDefault, isShared })) { submittingRef.current = false; return; }
    setValue('');

    const tempId = crypto.randomUUID();
    const optimisticTask: PersonalTask = {
      id: tempId, user_id: userId, column_id: columnId, title,
      notes: '', candidate_id: null, sort_order: Date.now(),
      created_at: new Date().toISOString(), card_type: cardType,
    };
    onAdded(optimisticTask);

    try {
      if (isDefault) {
        const result = await withRetry(
          () => supabase.from('personal_tasks').insert({ user_id: userId, column_id: columnId, title, sort_order: optimisticTask.sort_order, card_type: cardType }),
          { context: 'Add task' }
        );
        if (result.error) { onAdded({ ...optimisticTask, id: '__rollback__' + tempId } as any); return; }
      } else if (isShared) {
        const result = await withRetry(
          () => supabase.from('board_tasks').insert({ board_id: boardId, column_id: columnId, title, sort_order: optimisticTask.sort_order, card_type: cardType }),
          { context: 'Add task' }
        );
        if (result.error) { onAdded({ ...optimisticTask, id: '__rollback__' + tempId } as any); return; }
        else if (userId) { logBoardActivity(boardId, userId, `card_created: ${title}`); logAuditActivity({ action: 'create_card', entity_type: cardType, metadata: { title, board_id: boardId, column_id: columnId } }); }
      } else {
        const raw = localStorage.getItem(`my-board-data-${boardId}`);
        const data = raw ? JSON.parse(raw) : { columns: [], tasks: [] };
        data.tasks.push({ id: tempId, column_id: columnId, title, notes: '', candidate_id: null, sort_order: optimisticTask.sort_order });
        localStorage.setItem(`my-board-data-${boardId}`, JSON.stringify(data));
      }
    } catch (err) {
      console.error('[Board] Save task threw:', err);
      onAdded({ ...optimisticTask, id: '__rollback__' + tempId } as any);
    } finally {
      submittingRef.current = false;
    }
  };

  const handleBlur = () => {
    if (justSubmittedRef.current) {
      justSubmittedRef.current = false;
      return;
    }
    handleSubmit().then(() => onDone?.());
  };

  const isTaskMode = forceCardType === 'task';

  return (
    <div className="px-2 pt-2">
      <div className="flex items-center gap-1.5">
        {isTaskMode && <ListTodo className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        {!isTaskMode && !forceCardType && <UserPlus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Input
          ref={inputRef}
          placeholder={isTaskMode ? "Task title..." : forceCardType === 'candidate' ? "Candidate name..." : "Name or /task title..."}
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-7 text-xs bg-transparent border-dashed border-border placeholder:text-muted-foreground/50 focus:border-primary/40"
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); inputRef.current?.focus(); }
            if (e.key === 'Escape') { setValue(''); onDone?.(); (e.target as HTMLInputElement).blur(); }
          }}
          onBlur={handleBlur}
        />
      </div>
    </div>
  );
}

// ─── Main Board ───
export function MyBoard() {
  const { user, profile } = useAuth();
  const { candidates, positions, companies, getCompanyStages } = useATS();
  const { t } = useLanguage();
  const boardManager = useBoardManager(user?.id);
  const { activeBoard, activeBoardId, isDefaultBoard, isSharedBoard, isLocalBoard, boards, boardRole, canEdit, isOwner, setActiveBoardId, createBoard, createSharedBoard, renameBoard, deleteBoard, duplicateBoard, addBoardMember, updateBoardMemberRole, removeBoardMember, getBoardMembers, loadLocalData, saveLocalData } = boardManager;

  const presenceUser = user ? { id: user.id, name: profile?.name, email: user.email } : null;
  const presentUsers = useBoardPresence(isSharedBoard ? activeBoardId : undefined, presenceUser);

  const [columns, setColumns] = useState<PersonalColumn[]>([]);
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [addColOpen, setAddColOpen] = useState(false);
  const [newColLabel, setNewColLabel] = useState('');
  const [editingCol, setEditingCol] = useState<string | null>(null);
  const [editColLabel, setEditColLabel] = useState('');
  const [editTask, setEditTask] = useState<PersonalTask | null>(null);
  const [editTaskTitle, setEditTaskTitle] = useState('');
  const [editTaskNotes, setEditTaskNotes] = useState('');
  const [addCandidateCol, setAddCandidateCol] = useState<string | null>(null);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterAssigned, setFilterAssigned] = useState<string>('all');
  const [filterColumn, setFilterColumn] = useState<string>('all');
  const [filterCardType, setFilterCardType] = useState<CardTypeFilter>('all');
  const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
  const [quickTaskCol, setQuickTaskCol] = useState<string | null>(null);
  const [deleteColConfirm, setDeleteColConfirm] = useState<string | null>(null);
  const [deleteTaskConfirm, setDeleteTaskConfirm] = useState<{ id: string; isCandidate: boolean } | null>(null);
  const [recentOpen, setRecentOpen] = useState(true);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef<{ restore: () => void; timer: ReturnType<typeof setTimeout> } | null>(null);

  const showUndoToast = useCallback((message: string, restoreFn: () => void) => {
    // Clear previous undo
    if (undoRef.current) clearTimeout(undoRef.current.timer);
    const timer = setTimeout(() => { undoRef.current = null; }, 7000);
    undoRef.current = { restore: restoreFn, timer };
    toast(message, {
      action: {
        label: 'Undo',
        onClick: () => {
          if (undoRef.current) {
            clearTimeout(undoRef.current.timer);
            undoRef.current.restore();
            undoRef.current = null;
            toast.success('Action undone');
          }
        },
      },
      duration: 7000,
    });
  }, []);

  // Board switcher state
  const [shareBoardOpen, setShareBoardOpen] = useState(false);
  const [activityLogOpen, setActivityLogOpen] = useState(false);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [colVisibleCount, setColVisibleCount] = useState<Record<string, number>>({});
  const CARDS_PER_PAGE = 20;
  const [bulkMoveCol, setBulkMoveCol] = useState<string | null>(null);
  const [bulkAssign, setBulkAssign] = useState<string>('');
  const [trashOpen, setTrashOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [trashCount, setTrashCount] = useState(0);

  // ─── Count deleted items for current board ───
  const refreshTrashCount = useCallback(async () => {
    if (!user) { setTrashCount(0); return; }
    let total = 0;
    if (isDefaultBoard) {
      const [colRes, taskRes] = await Promise.all([
        supabase.from('personal_columns').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('deleted_at', 'is', null),
        supabase.from('personal_tasks').select('id', { count: 'exact', head: true }).eq('user_id', user.id).not('deleted_at', 'is', null),
      ]);
      total = (colRes.count || 0) + (taskRes.count || 0);
    } else if (isSharedBoard) {
      const [colRes, taskRes] = await Promise.all([
        supabase.from('board_columns').select('id', { count: 'exact', head: true }).eq('board_id', activeBoardId).not('deleted_at', 'is', null),
        supabase.from('board_tasks').select('id', { count: 'exact', head: true }).eq('board_id', activeBoardId).not('deleted_at', 'is', null),
      ]);
      total = (colRes.count || 0) + (taskRes.count || 0);
    }
    setTrashCount(total);
  }, [user, activeBoardId, isDefaultBoard, isSharedBoard]);

  useEffect(() => { refreshTrashCount(); }, [refreshTrashCount]);

  // ─── Load data based on active board ───
  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      if (isDefaultBoard) {
        const [colRes, taskRes] = await Promise.all([
          supabase.from('personal_columns').select('*').eq('user_id', user.id).is('deleted_at', null).order('sort_order'),
          supabase.from('personal_tasks').select('*').eq('user_id', user.id).is('deleted_at', null).order('sort_order'),
        ]);

        if (colRes.error) console.error('Fetch columns error:', colRes.error);
        if (taskRes.error) console.error('Fetch tasks error:', taskRes.error);

        let cols = (colRes.data || []) as PersonalColumn[];
        if (cols.length === 0) {
          const inserts = DEFAULT_COLUMNS.map((label, i) => ({
            user_id: user.id, label, sort_order: i,
            color: DEFAULT_COLUMN_COLORS[label] || 'blue',
            column_type: DEFAULT_COLUMN_TYPES[label] || null,
          }));
          const { data, error } = await supabase.from('personal_columns').insert(inserts).select();
          if (error) console.error('Init columns error:', error);
          cols = (data || []) as PersonalColumn[];
        }

        setColumns(cols);
        setTasks((taskRes.data || []) as PersonalTask[]);
      } else if (isSharedBoard) {
        const [colRes, taskRes] = await Promise.all([
          supabase.from('board_columns').select('*').eq('board_id', activeBoardId).is('deleted_at', null).order('sort_order'),
          supabase.from('board_tasks').select('*').eq('board_id', activeBoardId).is('deleted_at', null).order('sort_order'),
        ]);
        if (colRes.error) console.error('Fetch shared columns error:', colRes.error);
        if (taskRes.error) console.error('Fetch shared tasks error:', taskRes.error);
        setColumns((colRes.data || []).map((c: any) => ({ ...c, user_id: user.id })));
        setTasks((taskRes.data || []).map((t: any) => ({ ...t, user_id: user.id })));
      } else {
        const data = loadLocalData(activeBoardId);
        setColumns(data.columns.map(c => ({ ...c, user_id: user.id })) as any);
        setTasks(data.tasks.map(t => ({ ...t, user_id: user.id })) as any);
      }
    } catch (err) {
      console.error('fetchData error:', err);
    }
    setLoading(false);
  }, [user, isDefaultBoard, isSharedBoard, activeBoardId, loadLocalData]);

  useEffect(() => { setLoading(true); fetchData(); }, [fetchData]);

  // ─── Realtime sync for shared boards ───
  // Last-write-wins: only apply UPDATE when incoming updated_at > local updated_at
  const handleRealtimeTask = useCallback((event: 'INSERT' | 'UPDATE' | 'DELETE', record: any, oldRecord?: any) => {
    if (event === 'INSERT') {
      setTasks(prev => {
        // Deduplicate: skip if exact ID exists, OR replace optimistic temp entry for same candidate+column
        if (prev.some(t => t.id === record.id)) return prev;
        // Replace optimistic entry that matched by candidate_id+column_id (temp ID → real ID)
        const optimisticIdx = record.candidate_id
          ? prev.findIndex(t => t.candidate_id === record.candidate_id && t.column_id === record.column_id && t.id !== record.id)
          : -1;
        const merged = { ...record, user_id: user?.id || '' } as PersonalTask;
        if (optimisticIdx >= 0) {
          const next = [...prev];
          next[optimisticIdx] = merged;
          return next;
        }
        return [...prev, merged];
      });
    } else if (event === 'UPDATE') {
      setTasks(prev => prev.map(t => {
        if (t.id !== record.id) return t;
        // Last-write-wins: only apply if incoming is newer or has no local timestamp
        const localTs = (t as any).updated_at;
        const remoteTs = record.updated_at;
        if (localTs && remoteTs && remoteTs < localTs) return t; // stale → skip
        return { ...t, ...record, user_id: t.user_id };
      }));
    } else if (event === 'DELETE') {
      const id = oldRecord?.id || record?.id;
      if (id) setTasks(prev => prev.filter(t => t.id !== id));
    }
  }, [user?.id]);

  const handleRealtimeColumn = useCallback((event: 'INSERT' | 'UPDATE' | 'DELETE', record: any, oldRecord?: any) => {
    if (event === 'INSERT') {
      setColumns(prev => {
        if (prev.some(c => c.id === record.id)) return prev;
        // Replace optimistic entry by label+sort_order match
        const optimisticIdx = prev.findIndex(c => c.label === record.label && c.sort_order === record.sort_order && c.id !== record.id);
        const merged = { ...record, user_id: user?.id || '' } as PersonalColumn;
        if (optimisticIdx >= 0) {
          const next = [...prev];
          next[optimisticIdx] = merged;
          return next;
        }
        return [...prev, merged];
      });
    } else if (event === 'UPDATE') {
      setColumns(prev => prev.map(c => {
        if (c.id !== record.id) return c;
        const localTs = (c as any).updated_at;
        const remoteTs = record.updated_at;
        if (localTs && remoteTs && remoteTs < localTs) return c; // stale → skip
        return { ...c, ...record, user_id: c.user_id };
      }));
    } else if (event === 'DELETE') {
      const id = oldRecord?.id || record?.id;
      if (id) setColumns(prev => prev.filter(c => c.id !== id));
    }
  }, [user?.id]);

  const { markLocalMutation } = useBoardRealtime({
    boardId: activeBoardId,
    isShared: isSharedBoard,
    userId: user?.id,
    onTaskChange: handleRealtimeTask,
    onColumnChange: handleRealtimeColumn,
  });

  // ─── Ref for bulk delete to avoid stale closure ───
  const bulkDeleteRef = useRef<() => void>(() => {});

  // ─── Keyboard shortcuts (minimal) ───
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === 'Escape') {
        setAddCandidateCol(null);
        setEditTask(null);
        setAddColOpen(false);
        setQuickTaskCol(null);
        setQuickAddCol(null);
        setSelectedTasks(new Set());
        setBulkMoveCol(null);
        if (detailCandidate) setDetailCandidate(null);
      }
      // "N" → new task in first column
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (canEdit && columns.length > 0) {
          e.preventDefault();
          setQuickTaskCol(columns[0].id);
        }
      }
      // "T" → open task input in first column (alias)
      if (e.key === 't' || e.key === 'T') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey && canEdit && columns.length > 0) {
          e.preventDefault();
          setQuickTaskCol(columns[0].id);
        }
      }
      // "/" → focus search
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // "M" → open move popover when cards are selected
      if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (selectedTasks.size > 0 && canEdit) {
          e.preventDefault();
          setBulkMoveCol('open');
        }
      }
      // "D" → delete selected cards
      if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (selectedTasks.size > 0 && canEdit) {
          e.preventDefault();
          bulkDeleteRef.current();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canEdit, columns, selectedTasks.size, detailCandidate]);

  // ─── Candidate info helper ───
  const getCandidateInfo = useCallback((candidateId: string): CandidateInfo | null => {
    const c = candidates.find(cd => cd.id === candidateId);
    if (!c) return null;
    const pos = positions.find(p => p.id === c.position_id);
    const company = pos ? companies.find(co => co.id === pos.company_id) : null;
    const stages = company ? getCompanyStages(company.id) : [];
    const stage = stages.find(s => s.id === c.stage_id);
    return { candidate: c, position: pos, company, stage };
  }, [candidates, positions, companies, getCompanyStages]);

  const boardCandidateIds = useMemo(() =>
    new Set(tasks.filter(t => t.candidate_id).map(t => t.candidate_id!)),
    [tasks]
  );

  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.toLowerCase();
    return candidates
      .filter(c => !boardCandidateIds.has(c.id))
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [candidates, boardCandidateIds, candidateSearch]);

  // ─── Recently active items (last 5 updated candidates on board) ───
  const recentItems = useMemo(() => {
    return tasks
      .filter(t => t.candidate_id)
      .map(t => ({ task: t, info: getCandidateInfo(t.candidate_id!) }))
      .filter(r => r.info)
      .sort((a, b) => {
        const aDate = a.info!.candidate.created_at || a.task.created_at || '';
        const bDate = b.info!.candidate.created_at || b.task.created_at || '';
        return bDate.localeCompare(aDate);
      })
      .slice(0, 5);
  }, [tasks, getCandidateInfo]);

  // ─── Optimistic task add handler (used by QuickAddInput) ───
  const handleOptimisticTaskAdd = useCallback((task: PersonalTask) => {
    if (task.id.startsWith('__rollback__')) {
      // Rollback: remove the optimistic task
      const realId = task.id.replace('__rollback__', '');
      setTasks(prev => prev.filter(t => t.id !== realId));
      toast.error('Card could not be saved — rolled back');
      return;
    }
    setTasks(prev => [...prev, task]);
  }, []);

  // ─── Column CRUD ───
  const handleAddColumn = async () => {
    if (!user) return;
    const existingLabels = columns.map(c => c.label);
    if (!validateColumnInsert({ label: newColLabel, userId: user?.id, boardId: activeBoardId, isDefault: isDefaultBoard, isShared: isSharedBoard, existingLabels })) return;
    const maxOrder = columns.reduce((m, c) => Math.max(m, c.sort_order), -1);
    const tempId = crypto.randomUUID();
    const optimisticCol: PersonalColumn = { id: tempId, user_id: user.id, label: newColLabel.trim(), sort_order: maxOrder + 1, color: 'blue' };

    // Optimistic
    setColumns(prev => [...prev, optimisticCol]);
    setNewColLabel('');
    setAddColOpen(false);

    if (isDefaultBoard) {
      const result = await withRetry(
        () => supabase.from('personal_columns').insert({ user_id: user.id, label: optimisticCol.label, sort_order: optimisticCol.sort_order, color: 'blue' }),
        { context: 'Add column' }
      );
      if (result.error) { setColumns(prev => prev.filter(c => c.id !== tempId)); toast.error('Column add rolled back'); return; }
    } else if (isSharedBoard) {
      const result = await withRetry(
        () => supabase.from('board_columns').insert({ board_id: activeBoardId, label: optimisticCol.label, sort_order: optimisticCol.sort_order, color: 'blue' }).select().single(),
        { context: 'Add column' }
      );
      if (result.error) { setColumns(prev => prev.filter(c => c.id !== tempId)); toast.error('Column add rolled back'); return; }
      // Replace optimistic temp ID with real DB ID and mark to suppress echo
      if (result.data) {
        markLocalMutation('col', result.data.id, 'INSERT');
        setColumns(prev => prev.map(c => c.id === tempId ? { ...c, id: result.data.id } : c));
      }
    } else {
      const data = loadLocalData(activeBoardId);
      data.columns.push({ id: tempId, label: optimisticCol.label, sort_order: optimisticCol.sort_order, color: 'blue' });
      saveLocalData(activeBoardId, data);
    }
  };

  const handleRenameColumn = async (id: string) => {
    if (!editColLabel.trim()) return;
    const oldLabel = columns.find(c => c.id === id)?.label || '';
    // Optimistic
    setColumns(prev => prev.map(c => c.id === id ? { ...c, label: editColLabel.trim() } : c));
    setEditingCol(null);

    if (isDefaultBoard) {
      const r = await withRetry(() => supabase.from('personal_columns').update({ label: editColLabel.trim() }).eq('id', id) as any, { context: 'Rename column' });
      if (r?.error) { setColumns(prev => prev.map(c => c.id === id ? { ...c, label: oldLabel } : c)); toast.error('Rename rolled back'); }
    } else if (isSharedBoard) {
      markLocalMutation('col', id, 'UPDATE');
      const r = await withRetry(() => supabase.from('board_columns').update({ label: editColLabel.trim() }).eq('id', id) as any, { context: 'Rename column' });
      if (r?.error) { setColumns(prev => prev.map(c => c.id === id ? { ...c, label: oldLabel } : c)); toast.error('Rename rolled back'); }
      else if (user) { logBoardActivity(activeBoardId, user.id, `column_renamed: "${oldLabel}" → "${editColLabel.trim()}"`); logAuditActivity({ action: 'rename_column', entity_type: 'column', entity_id: id, metadata: { old_value: oldLabel, new_value: editColLabel.trim(), board_id: activeBoardId } }); };
    } else {
      const data = loadLocalData(activeBoardId);
      data.columns = data.columns.map(c => c.id === id ? { ...c, label: editColLabel.trim() } : c);
      saveLocalData(activeBoardId, data);
    }
  };

  const handleChangeColumnColor = async (id: string, color: string) => {
    // Optimistic update
    setColumns(prev => prev.map(c => c.id === id ? { ...c, color } : c));
    if (isDefaultBoard) {
      await withRetry(() => supabase.from('personal_columns').update({ color }).eq('id', id) as any, { context: 'Change color', silent: true });
    } else if (isSharedBoard) {
      markLocalMutation('col', id, 'UPDATE');
      await withRetry(() => supabase.from('board_columns').update({ color }).eq('id', id) as any, { context: 'Change color', silent: true });
    } else {
      const data = loadLocalData(activeBoardId);
      data.columns = data.columns.map(c => c.id === id ? { ...c, color } : c);
      saveLocalData(activeBoardId, data);
    }
  };

  const handleChangeColumnType = async (id: string, columnType: string | null) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, column_type: columnType } : c));
    if (isDefaultBoard) {
      await withRetry(() => supabase.from('personal_columns').update({ column_type: columnType }).eq('id', id) as any, { context: 'Change type', silent: true });
    } else if (isSharedBoard) {
      markLocalMutation('col', id, 'UPDATE');
      await withRetry(() => supabase.from('board_columns').update({ column_type: columnType }).eq('id', id) as any, { context: 'Change type', silent: true });
    } else {
      const data = loadLocalData(activeBoardId);
      data.columns = data.columns.map(c => c.id === id ? { ...c, column_type: columnType } : c);
      saveLocalData(activeBoardId, data);
    }
  };

  const handleSetMaxCards = async (id: string, maxCards: number | null) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, max_cards: maxCards } : c));
    if (isDefaultBoard) {
      await withRetry(() => supabase.from('personal_columns').update({ max_cards: maxCards }).eq('id', id) as any, { context: 'Set limit', silent: true });
    } else if (isSharedBoard) {
      markLocalMutation('col', id, 'UPDATE');
      await withRetry(() => supabase.from('board_columns').update({ max_cards: maxCards }).eq('id', id) as any, { context: 'Set limit', silent: true });
    } else {
      const data = loadLocalData(activeBoardId);
      data.columns = data.columns.map(c => c.id === id ? { ...c, max_cards: maxCards } : c);
      saveLocalData(activeBoardId, data);
    }
  };

  const handleDeleteColumn = async (id: string) => {
    setDeleteColConfirm(id);
  };

  const confirmDeleteColumn = async () => {
    if (!deleteColConfirm) return;
    const id = deleteColConfirm;
    setDeleteColConfirm(null);
    // Optimistic: snapshot & remove
    const prevColumns = columns;
    const prevTasks = tasks;
    const affectedCount = tasks.filter(t => t.column_id === id).length + 1; // tasks + column
    setColumns(prev => prev.filter(c => c.id !== id));
    setTasks(prev => prev.filter(t => t.column_id !== id));
    setTrashCount(prev => prev + affectedCount);

    const now = new Date().toISOString();
    if (isDefaultBoard) {
      const r1 = await withRetry(() => supabase.from('personal_tasks').update({ deleted_at: now, deleted_by: user?.id } as any).eq('column_id', id) as any, { context: 'Soft delete column tasks' });
      const r2 = await withRetry(() => supabase.from('personal_columns').update({ deleted_at: now, deleted_by: user?.id } as any).eq('id', id) as any, { context: 'Soft delete column' });
      if (r1?.error || r2?.error) { setColumns(prevColumns); setTasks(prevTasks); toast.error('Delete rolled back'); }
      else logAuditActivity({ action: 'delete_column', entity_type: 'column', entity_id: id, metadata: { label: prevColumns.find(c => c.id === id)?.label } });
    } else if (isSharedBoard) {
      // Mark affected tasks and column to suppress echoes
      const affectedTaskIds = tasks.filter(t => t.column_id === id).map(t => t.id);
      affectedTaskIds.forEach(tid => markLocalMutation('task', tid, 'UPDATE'));
      markLocalMutation('col', id, 'UPDATE');
      const r1 = await withRetry(() => supabase.from('board_tasks').update({ deleted_at: now, deleted_by: user?.id } as any).eq('column_id', id) as any, { context: 'Soft delete column tasks' });
      const r2 = await withRetry(() => supabase.from('board_columns').update({ deleted_at: now, deleted_by: user?.id } as any).eq('id', id) as any, { context: 'Soft delete column' });
      if (r1?.error || r2?.error) { setColumns(prevColumns); setTasks(prevTasks); toast.error('Delete rolled back'); }
      else logAuditActivity({ action: 'delete_column', entity_type: 'column', entity_id: id, metadata: { label: prevColumns.find(c => c.id === id)?.label, board_id: activeBoardId } });
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = data.tasks.filter(t => t.column_id !== id);
      data.columns = data.columns.filter(c => c.id !== id);
      saveLocalData(activeBoardId, data);
    }
  };

  // ─── Task CRUD ───
  const handleAddCandidateToBoard = async (candidateId: string, columnId: string) => {
    if (!user) return;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    if (!validateCandidateInsert({
      candidateId, candidateName: candidate.name, columnId, userId: user.id,
      boardId: activeBoardId, isDefault: isDefaultBoard, isShared: isSharedBoard,
      existingTasks: tasks.map(t => ({ candidate_id: t.candidate_id, column_id: t.column_id })),
    })) return;

    const tempId = crypto.randomUUID();
    const sortOrder = Date.now();
    const optimisticTask: PersonalTask = {
      id: tempId, user_id: user.id, column_id: columnId, title: candidate.name,
      notes: '', candidate_id: candidateId, sort_order: sortOrder, created_at: new Date().toISOString(),
    };
    // Optimistic
    setTasks(prev => [...prev, optimisticTask]);
    setAddCandidateCol(null);
    setCandidateSearch('');
    toast.success(`${candidate.name} added to your board`);

    if (isDefaultBoard) {
      const result = await withRetry(
        () => supabase.from('personal_tasks').insert({ user_id: user.id, column_id: columnId, title: candidate.name, candidate_id: candidateId, sort_order: sortOrder, card_type: 'candidate' }),
        { context: 'Add candidate' }
      );
      if (result.error) { setTasks(prev => prev.filter(t => t.id !== tempId)); toast.error('Add rolled back'); return; }
    } else if (isSharedBoard) {
      const result = await withRetry(
        () => supabase.from('board_tasks').insert({ board_id: activeBoardId, column_id: columnId, title: candidate.name, candidate_id: candidateId, sort_order: sortOrder, card_type: 'candidate' }).select().single(),
        { context: 'Add candidate' }
      );
      if (result.error) { setTasks(prev => prev.filter(t => t.id !== tempId)); toast.error('Add rolled back'); return; }
      if (result.data) {
        markLocalMutation('task', result.data.id, 'INSERT');
        setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: result.data.id } : t));
      }
      if (user) { logBoardActivity(activeBoardId, user.id, `candidate_added: ${candidate.name}`); logAuditActivity({ action: 'add_candidate_to_board', entity_type: 'candidate', entity_id: candidateId, metadata: { name: candidate.name, board_id: activeBoardId, column_id: columnId } }); }
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks.push({ id: tempId, column_id: columnId, title: candidate.name, notes: '', candidate_id: candidateId, sort_order: sortOrder });
      saveLocalData(activeBoardId, data);
    }
  };

  const { debouncedSave: debouncedTaskSave, flush: flushTaskSave } = useAutosave(300);

  const saveTaskFields = useCallback(async (taskId: string, fields: Partial<PersonalTask>) => {
    // Optimistic: update local state immediately
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...fields } : t));

    const dbFields: Record<string, any> = {};
    if (fields.title !== undefined) { dbFields.title = fields.title.trim(); if (!dbFields.title) return; }
    if (fields.notes !== undefined) dbFields.notes = fields.notes;
    if (fields.priority !== undefined) dbFields.priority = fields.priority;
    if (fields.due_date !== undefined) dbFields.due_date = fields.due_date || null;
    if (fields.assigned_to !== undefined) dbFields.assigned_to = fields.assigned_to;

    if (isDefaultBoard) {
      const { error } = await supabase.from('personal_tasks').update(dbFields).eq('id', taskId);
      if (error) { console.error('[Board] Autosave failed:', error); toast.error(`Autosave: ${error.message}`); throw error; }
    } else if (isSharedBoard) {
      markLocalMutation('task', taskId, 'UPDATE');
      const { error } = await supabase.from('board_tasks').update(dbFields).eq('id', taskId);
      if (error) { console.error('[Board] Autosave failed:', error); toast.error(`Autosave: ${error.message}`); throw error; }
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = data.tasks.map(t => t.id === taskId ? { ...t, ...dbFields } : t);
      saveLocalData(activeBoardId, data);
    }
  }, [isDefaultBoard, isSharedBoard, activeBoardId, loadLocalData, saveLocalData]);

  const handleSaveTask = async () => {
    if (!editTask || !editTaskTitle.trim()) return;
    flushTaskSave();
    await saveTaskFields(editTask.id, { title: editTaskTitle, notes: editTaskNotes });
    setEditTask(null);
  };

  const handleDeleteTask = async (id: string, isCandidate: boolean) => {
    setDeleteTaskConfirm({ id, isCandidate });
  };

  const confirmDeleteTask = async () => {
    if (!deleteTaskConfirm) return;
    const { id } = deleteTaskConfirm;
    setDeleteTaskConfirm(null);
    const deletedTask = tasks.find(t => t.id === id);
    if (!deletedTask) return;
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => t.id !== id));
    setTrashCount(prev => prev + 1);

    if (isDefaultBoard) {
      const r = await withRetry(() => supabase.from('personal_tasks').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).eq('id', id) as any, { context: 'Soft delete task' });
      if (r?.error) { setTasks(prevTasks); toast.error('Delete rolled back'); return; }
    } else if (isSharedBoard) {
      markLocalMutation('task', id, 'UPDATE');
      const r = await withRetry(() => supabase.from('board_tasks').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).eq('id', id) as any, { context: 'Soft delete task' });
      if (r?.error) { setTasks(prevTasks); toast.error('Delete rolled back'); return; }
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = data.tasks.filter(t => t.id !== id);
      saveLocalData(activeBoardId, data);
    }

    showUndoToast('Card deleted', async () => {
      // Undo: clear deleted_at on same row (NOT a new insert)
      if (isDefaultBoard) {
        await supabase.from('personal_tasks').update({ deleted_at: null, deleted_by: null } as any).eq('id', deletedTask.id);
      } else if (isSharedBoard) {
        markLocalMutation('task', deletedTask.id, 'UPDATE');
        await supabase.from('board_tasks').update({ deleted_at: null, deleted_by: null } as any).eq('id', deletedTask.id);
      } else {
        const data = loadLocalData(activeBoardId);
        data.tasks.push({ id: deletedTask.id, column_id: deletedTask.column_id || '', title: deletedTask.title, notes: deletedTask.notes || '', candidate_id: deletedTask.candidate_id || null, sort_order: deletedTask.sort_order });
        saveLocalData(activeBoardId, data);
      }
      // Re-add to local state (for the user who performed undo)
      setTasks(prev => {
        if (prev.some(t => t.id === deletedTask.id)) return prev;
        return [...prev, deletedTask];
      });
      setTrashCount(prev => Math.max(0, prev - 1));
    });
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;
    const ids = Array.from(selectedTasks);
    const deletedTasks = tasks.filter(t => selectedTasks.has(t.id));
    const prevTasks = tasks;
    setTasks(prev => prev.filter(t => !selectedTasks.has(t.id)));
    setTrashCount(prev => prev + ids.length);
    setSelectedTasks(new Set());

    const now = new Date().toISOString();
    if (isDefaultBoard) {
      const results = await Promise.all(ids.map(id =>
        withRetry(() => supabase.from('personal_tasks').update({ deleted_at: now, deleted_by: user?.id } as any).eq('id', id) as any, { context: 'Bulk soft delete', silent: true })
      ));
      if (results.some(r => r?.error)) { setTasks(prevTasks); toast.error('Bulk delete rolled back'); return; }
    } else if (isSharedBoard) {
      ids.forEach(id => markLocalMutation('task', id, 'UPDATE'));
      const results = await Promise.all(ids.map(id =>
        withRetry(() => supabase.from('board_tasks').update({ deleted_at: now, deleted_by: user?.id } as any).eq('id', id) as any, { context: 'Bulk soft delete', silent: true })
      ));
      if (results.some(r => r?.error)) { setTasks(prevTasks); toast.error('Bulk delete rolled back'); return; }
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = data.tasks.filter(t => !selectedTasks.has(t.id));
      saveLocalData(activeBoardId, data);
    }
    showUndoToast(`Deleted ${ids.length} card${ids.length !== 1 ? 's' : ''}`, async () => {
      for (const dt of deletedTasks) {
        if (isDefaultBoard) {
          await supabase.from('personal_tasks').update({ deleted_at: null, deleted_by: null } as any).eq('id', dt.id);
        } else if (isSharedBoard) {
          markLocalMutation('task', dt.id, 'UPDATE');
          await supabase.from('board_tasks').update({ deleted_at: null, deleted_by: null } as any).eq('id', dt.id);
        }
      }
      if (!isDefaultBoard && !isSharedBoard) {
        const data = loadLocalData(activeBoardId);
        deletedTasks.forEach(dt => data.tasks.push({ id: dt.id, column_id: dt.column_id || '', title: dt.title, notes: dt.notes || '', candidate_id: dt.candidate_id || null, sort_order: dt.sort_order }));
        saveLocalData(activeBoardId, data);
      }
      // Re-add to local state
      setTasks(prev => {
        const existingIds = new Set(prev.map(t => t.id));
        const toAdd = deletedTasks.filter(dt => !existingIds.has(dt.id));
        return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
      });
      setTrashCount(prev => Math.max(0, prev - deletedTasks.length));
    });
  };

  // Keep ref in sync for keyboard shortcut
  bulkDeleteRef.current = handleBulkDelete;

  const handleBulkMove = async (targetColId: string) => {
    if (selectedTasks.size === 0) return;
    const ids = Array.from(selectedTasks);
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => selectedTasks.has(t.id) ? { ...t, column_id: targetColId } : t));
    setSelectedTasks(new Set());
    setBulkMoveCol(null);

    if (isDefaultBoard) {
      const results = await Promise.all(ids.map(id =>
        withRetry(() => supabase.from('personal_tasks').update({ column_id: targetColId }).eq('id', id) as any, { context: 'Bulk move', silent: true })
      ));
      if (results.some(r => r?.error)) { setTasks(prevTasks); toast.error('Bulk move rolled back'); }
    } else if (isSharedBoard) {
      ids.forEach(id => markLocalMutation('task', id, 'UPDATE'));
      const results = await Promise.all(ids.map(id =>
        withRetry(() => supabase.from('board_tasks').update({ column_id: targetColId }).eq('id', id) as any, { context: 'Bulk move', silent: true })
      ));
      if (results.some(r => r?.error)) { setTasks(prevTasks); toast.error('Bulk move rolled back'); }
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = data.tasks.map(t => ids.includes(t.id) ? { ...t, column_id: targetColId } : t);
      saveLocalData(activeBoardId, data);
    }
    toast.success(`Moved ${ids.length} card${ids.length !== 1 ? 's' : ''}`);
  };

  const handleBulkAssign = async (assignee: string) => {
    if (selectedTasks.size === 0) return;
    const ids = Array.from(selectedTasks);
    const prevTasks = tasks;
    setTasks(prev => prev.map(t => selectedTasks.has(t.id) ? { ...t, assigned_to: assignee } : t));
    setSelectedTasks(new Set());
    setBulkAssign('');

    if (isDefaultBoard) {
      await Promise.all(ids.map(id =>
        withRetry(() => supabase.from('personal_tasks').update({ assigned_to: assignee }).eq('id', id) as any, { context: 'Bulk assign', silent: true })
      ));
    } else if (isSharedBoard) {
      ids.forEach(id => markLocalMutation('task', id, 'UPDATE'));
      await Promise.all(ids.map(id =>
        withRetry(() => supabase.from('board_tasks').update({ assigned_to: assignee }).eq('id', id) as any, { context: 'Bulk assign', silent: true })
      ));
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = data.tasks.map(t => ids.includes(t.id) ? { ...t, assigned_to: assignee } : t);
      saveLocalData(activeBoardId, data);
    }
    toast.success(`Assigned ${ids.length} card${ids.length !== 1 ? 's' : ''}`);
  };

  // ─── Quick move to adjacent column ───
  const handleQuickMove = async (taskId: string, direction: 'left' | 'right') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const colIndex = columns.findIndex(c => c.id === task.column_id);
    if (colIndex === -1) return;
    const newIndex = direction === 'right' ? colIndex + 1 : colIndex - 1;
    if (newIndex < 0 || newIndex >= columns.length) return;
    const newColId = columns[newIndex].id;

    const oldColId = task.column_id;
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: newColId } : t));
    if (isDefaultBoard) {
      const r = await withRetry(() => supabase.from('personal_tasks').update({ column_id: newColId }).eq('id', taskId) as any, { context: 'Move task', silent: true });
      if (r?.error) { setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: oldColId } : t)); toast.error('Move rolled back'); return; }
    } else if (isSharedBoard) {
      markLocalMutation('task', taskId, 'UPDATE');
      const r = await withRetry(() => supabase.from('board_tasks').update({ column_id: newColId }).eq('id', taskId) as any, { context: 'Move task', silent: true });
      if (r?.error) { setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: oldColId } : t)); toast.error('Move rolled back'); return; }
      if (user) {
        const fromCol = columns.find(c => c.id === oldColId)?.label || '?';
        const toCol = columns[newIndex].label;
        logBoardActivity(activeBoardId, user.id, `card_moved: "${task.title}" from "${fromCol}" to "${toCol}"`);
        logAuditActivity({ action: 'move_card', entity_type: task.candidate_id ? 'candidate' : 'task', entity_id: task.id, metadata: { title: task.title, column_from: fromCol, column_to: toCol, board_id: activeBoardId } });
      }
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = data.tasks.map(t => t.id === taskId ? { ...t, column_id: newColId } : t);
      saveLocalData(activeBoardId, data);
    }
    const fromLabel = columns.find(c => c.id === oldColId)?.label || '?';
    const toLabel = columns[newIndex].label;
    showUndoToast(`Moved to ${toLabel}`, async () => {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: oldColId } : t));
      if (isDefaultBoard) {
        await supabase.from('personal_tasks').update({ column_id: oldColId }).eq('id', taskId);
      } else if (isSharedBoard) {
        await supabase.from('board_tasks').update({ column_id: oldColId }).eq('id', taskId);
      } else {
        const data = loadLocalData(activeBoardId);
        data.tasks = data.tasks.map(t => t.id === taskId ? { ...t, column_id: oldColId } : t);
        saveLocalData(activeBoardId, data);
      }
    });
  };

  // ─── Drag & Drop ───
  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !canEdit) return;

    // ── Column reorder ──
    if (result.type === 'COLUMN') {
      const srcIdx = result.source.index;
      const destIdx = result.destination.index;
      if (srcIdx === destIdx) return;

      const prevColumns = columns;
      const reordered = Array.from(columns);
      const [moved] = reordered.splice(srcIdx, 1);
      reordered.splice(destIdx, 0, moved);
      const updated = reordered.map((c, i) => ({ ...c, sort_order: i }));
      setColumns(updated);

      if (isDefaultBoard) {
        const results = await Promise.all(updated.map(c =>
          withRetry(() => supabase.from('personal_columns').update({ sort_order: c.sort_order }).eq('id', c.id) as any, { context: 'Reorder columns', silent: true })
        ));
        if (results.some(r => r?.error)) { setColumns(prevColumns); toast.error('Column reorder rolled back'); }
      } else if (isSharedBoard) {
        updated.forEach(c => markLocalMutation('col', c.id, 'UPDATE'));
        const results = await Promise.all(updated.map(c =>
          withRetry(() => supabase.from('board_columns').update({ sort_order: c.sort_order }).eq('id', c.id) as any, { context: 'Reorder columns', silent: true })
        ));
        if (results.some(r => r?.error)) { setColumns(prevColumns); toast.error('Column reorder rolled back'); }
      } else {
        const data = loadLocalData(activeBoardId);
        data.columns = updated.map(c => ({ id: c.id, label: c.label, sort_order: c.sort_order, color: c.color || 'blue' }));
        saveLocalData(activeBoardId, data);
      }
      return;
    }

    // ── Card reorder (with multi-drag support) ──
    const taskId = result.draggableId;
    const destColId = result.destination.droppableId;
    const destIndex = result.destination.index;
    const prevTasks = tasks;

    // If dragged card is part of selection, move all selected cards
    const isMultiDrag = selectedTasks.has(taskId) && selectedTasks.size > 1;
    const movedIds = isMultiDrag ? Array.from(selectedTasks) : [taskId];

    // Build new task list
    const newTasks = (() => {
      // Move all selected cards to destination column
      const updated = prevTasks.map(t => movedIds.includes(t.id) ? { ...t, column_id: destColId } : t);
      const affectedColIds = new Set([result.source.droppableId, destColId]);
      // Also include source columns of all selected cards in multi-drag
      if (isMultiDrag) {
        prevTasks.filter(t => movedIds.includes(t.id)).forEach(t => { if (t.column_id) affectedColIds.add(t.column_id); });
      }
      const reindexed = new Map<string, number>();
      for (const colId of affectedColIds) {
        const colCards = updated
          .filter(t => t.column_id === colId && !movedIds.includes(t.id))
          .sort((a, b) => a.sort_order - b.sort_order);
        if (colId === destColId) {
          // Insert all moved cards at the destination index
          const movedTasks = updated.filter(t => movedIds.includes(t.id));
          colCards.splice(destIndex, 0, ...movedTasks);
        }
        colCards.forEach((t, i) => reindexed.set(t.id, i));
      }
      return updated.map(t => reindexed.has(t.id) ? { ...t, sort_order: reindexed.get(t.id)! } : t);
    })();

    setTasks(newTasks);
    if (isMultiDrag) {
      setSelectedTasks(new Set());
      toast.success(`Moved ${movedIds.length} cards`);
    }

    // Persist all changed cards
    const changedTasks = newTasks.filter(t => {
      const prev = prevTasks.find(p => p.id === t.id);
      return prev && (prev.sort_order !== t.sort_order || prev.column_id !== t.column_id);
    });

    if (isDefaultBoard) {
      const results = await Promise.all(changedTasks.map(t =>
        withRetry(() => supabase.from('personal_tasks').update({ column_id: t.column_id, sort_order: t.sort_order }).eq('id', t.id) as any, { context: 'Move card', silent: true })
      ));
      if (results.some(r => r?.error)) { setTasks(prevTasks); toast.error('Card move rolled back'); }
    } else if (isSharedBoard) {
      changedTasks.forEach(t => markLocalMutation('task', t.id, 'UPDATE'));
      const results = await Promise.all(changedTasks.map(t =>
        withRetry(() => supabase.from('board_tasks').update({ column_id: t.column_id, sort_order: t.sort_order }).eq('id', t.id) as any, { context: 'Move card', silent: true })
      ));
      if (results.some(r => r?.error)) { setTasks(prevTasks); toast.error('Card move rolled back'); }
      else if (user && result.source.droppableId !== destColId) {
        const movedTask = newTasks.find(t => t.id === taskId);
        const fromCol = columns.find(c => c.id === result.source.droppableId)?.label || '?';
        const toCol = columns.find(c => c.id === destColId)?.label || '?';
        logBoardActivity(activeBoardId, user.id, `card_moved: "${movedTask?.title || '?'}" from "${fromCol}" to "${toCol}"`);
        logAuditActivity({ action: 'move_card', entity_type: movedTask?.candidate_id ? 'candidate' : 'task', entity_id: movedTask?.id, metadata: { title: movedTask?.title, column_from: fromCol, column_to: toCol, board_id: activeBoardId } });
      }
    } else {
      const data = loadLocalData(activeBoardId);
      data.tasks = newTasks.map(t => ({ id: t.id, column_id: t.column_id || '', title: t.title, notes: t.notes || '', candidate_id: t.candidate_id || null, sort_order: t.sort_order }));
      saveLocalData(activeBoardId, data);
    }

    // Show undo for cross-column moves
    if (result.source.droppableId !== destColId) {
      const toColLabel = columns.find(c => c.id === destColId)?.label || '?';
      showUndoToast(`Moved to ${toColLabel}`, async () => {
        setTasks(prevTasks);
        // Re-persist previous state
        const prevChanged = prevTasks.filter(t => changedTasks.some(ct => ct.id === t.id));
        if (isDefaultBoard) {
          await Promise.all(prevChanged.map(t =>
            supabase.from('personal_tasks').update({ column_id: t.column_id, sort_order: t.sort_order }).eq('id', t.id)
          ));
        } else if (isSharedBoard) {
          prevChanged.forEach(t => markLocalMutation('task', t.id, 'UPDATE'));
          await Promise.all(prevChanged.map(t =>
            supabase.from('board_tasks').update({ column_id: t.column_id, sort_order: t.sort_order }).eq('id', t.id)
          ));
        } else {
          const data = loadLocalData(activeBoardId);
          data.tasks = prevTasks.map(t => ({ id: t.id, column_id: t.column_id || '', title: t.title, notes: t.notes || '', candidate_id: t.candidate_id || null, sort_order: t.sort_order }));
          saveLocalData(activeBoardId, data);
        }
      });
    }
  };

  const grouped = useMemo(() => {
    const map: Record<string, PersonalTask[]> = {};
    columns.forEach(c => { map[c.id] = []; });
    tasks.forEach(t => {
      if (t.column_id && map[t.column_id]) map[t.column_id].push(t);
    });
    Object.keys(map).forEach(k => {
      map[k].sort((a, b) => a.sort_order - b.sort_order);
    });
    return map;
  }, [columns, tasks]);

  // ─── Focus mode filter ───
  const getVisibleItems = useCallback((items: PersonalTask[]) => {
    let result = items;
    if (focusMode && user) {
      result = result.filter(t => {
        if (!t.candidate_id) return true;
        const c = candidates.find(cd => cd.id === t.candidate_id);
        return c?.owner_id === user.id || !c?.owner_id;
      });
    }
    if (filterPriority === 'none') {
      result = result.filter(t => !t.priority);
    } else if (filterPriority !== 'all') {
      result = result.filter(t => t.priority === filterPriority);
    }
    if (filterAssigned !== 'all') {
      result = result.filter(t => (filterAssigned === 'unassigned' ? !t.assigned_to : t.assigned_to === filterAssigned));
    }
    if (filterCardType !== 'all') {
      result = result.filter(t => {
        const type = t.card_type || (t.candidate_id ? 'candidate' : 'task');
        return type === filterCardType;
      });
    }
    return result;
  }, [focusMode, user, candidates, filterPriority, filterAssigned, filterCardType]);

  const uniqueAssignees = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => { if (t.assigned_to) set.add(t.assigned_to); });
    return Array.from(set).sort();
  }, [tasks]);

  const hasActiveFilters = filterPriority !== 'all' || filterAssigned !== 'all' || filterColumn !== 'all' || filterCardType !== 'all';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-sm text-muted-foreground">Loading your board...</span>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-col h-full">
        {/* ─── Row 1: Board Tabs ─── */}
        <div className="flex items-center gap-2 px-1 pb-1.5">
          <BoardSwitcher
            boards={boards}
            activeBoard={activeBoard}
            activeBoardId={activeBoardId}
            isSharedBoard={isSharedBoard}
            userId={user?.id}
            setActiveBoardId={setActiveBoardId}
            createBoard={createBoard}
            createSharedBoard={createSharedBoard}
            renameBoard={renameBoard}
            deleteBoard={deleteBoard}
            duplicateBoard={duplicateBoard}
            onShareOpen={() => setShareBoardOpen(true)}
          />
          {isSharedBoard && (
            <BoardMembersAvatars boardId={activeBoardId} getBoardMembers={getBoardMembers} onClick={() => setShareBoardOpen(true)} />
          )}
          {isSharedBoard && presentUsers.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <BoardPresenceAvatars users={presentUsers} currentUserId={user?.id} />
            </div>
          )}
          {isSharedBoard && boardRole === 'viewer' && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              <Eye className="h-3 w-3 mr-1" /> {t('myBoard.readOnly')}
            </Badge>
          )}
        </div>

        {/* ─── Row 2: Actions ─── */}
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-border mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder={t('myBoard.searchBoard')}
              className="h-7 pl-8 text-xs"
              value={candidateSearch}
              onChange={e => setCandidateSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setCandidateSearch(''); (e.target as HTMLInputElement).blur(); } }}
            />
          </div>

          <div className="flex-1" />

          {/* Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className={`h-7 w-7 p-0 ${hasActiveFilters ? 'text-primary' : 'text-muted-foreground'}`}>
                <Filter className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="end">
              <div className="space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <Flag className="h-3 w-3 text-muted-foreground" /> {t('myBoard.priority')}
                  </label>
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('myBoard.anyPriority')}</SelectItem>
                      <SelectItem value="none">{t('myBoard.noPriority')}</SelectItem>
                      <SelectItem value="high">{t('myBoard.high')}</SelectItem>
                      <SelectItem value="medium">{t('myBoard.medium')}</SelectItem>
                      <SelectItem value="low">{t('myBoard.low')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <User className="h-3 w-3 text-muted-foreground" /> {t('myBoard.assignedTo')}
                  </label>
                  <Select value={filterAssigned} onValueChange={setFilterAssigned}>
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('myBoard.anyone')}</SelectItem>
                      <SelectItem value="unassigned">{t('myBoard.unassigned')}</SelectItem>
                      {uniqueAssignees.map(a => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <LayoutGrid className="h-3 w-3 text-muted-foreground" /> {t('myBoard.column')}
                  </label>
                  <Select value={filterColumn} onValueChange={setFilterColumn}>
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('myBoard.allColumns')}</SelectItem>
                      {columns.map(c => (<SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
                    <CheckSquare className="h-3 w-3 text-muted-foreground" /> {t('myBoard.cardType')}
                  </label>
                  <Select value={filterCardType} onValueChange={(v) => setFilterCardType(v as CardTypeFilter)}>
                    <SelectTrigger className="h-8 text-xs w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('myBoard.allTypes')}</SelectItem>
                      <SelectItem value="candidate">{t('myBoard.candidates')}</SelectItem>
                      <SelectItem value="task">{t('myBoard.tasks')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground" onClick={() => { setFilterPriority('all'); setFilterAssigned('all'); setFilterColumn('all'); setFilterCardType('all'); }}>
                    <X className="h-3 w-3 mr-1.5" /> {t('myBoard.clearAllFilters')}
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Recent activity popover */}
          {recentItems.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground">
                  <Zap className="h-3.5 w-3.5" />
                  <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] leading-none">
                    {recentItems.length}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-2" align="end">
                <p className="text-xs font-semibold text-foreground mb-2 px-1">{t('myBoard.recent')}</p>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {recentItems.map(({ task, info }) => {
                    const colLabel = columns.find(c => c.id === task.column_id)?.label;
                    return (
                      <button
                        key={task.id}
                        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted text-left transition-colors text-[11px]"
                        onClick={() => {
                          const col = columns.find(c => c.id === task.column_id);
                          if (col) {
                            const el = document.getElementById(`col-${col.id}`);
                            el?.scrollIntoView({ behavior: 'smooth', inline: 'center' });
                          }
                        }}
                      >
                        <User className="h-3 w-3 text-primary/60 shrink-0" />
                        <span className="font-medium text-foreground truncate max-w-[120px]">{info!.candidate.name}</span>
                        {colLabel && <span className="text-muted-foreground/60">·</span>}
                        {colLabel && <span className="text-muted-foreground truncate max-w-[80px]">{colLabel}</span>}
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          )}

          {isSharedBoard && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setActivityLogOpen(true)}>
                  <Activity className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('myBoard.activityLog')}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground" onClick={() => setTrashOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                {trashCount > 0 && (
                  <Badge variant="secondary" className="h-4 min-w-[16px] px-1 text-[10px] leading-none">
                    {trashCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('myBoard.viewDeletedItems')}</TooltipContent>
          </Tooltip>
        </div>

        {/* ─── Board ─── */}
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
            {(boardProvided) => (
              <div
                ref={boardProvided.innerRef}
                {...boardProvided.droppableProps}
                className="flex gap-5 flex-1 overflow-x-auto pb-4 px-1"
              >
                {columns.filter(col => filterColumn === 'all' || col.id === filterColumn).map((col, colIdx) => {
                  const rawItems = grouped[col.id] || [];
                  const items = getVisibleItems(
                    candidateSearch
                      ? rawItems.filter(t => {
                          const q = candidateSearch.toLowerCase();
                          if (t.title.toLowerCase().includes(q)) return true;
                          if (t.candidate_id) {
                            const c = candidates.find(cd => cd.id === t.candidate_id);
                            if (c && (c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))) return true;
                          }
                          return false;
                        })
                      : rawItems
                  );

                  return (
                    <Draggable key={col.id} draggableId={`col-${col.id}`} index={colIdx}>
                      {(colProvided, colSnapshot) => (
                        <div
                          ref={colProvided.innerRef}
                          {...colProvided.draggableProps}
                          id={`col-${col.id}`}
                          className={`flex-shrink-0 w-76 flex flex-col transition-all duration-200 group/col ${
                            colSnapshot.isDragging
                              ? 'shadow-2xl scale-[1.02] rotate-[0.5deg] z-50 opacity-95 ring-2 ring-primary/20'
                              : ''
                          }`}
                          style={{
                            ...colProvided.draggableProps.style,
                          }}
                        >
                          {/* Column header — drag handle */}
                          <div
                            {...colProvided.dragHandleProps}
                            className="rounded-t-lg px-3 py-3 border-t-2 cursor-grab active:cursor-grabbing border-b border-border/30"
                            style={{
                              backgroundColor: `hsl(var(--stage-${col.color || 'blue'}))`,
                              borderTopColor: `hsl(var(--stage-${col.color || 'blue'}-accent) / 0.3)`,
                            }}
                          >
                            <div className="flex items-center gap-2 group/header">
                              {/* Drag grip */}
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity" />

                              {/* Color dot with popover picker */}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    className="h-2.5 w-2.5 rounded-full shrink-0 hover:scale-125 transition-transform cursor-pointer ring-offset-1 hover:ring-2 hover:ring-primary/30"
                                    style={{ backgroundColor: `hsl(var(--stage-${col.color || 'blue'}-accent))` }}
                                    onClick={e => e.stopPropagation()}
                                  />
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" align="start">
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {STAGE_COLORS.map(c => (
                                      <Tooltip key={c.key}>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={() => handleChangeColumnColor(col.id, c.key)}
                                            className={`h-6 w-6 rounded-full transition-all hover:scale-110 flex items-center justify-center ${
                                              (col.color || 'blue') === c.key ? 'ring-2 ring-offset-2 ring-primary ring-offset-background' : ''
                                            }`}
                                            style={{ backgroundColor: `hsl(var(--stage-${c.key}-accent))` }}
                                          >
                                            {(col.color || 'blue') === c.key && <Check className="h-3 w-3 text-white" />}
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-xs">{c.label}</TooltipContent>
                                      </Tooltip>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>

                              {/* Inline editable label */}
                              {editingCol === col.id ? (
                                <input
                                  value={editColLabel}
                                  onChange={e => setEditColLabel(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleRenameColumn(col.id);
                                    if (e.key === 'Escape') setEditingCol(null);
                                  }}
                                  onBlur={() => handleRenameColumn(col.id)}
                                  className="text-base font-bold text-foreground bg-transparent border-b border-foreground/30 outline-none flex-1 min-w-0 py-0"
                                  autoFocus
                                  onClick={e => e.stopPropagation()}
                                />
                              ) : (
                                <span
                                  className="text-base font-bold text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1 min-w-0 flex-1"
                                  onClick={e => { e.stopPropagation(); setEditingCol(col.id); setEditColLabel(col.label); }}
                                   title={t('myBoard.renameColumn')}
                                >
                                  <span className="truncate">{col.label}</span>
                                  <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0" />
                                </span>
                              )}

                              {/* Card count */}
                              <span className="text-xs font-semibold rounded-md px-2 py-0.5 min-w-[24px] text-center text-foreground/70 bg-card shadow-sm border border-border/60 shrink-0">
                                {items.length}
                              </span>

                              {/* Select all checkbox */}
                              {canEdit && items.length > 0 && (() => {
                                const colTaskIds = items.map(t => t.id);
                                const selectedCount = colTaskIds.filter(id => selectedTasks.has(id)).length;
                                const allSelected = selectedCount === colTaskIds.length;
                                const someSelected = selectedCount > 0 && !allSelected;
                                return (
                                  <Checkbox
                                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                                    onCheckedChange={() => {
                                      setSelectedTasks(prev => {
                                        const next = new Set(prev);
                                        if (allSelected) {
                                          colTaskIds.forEach(id => next.delete(id));
                                        } else {
                                          colTaskIds.forEach(id => next.add(id));
                                        }
                                        return next;
                                      });
                                    }}
                                    onClick={e => e.stopPropagation()}
                                    className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover/header:opacity-100 transition-opacity data-[state=checked]:opacity-100 data-[state=indeterminate]:opacity-100"
                                  />
                                );
                              })()}

                              {/* Delete — visible on hover */}
                              {isOwner && (
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteColumn(col.id); }}
                                  className="p-1 rounded hover:bg-destructive/15 transition-all opacity-0 group-hover/header:opacity-100 shrink-0"
                                   title={t('myBoard.deleteColumn')}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </button>
                              )}
                            </div>
                          </div>


                          {/* Droppable area for cards */}
                          <Droppable droppableId={col.id} type="CARD">
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                onClick={(e) => {
                                  if (e.target === e.currentTarget && canEdit && quickTaskCol !== col.id) {
                                    setQuickTaskCol(col.id);
                                  }
                                }}
                                className={`flex-1 overflow-y-auto min-h-[140px] p-3 pb-2 transition-all duration-200 border-x border-border/50 ${
                                  snapshot.isDraggingOver
                                    ? 'ring-2 ring-inset ring-primary/30'
                                    : ''
                                } ${canEdit && quickTaskCol !== col.id ? 'cursor-text' : ''}`}
                                style={{
                                  gap: '14px',
                                  backgroundColor: snapshot.isDraggingOver
                                    ? `hsl(var(--stage-${col.color || 'blue'}-accent) / 0.08)`
                                    : `hsl(var(--stage-${col.color || 'blue'}-accent) / 0.04)`,
                                }}
                              >
                                {(() => {
                                  const visibleLimit = colVisibleCount[col.id] || CARDS_PER_PAGE;
                                  const visibleItems = items.slice(0, visibleLimit);
                                  const hiddenCount = items.length - visibleLimit;
                                  return visibleItems.map((task, index) => {
                                    const info = task.candidate_id ? getCandidateInfo(task.candidate_id) : null;
                                    const isCandidate = !!task.candidate_id;
                                    const canMoveLeft = colIdx > 0;
                                    const canMoveRight = colIdx < columns.length - 1;

                                  return (
                                    <Draggable key={task.id} draggableId={task.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={`bg-card rounded-lg border shadow-sm overflow-hidden p-3.5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group relative mb-3.5 ${
                                            snapshot.isDragging ? 'rotate-[1.5deg] scale-[1.04] shadow-2xl ring-2 ring-primary/40 z-50 opacity-90' : ''
                                          } ${isCandidate ? 'border-l-[3px] border-l-primary/50 cursor-pointer' : 'border-l-[3px] border-l-muted-foreground/20 cursor-pointer'} ${
                                            selectedTasks.has(task.id) ? 'ring-2 ring-primary bg-primary/[0.02]' : ''
                                          }`}
                                          onClick={() => {
                                            if (selectedTasks.size > 0) return;
                                            if (isCandidate && task.candidate_id) {
                                              const c = candidates.find(cd => cd.id === task.candidate_id);
                                              if (c) setDetailCandidate(c);
                                            } else if (!isCandidate) {
                                              setEditTask(task);
                                              setEditTaskTitle(task.title);
                                              setEditTaskNotes(task.notes);
                                            }
                                          }}
                                        >
                                          {/* Multi-drag count badge */}
                                          {snapshot.isDragging && selectedTasks.has(task.id) && selectedTasks.size > 1 && (
                                            <div className="absolute -top-2 -right-2 z-20 h-5 min-w-[20px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-md">
                                              {selectedTasks.size}
                                            </div>
                                          )}

                                          {/* Quick move arrows */}
                                          {canEdit && (
                                            <>
                                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                              {canMoveLeft && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <button
                                                      onClick={e => { e.stopPropagation(); handleQuickMove(task.id, 'left'); }}
                                                      className="p-0.5 rounded-full bg-card border shadow-sm hover:bg-accent"
                                                    >
                                                      <ChevronLeft className="h-3 w-3 text-muted-foreground" />
                                                    </button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="left" className="text-xs">{columns[colIdx - 1].label}</TooltipContent>
                                                </Tooltip>
                                              )}
                                            </div>
                                            <div className="absolute -right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                              {canMoveRight && (
                                                <Tooltip>
                                                  <TooltipTrigger asChild>
                                                    <button
                                                      onClick={e => { e.stopPropagation(); handleQuickMove(task.id, 'right'); }}
                                                      className="p-0.5 rounded-full bg-card border shadow-sm hover:bg-accent"
                                                    >
                                                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                                    </button>
                                                  </TooltipTrigger>
                                                  <TooltipContent side="right" className="text-xs">{columns[colIdx + 1].label}</TooltipContent>
                                                </Tooltip>
                                              )}
                                            </div>
                                            </>
                                          )}

                                            <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                              {(task.card_type === 'task' || (!task.card_type && !isCandidate))
                                                ? <CheckSquare className="h-4 w-4 text-muted-foreground/60 shrink-0" />
                                                : <User className="h-4 w-4 text-primary/70 shrink-0" />
                                              }
                                              <Tooltip>
                                                <TooltipTrigger asChild>
                                                  <span className={`text-sm text-card-foreground truncate ${isCandidate ? 'font-semibold' : 'font-medium'}`}>
                                                    {info?.candidate?.name || task.title}
                                                  </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="top" className="text-xs max-w-[300px]">
                                                  {info?.candidate?.name || task.title}
                                                </TooltipContent>
                                              </Tooltip>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                              {canEdit && (
                                                <button
                                                  onClick={e => { e.stopPropagation(); handleDeleteTask(task.id, isCandidate); }}
                                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity"
                                                  title={isCandidate ? t('myBoard.removeFromBoard') : t('myBoard.deleteTask')}
                                                >
                                                  <X className="h-3 w-3" />
                                                </button>
                                              )}
                                              {canEdit && (
                                                <div className={`${selectedTasks.size > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                  <Checkbox
                                                    checked={selectedTasks.has(task.id)}
                                                    onCheckedChange={() => toggleTaskSelection(task.id)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="h-4 w-4"
                                                  />
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          {info && (
                                            <div className="mt-2 space-y-1">
                                              {info.position && (
                                                <p className="text-xs text-muted-foreground truncate">
                                                  {info.position.title}{info.company ? ` · ${info.company.name}` : ''}
                                                </p>
                                              )}
                                              {info.stage && (
                                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">{info.stage.label}</Badge>
                                              )}
                                              {(
                                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                                  {info.candidate.phone && (
                                                    <div className="flex items-center gap-1">
                                                      <Phone className="h-3 w-3 text-muted-foreground" />
                                                      <span className="text-[11px] text-muted-foreground">{info.candidate.phone}</span>
                                                    </div>
                                                  )}
                                                  {info.candidate.email && (
                                                    <div className="flex items-center gap-1">
                                                      <Mail className="h-3 w-3 text-muted-foreground" />
                                                      <span className="text-[11px] text-muted-foreground truncate">{info.candidate.email}</span>
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          )}

                                          {!isCandidate && task.notes && (
                                            <p className="text-xs text-muted-foreground/70 mt-1.5 truncate">{task.notes.substring(0, 60)}</p>
                                          )}

                                          {/* Priority / Due / Assignee badges */}
                                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 empty:mt-0">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const cycle = [null, 'low', 'medium', 'high'] as const;
                                                const idx = cycle.indexOf(task.priority as any);
                                                const next = cycle[(idx + 1) % cycle.length];
                                                saveTaskFields(task.id, { priority: next });
                                              }}
                                              className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full transition-colors ${
                                                task.priority && PRIORITY_CONFIG[task.priority]
                                                  ? `${PRIORITY_CONFIG[task.priority].color} ${PRIORITY_CONFIG[task.priority].bg} hover:opacity-80`
                                                  : 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted'
                                              }`}
                                              title={task.priority ? t('myBoard.priorityCycle', { priority: PRIORITY_CONFIG[task.priority]?.label || task.priority }) : t('myBoard.setPriority')}
                                            >
                                              <Flag className="h-2.5 w-2.5" />
                                              {task.priority && PRIORITY_CONFIG[task.priority] ? PRIORITY_CONFIG[task.priority].label : ''}
                                            </button>
                                            {task.due_date && (
                                              <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${
                                                new Date(task.due_date) < new Date()
                                                  ? 'text-destructive font-medium bg-destructive/10'
                                                  : 'text-muted-foreground bg-muted'
                                              }`}>
                                                <Calendar className="h-2.5 w-2.5" />
                                                {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                              </span>
                                            )}
                                            {task.assigned_to && (
                                              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                                <span className="h-3.5 w-3.5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-semibold shrink-0">
                                                  {task.assigned_to.charAt(0).toUpperCase()}
                                                </span>
                                                {task.assigned_to}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  );
                                  });
                                })()}
                                {provided.placeholder}
                                {/* Show more button */}
                                {items.length > (colVisibleCount[col.id] || CARDS_PER_PAGE) && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      setColVisibleCount(prev => ({ ...prev, [col.id]: (prev[col.id] || CARDS_PER_PAGE) + CARDS_PER_PAGE }));
                                    }}
                                    className="w-full text-xs text-primary hover:text-primary/80 font-medium py-2 transition-colors"
                                  >
                                    Show {Math.min(CARDS_PER_PAGE, items.length - (colVisibleCount[col.id] || CARDS_PER_PAGE))} more of {items.length - (colVisibleCount[col.id] || CARDS_PER_PAGE)} remaining
                                  </button>
                                )}

                                {/* Inline quick add input — appears after last card */}
                                {user && canEdit && quickTaskCol === col.id && (
                                  <QuickAddInput
                                    columnId={col.id} userId={user.id} onAdded={handleOptimisticTaskAdd}
                                    boardId={activeBoardId} isDefault={isDefaultBoard} isShared={isSharedBoard}
                                    autoFocus onDone={() => setQuickTaskCol(null)} forceCardType="task"
                                  />
                                )}

                                {/* Empty state */}
                                {items.length === 0 && quickTaskCol !== col.id && (
                                  <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                                      <Plus className="h-5 w-5 text-muted-foreground/50" />
                                    </div>
                                     <p className="text-sm font-medium text-muted-foreground/60 mb-4">{t('myBoard.noItemsYet')}</p>
                                     {canEdit && (
                                       <div className="flex gap-2 w-full px-3">
                                         <button
                                           onClick={(e) => { e.stopPropagation(); setQuickTaskCol(col.id); }}
                                           className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg py-2 transition-colors"
                                         >
                                           <Plus className="h-3.5 w-3.5" /> {t('myBoard.task')}
                                         </button>
                                         <button
                                           onClick={(e) => { e.stopPropagation(); setAddCandidateCol(col.id); setCandidateSearch(''); }}
                                           className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent border border-border/60 hover:border-border rounded-lg py-2 transition-colors"
                                         >
                                           <Users className="h-3.5 w-3.5" /> {t('myBoard.candidate')}
                                         </button>
                                       </div>
                                     )}
                                  </div>
                                )}

                                {/* Direct action buttons — visible on column hover */}
                                {canEdit && items.length > 0 && quickTaskCol !== col.id && (
                                  <div className="flex items-center gap-2 mt-2 opacity-0 group-hover/col:opacity-100 transition-all">
                                     <button
                                       onClick={() => setQuickTaskCol(col.id)}
                                       className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground/60 hover:text-primary hover:bg-primary/10 rounded-md py-1.5 transition-colors"
                                     >
                                       <Plus className="h-3 w-3" /> {t('myBoard.task')}
                                     </button>
                                     <button
                                       onClick={() => { setAddCandidateCol(col.id); setCandidateSearch(''); }}
                                       className="flex-1 flex items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground hover:bg-accent rounded-md py-1.5 transition-colors"
                                     >
                                       <Users className="h-3 w-3" /> {t('myBoard.candidate')}
                                     </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </Droppable>

                          {/* Close rounded-b */}
                          <div className="shrink-0 h-0 border-x border-b border-border/50 rounded-b-lg" />
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {boardProvided.placeholder}

                {/* Add column */}
                <div className="flex-shrink-0 w-76">
                  <button
                    onClick={() => setAddColOpen(true)}
                    className="w-full flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 rounded-lg py-8 border-2 border-dashed border-border transition-colors"
                  >
                    <Plus className="h-4 w-4" /> {t('myBoard.addColumn')}
                  </button>
                </div>
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {/* ─── Dialogs ─── */}
        <Dialog open={addColOpen} onOpenChange={setAddColOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>{t('myBoard.addColumn')}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); handleAddColumn(); }} className="flex gap-2">
              <Input placeholder={t('myBoard.columnName')} value={newColLabel} onChange={e => setNewColLabel(e.target.value)} autoFocus />
              <Button type="submit" disabled={!newColLabel.trim()}>{t('common.add')}</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!addCandidateCol} onOpenChange={o => { if (!o) { setAddCandidateCol(null); setCandidateSearch(''); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{t('myBoard.linkCandidate')}</DialogTitle></DialogHeader>
            <Input placeholder={t('myBoard.searchCandidates')} value={candidateSearch} onChange={e => setCandidateSearch(e.target.value)} autoFocus />
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1 pr-2">
                {filteredCandidates.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    {candidateSearch ? t('myBoard.noMatchingCandidates') : t('myBoard.noCandidatesAvailable')}
                  </p>
                ) : (
                  filteredCandidates.map(c => {
                    const pos = positions.find(p => p.id === c.position_id);
                    const company = pos ? companies.find(co => co.id === pos.company_id) : null;
                    return (
                      <button
                        key={c.id}
                        onClick={() => addCandidateCol && handleAddCandidateToBoard(c.id, addCandidateCol)}
                        className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-medium text-foreground">{c.name}</span>
                          {pos && <p className="text-xs text-muted-foreground truncate mt-0.5">{pos.title}{company ? ` · ${company.name}` : ''}</p>}
                        </div>
                        {c.email && <span className="text-[11px] text-muted-foreground shrink-0">{c.email}</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editTask} onOpenChange={o => { if (!o) { flushTaskSave(); setEditTask(null); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {t('myBoard.editCard')}
                <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{t('myBoard.autosave')}</span>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">{t('myBoard.title')}</label>
                <Input
                  value={editTaskTitle}
                  onChange={e => {
                    const val = e.target.value;
                    setEditTaskTitle(val);
                    if (editTask) debouncedTaskSave(() => saveTaskFields(editTask.id, { title: val, notes: editTaskNotes }));
                  }}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">{t('common.notes')}</label>
                <Textarea
                  value={editTaskNotes}
                  onChange={e => {
                    const val = e.target.value;
                    setEditTaskNotes(val);
                    if (editTask) debouncedTaskSave(() => saveTaskFields(editTask.id, { title: editTaskTitle, notes: val }));
                  }}
                  rows={4}
                  placeholder={t('myBoard.notesPlaceholder')}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Flag className="h-3 w-3" /> {t('myBoard.priority')}</label>
                  <select
                    value={editTask?.priority || ''}
                    onChange={e => {
                      if (editTask) {
                        const val = e.target.value || null;
                        setEditTask({ ...editTask, priority: val });
                        saveTaskFields(editTask.id, { priority: val });
                      }
                    }}
                    className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="">{t('myBoard.noPriority')}</option>
                    <option value="low">{t('myBoard.low')}</option>
                    <option value="medium">{t('myBoard.medium')}</option>
                    <option value="high">{t('myBoard.high')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> {t('myBoard.dueDate')}</label>
                  <Input
                    type="date"
                    value={editTask?.due_date || ''}
                    onChange={e => {
                      if (editTask) {
                        const val = e.target.value;
                        setEditTask({ ...editTask, due_date: val || null });
                        saveTaskFields(editTask.id, { due_date: val || null });
                      }
                    }}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><User className="h-3 w-3" /> {t('myBoard.assignedTo')}</label>
                  <Input
                    value={editTask?.assigned_to || ''}
                    onChange={e => {
                      if (editTask) {
                        const val = e.target.value;
                        setEditTask({ ...editTask, assigned_to: val });
                        debouncedTaskSave(() => saveTaskFields(editTask.id, { assigned_to: val }));
                      }
                    }}
                    placeholder={t('myBoard.namePlaceholder')}
                    className="mt-1 h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { flushTaskSave(); setEditTask(null); }}>{t('common.close')}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Share Board Dialog */}
        <ShareBoardDialog
          boardId={activeBoardId}
          boardName={activeBoard?.name}
          boardOwnerId={activeBoard?.owner_id}
          open={shareBoardOpen}
          onOpenChange={setShareBoardOpen}
          addBoardMember={addBoardMember}
          updateBoardMemberRole={updateBoardMemberRole}
          removeBoardMember={removeBoardMember}
          getBoardMembers={getBoardMembers}
        />
      </div>

      {/* ─── Bulk Action Bar ─── */}
      {selectedTasks.size > 0 && canEdit && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-200">
          <span className="text-sm font-medium text-foreground">
            <CheckSquare className="h-4 w-4 inline mr-1.5" />
            {selectedTasks.size} {t('common.selected', { count: selectedTasks.size }).split(' ').slice(1).join(' ')}
          </span>
          <div className="h-5 w-px bg-border" />

          {/* Move */}
          <Popover open={bulkMoveCol !== null} onOpenChange={open => setBulkMoveCol(open ? 'open' : null)}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" /> {t('myBoard.move')}
                <kbd className="ml-1.5 text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded font-mono">M</kbd>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-40 p-1" align="center" side="top">
              {columns.map(c => (
                <button
                  key={c.id}
                  onClick={() => handleBulkMove(c.id)}
                  className="w-full text-left text-sm px-3 py-1.5 rounded hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: `hsl(var(--stage-${c.color || 'blue'}-accent))` }} />
                  {c.label}
                </button>
              ))}
            </PopoverContent>
          </Popover>

          {/* Assign */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs">
                <User className="h-3.5 w-3.5 mr-1.5" /> {t('myBoard.assign')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="center" side="top">
              <Input
                placeholder={t('myBoard.assigneeName')}
                value={bulkAssign}
                onChange={e => setBulkAssign(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && bulkAssign.trim()) handleBulkAssign(bulkAssign.trim()); }}
                className="h-8 text-sm mb-2"
                autoFocus
              />
              {uniqueAssignees.length > 0 && (
                <div className="space-y-0.5 max-h-32 overflow-y-auto">
                  {uniqueAssignees.map(a => (
                    <button key={a} onClick={() => handleBulkAssign(a)} className="w-full text-left text-sm px-2 py-1 rounded hover:bg-accent transition-colors">
                      {a}
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          {/* Delete */}
          <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={handleBulkDelete}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t('common.delete')}
            <kbd className="ml-1.5 text-[10px] opacity-70 bg-destructive-foreground/20 px-1 py-0.5 rounded font-mono">D</kbd>
          </Button>

          <div className="h-5 w-px bg-border" />
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelectedTasks(new Set())}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteColConfirm}
        onOpenChange={(open) => { if (!open) setDeleteColConfirm(null); }}
        title={t('myBoard.deleteColumn')}
        description={(() => {
          const count = deleteColConfirm ? tasks.filter(tk => tk.column_id === deleteColConfirm).length : 0;
          return count > 0
            ? t('myBoard.deleteColumnDesc', { count })
            : t('myBoard.deleteEmptyColumnDesc');
        })()}
        onConfirm={confirmDeleteColumn}
      />
      <ConfirmDialog
        open={!!deleteTaskConfirm}
        onOpenChange={(open) => { if (!open) setDeleteTaskConfirm(null); }}
        title={deleteTaskConfirm?.isCandidate ? t('myBoard.removeCandidate') : t('myBoard.deleteCard')}
        description={deleteTaskConfirm?.isCandidate
          ? t('myBoard.removeCandidateDesc')
          : t('myBoard.deleteCardDesc')}
        confirmLabel={deleteTaskConfirm?.isCandidate ? t('common.remove') : t('common.delete')}
        onConfirm={confirmDeleteTask}
      />
      {isSharedBoard && (
        <BoardActivityLog boardId={activeBoardId} open={activityLogOpen} onOpenChange={setActivityLogOpen} />
      )}
      <TrashDrawer open={trashOpen} onOpenChange={setTrashOpen} onRestoreComplete={() => { fetchData(); refreshTrashCount(); }} scope={{ type: 'board', boardId: activeBoardId }} />
      <BoardAnalytics open={analyticsOpen} onOpenChange={setAnalyticsOpen} boardId={activeBoardId} boardName={activeBoard?.name || 'Board'} />
      <CandidateDetailSheet
        candidate={detailCandidate}
        open={!!detailCandidate}
        onOpenChange={open => { if (!open) setDetailCandidate(null); }}
        onNavigateCandidate={(direction) => {
          if (!detailCandidate) return;
          const boardCandidateIds = tasks
            .filter(t => t.candidate_id && !t.candidate_id.startsWith('__'))
            .map(t => t.candidate_id!);
          const uniqueIds = [...new Set(boardCandidateIds)];
          const currentIdx = uniqueIds.indexOf(detailCandidate.id);
          if (currentIdx === -1) return;
          const nextIdx = direction === 'next'
            ? (currentIdx + 1) % uniqueIds.length
            : (currentIdx - 1 + uniqueIds.length) % uniqueIds.length;
          const next = candidates.find(c => c.id === uniqueIds[nextIdx]);
          if (next) setDetailCandidate(next);
        }}
      />
    </TooltipProvider>
  );
}
