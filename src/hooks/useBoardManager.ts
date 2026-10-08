import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Board {
  id: string;
  name: string;
  isDefault?: boolean;
  isLocal?: boolean;
  isShared?: boolean;
  owner_id?: string;
  owner_name?: string;
}

export interface LocalColumn {
  id: string;
  label: string;
  sort_order: number;
  color: string;
}

export interface LocalTask {
  id: string;
  column_id: string;
  title: string;
  notes: string;
  candidate_id: string | null;
  sort_order: number;
}

interface BoardData {
  columns: LocalColumn[];
  tasks: LocalTask[];
}

const STORAGE_KEY = 'my-boards';
const DATA_KEY_PREFIX = 'my-board-data-';

function generateId() {
  return crypto.randomUUID();
}

function loadLocalBoards(): Board[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const boards = JSON.parse(raw) as Board[];
      if (boards.length > 0) return boards.map(b => ({ ...b, isLocal: !b.isDefault }));
    }
  } catch {}
  const defaultBoard: Board = { id: 'default', name: 'Default Board', isDefault: true };
  localStorage.setItem(STORAGE_KEY, JSON.stringify([defaultBoard]));
  return [defaultBoard];
}

function saveLocalBoards(boards: Board[]) {
  const toSave = boards.filter(b => b.isDefault || b.isLocal);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

function loadBoardData(boardId: string): BoardData {
  try {
    const raw = localStorage.getItem(DATA_KEY_PREFIX + boardId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { columns: [], tasks: [] };
}

function saveBoardData(boardId: string, data: BoardData) {
  localStorage.setItem(DATA_KEY_PREFIX + boardId, JSON.stringify(data));
}

export type BoardRole = 'owner' | 'editor' | 'viewer' | null;

export function useBoardManager(userId: string | undefined) {
  const [localBoards, setLocalBoards] = useState<Board[]>(loadLocalBoards);
  const [sharedBoards, setSharedBoards] = useState<Board[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>(() => {
    try {
      return localStorage.getItem('my-boards-active') || 'default';
    } catch {
      return 'default';
    }
  });
  const [boardRole, setBoardRole] = useState<BoardRole>(null);

  // Load shared boards from Supabase
  const fetchSharedBoards = useCallback(async () => {
    if (!userId) return;
    // Boards I own + boards shared with me (exclude soft-deleted)
    const { data: owned } = await (supabase.from('boards').select('*').eq('owner_id', userId).is('deleted_at', null) as any);
    const { data: memberOf } = await (supabase.from('board_members').select('board_id').eq('user_id', userId) as any);

    const memberBoardIds = (memberOf || []).map((m: any) => m.board_id);
    let memberBoards: any[] = [];
    if (memberBoardIds.length > 0) {
      const { data } = await (supabase.from('boards').select('*').in('id', memberBoardIds).is('deleted_at', null) as any);
      memberBoards = data || [];
    }

    const allBoards = [...(owned || []), ...memberBoards]
      .filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i);

    // Fetch owner names for boards not owned by current user
    const otherOwnerIds = [...new Set(allBoards.filter(b => b.owner_id !== userId).map(b => b.owner_id))];
    let ownerNames: Record<string, string> = {};
    if (otherOwnerIds.length > 0) {
      const { data: profiles } = await (supabase.from('profiles').select('id, name').in('id', otherOwnerIds) as any);
      (profiles || []).forEach((p: any) => { ownerNames[p.id] = p.name || 'Unknown'; });
    }

    const allShared = allBoards.map((b: any) => ({
      id: b.id,
      name: b.name,
      isShared: true,
      isLocal: false,
      isDefault: false,
      owner_id: b.owner_id,
      owner_name: b.owner_id !== userId ? (ownerNames[b.owner_id] || 'Unknown') : undefined,
    }));

    setSharedBoards(allShared);
  }, [userId]);

  useEffect(() => { fetchSharedBoards(); }, [fetchSharedBoards]);

  // Fetch role for active shared board
  const fetchBoardRole = useCallback(async () => {
    if (!userId || !activeBoardId) { setBoardRole(null); return; }
    const board = [...localBoards, ...sharedBoards].find(b => b.id === activeBoardId);
    if (!board?.isShared) { setBoardRole(null); return; }
    const { data } = await (supabase.rpc('get_board_role', { _user_id: userId, _board_id: activeBoardId }) as any);
    setBoardRole((data as BoardRole) || null);
  }, [userId, activeBoardId, localBoards, sharedBoards]);

  useEffect(() => { fetchBoardRole(); }, [fetchBoardRole]);

  const boards = [...localBoards, ...sharedBoards];
  const activeBoard = boards.find(b => b.id === activeBoardId) || boards[0];
  const isDefaultBoard = activeBoard?.isDefault === true;
  const isSharedBoard = activeBoard?.isShared === true;
  const isLocalBoard = activeBoard?.isLocal === true && !activeBoard?.isShared;
  const canEdit = !isSharedBoard || boardRole === 'owner' || boardRole === 'editor';
  const isOwner = !isSharedBoard || boardRole === 'owner' || isDefaultBoard || isLocalBoard;

  useEffect(() => {
    localStorage.setItem('my-boards-active', activeBoardId);
  }, [activeBoardId]);

  // Create local board
  const createBoard = useCallback((name: string) => {
    const newBoard: Board = { id: generateId(), name, isLocal: true };
    const defaultCols: LocalColumn[] = ['To Do', 'In Progress', 'Done'].map((label, i) => ({
      id: generateId(), label, sort_order: i, color: 'blue',
    }));
    const updated = [...localBoards, newBoard];
    setLocalBoards(updated);
    saveLocalBoards(updated);
    saveBoardData(newBoard.id, { columns: defaultCols, tasks: [] });
    setActiveBoardId(newBoard.id);
    return newBoard;
  }, [localBoards]);

  // Create shared board (persisted to Supabase)
  const createSharedBoard = useCallback(async (name: string) => {
    if (!userId) return;
    const { data, error } = await (supabase.from('boards').insert({
      name, owner_id: userId, is_shared: true,
    }).select().single() as any);
    if (error || !data) return;

    // Create default columns with recruitment pipeline template
    const DEFAULT_BOARD_COLS = [
      { label: 'Applied', color: 'blue', column_type: 'sourcing' },
      { label: 'Screening', color: 'teal', column_type: 'screening' },
      { label: 'Interview', color: 'amber', column_type: 'interview' },
      { label: 'Offer', color: 'purple', column_type: 'offer' },
      { label: 'Hired', color: 'green', column_type: 'hired' },
      { label: 'Rejected', color: 'red', column_type: 'rejected' },
    ];
    const cols = DEFAULT_BOARD_COLS.map((c, i) => ({
      board_id: data.id, label: c.label, sort_order: i, color: c.color, column_type: c.column_type,
    }));
    await (supabase.from('board_columns').insert(cols) as any);

    await fetchSharedBoards();
    setActiveBoardId(data.id);
    return data;
  }, [userId, fetchSharedBoards]);

  const renameBoard = useCallback(async (id: string, name: string) => {
    const board = boards.find(b => b.id === id);
    if (!board) return;

    if (board.isShared) {
      await (supabase.from('boards').update({ name }).eq('id', id) as any);
      await fetchSharedBoards();
    } else {
      const updated = localBoards.map(b => b.id === id ? { ...b, name } : b);
      setLocalBoards(updated);
      saveLocalBoards(updated);
    }
  }, [boards, localBoards, fetchSharedBoards]);

  const deleteBoard = useCallback(async (id: string) => {
    const board = boards.find(b => b.id === id);
    if (!board || board.isDefault) return;

    if (board.isShared) {
      // Soft-delete the board and cascade to columns + tasks
      const now = new Date().toISOString();
      await (supabase.from('board_tasks').update({ deleted_at: now, deleted_by: userId } as any).eq('board_id', id) as any);
      await (supabase.from('board_columns').update({ deleted_at: now, deleted_by: userId } as any).eq('board_id', id) as any);
      await (supabase.from('boards').update({ deleted_at: now, deleted_by: userId } as any).eq('id', id) as any);
      await fetchSharedBoards();
    } else {
      const updated = localBoards.filter(b => b.id !== id);
      setLocalBoards(updated);
      saveLocalBoards(updated);
      localStorage.removeItem(DATA_KEY_PREFIX + id);
    }
    if (activeBoardId === id) setActiveBoardId('default');
  }, [boards, localBoards, activeBoardId, userId, fetchSharedBoards]);

  const duplicateBoard = useCallback(async (id: string) => {
    const source = boards.find(b => b.id === id);
    if (!source || !userId) return;

    // Always create a shared board copy in Supabase
    const { data: newBoard, error: boardErr } = await (supabase.from('boards').insert({
      name: `${source.name} (copy)`, owner_id: userId, is_shared: true,
    }).select().single() as any);
    if (boardErr || !newBoard) return;

    let srcCols: any[] = [];
    let srcTasks: any[] = [];

    if (source.isDefault) {
      // Default board: read from personal_columns / personal_tasks
      const { data: pCols } = await (supabase.from('personal_columns').select('*')
        .eq('user_id', userId).is('deleted_at', null).order('sort_order') as any);
      srcCols = pCols || [];
      const { data: pTasks } = await (supabase.from('personal_tasks').select('*')
        .eq('user_id', userId).is('deleted_at', null).order('sort_order') as any);
      srcTasks = pTasks || [];
    } else if (source.isShared) {
      const { data: bCols } = await (supabase.from('board_columns').select('*')
        .eq('board_id', id).is('deleted_at', null).order('sort_order') as any);
      srcCols = bCols || [];
      const { data: bTasks } = await (supabase.from('board_tasks').select('*')
        .eq('board_id', id).is('deleted_at', null).order('sort_order') as any);
      srcTasks = bTasks || [];
    } else {
      // Local board: read from localStorage
      const localData = loadBoardData(id);
      srcCols = localData.columns.map(c => ({
        id: c.id, label: c.label, color: c.color, sort_order: c.sort_order,
        column_type: null, max_cards: null,
      }));
      srcTasks = localData.tasks.map(t => ({
        id: t.id, column_id: t.column_id, title: t.title, notes: t.notes,
        candidate_id: t.candidate_id, sort_order: t.sort_order,
        priority: null, due_date: null, assigned_to: '', card_type: 'task',
      }));
    }

    // Fallback: seed default columns if source has none
    if (srcCols.length === 0) {
      srcCols = ['To Do', 'In Progress', 'Done'].map((label, i) => ({
        id: generateId(), label, color: 'blue', sort_order: i,
        column_type: null, max_cards: null,
      }));
    }

    // Duplicate columns
    const colIdMap: Record<string, string> = {};
    const newCols = srcCols.map((c: any) => {
      const newColId = generateId();
      colIdMap[c.id] = newColId;
      return {
        id: newColId, board_id: newBoard.id, label: c.label,
        color: c.color, sort_order: c.sort_order, column_type: c.column_type || null,
        max_cards: c.max_cards || null,
      };
    });
    await (supabase.from('board_columns').insert(newCols) as any);

    // Duplicate tasks
    if (srcTasks.length > 0) {
      const newTasks = srcTasks.map((t: any) => ({
        id: generateId(), board_id: newBoard.id,
        column_id: t.column_id ? (colIdMap[t.column_id] || null) : null,
        title: t.title, notes: t.notes || '', priority: t.priority || null,
        due_date: t.due_date || null, assigned_to: t.assigned_to || '',
        candidate_id: t.candidate_id || null, card_type: t.card_type || 'task',
        sort_order: t.sort_order,
      }));
      await (supabase.from('board_tasks').insert(newTasks) as any);
    }

    await fetchSharedBoards();
    setActiveBoardId(newBoard.id);
    return newBoard;
  }, [boards, userId, fetchSharedBoards]);

  // Share board members
  const addBoardMember = useCallback(async (boardId: string, memberUserId: string, role: string = 'editor') => {
    await (supabase.from('board_members').insert({
      board_id: boardId, user_id: memberUserId, role,
    }) as any);
  }, []);

  const updateBoardMemberRole = useCallback(async (boardId: string, memberUserId: string, role: string) => {
    await (supabase.from('board_members').update({ role })
      .eq('board_id', boardId).eq('user_id', memberUserId) as any);
  }, []);

  const removeBoardMember = useCallback(async (boardId: string, memberUserId: string) => {
    await (supabase.from('board_members').delete()
      .eq('board_id', boardId).eq('user_id', memberUserId) as any);
  }, []);

  const getBoardMembers = useCallback(async (boardId: string) => {
    const { data: members } = await (supabase.from('board_members')
      .select('*')
      .eq('board_id', boardId) as any);
    if (!members || members.length === 0) return [];
    // Fetch profiles separately since there's no FK relationship
    const userIds = [...new Set(members.map((m: any) => m.user_id))] as string[];
    const { data: profiles } = await (supabase.from('profiles')
      .select('id, name, email')
      .in('id', userIds) as any);
    const profileMap: Record<string, { name: string; email?: string }> = {};
    (profiles || []).forEach((p: any) => { profileMap[p.id] = { name: p.name, email: p.email }; });
    return members.map((m: any) => ({ ...m, profiles: profileMap[m.user_id] || null }));
  }, []);

  const loadLocalData = useCallback((boardId: string) => loadBoardData(boardId), []);
  const saveLocalData = useCallback((boardId: string, data: BoardData) => saveBoardData(boardId, data), []);

  return {
    boards,
    activeBoard,
    activeBoardId,
    isDefaultBoard,
    isSharedBoard,
    isLocalBoard,
    boardRole,
    canEdit,
    isOwner,
    setActiveBoardId,
    createBoard,
    createSharedBoard,
    renameBoard,
    deleteBoard,
    duplicateBoard,
    addBoardMember,
    updateBoardMemberRole,
    removeBoardMember,
    getBoardMembers,
    fetchSharedBoards,
    loadLocalData,
    saveLocalData,
  };
}
