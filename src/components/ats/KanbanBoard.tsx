import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLanguage } from '@/context/LanguageContext';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useATS } from '@/context/ATSContext';
import { Candidate, Stage, STAGE_COLORS } from '@/types/ats';
import { CandidateCard, ActivityInfo } from './CandidateCard';
import { BulkActionBar } from './BulkActionBar';
import { Pencil, Check, Plus, Trash2, GripVertical } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

interface Props {
  companyId: string | null;
  positionId: string | null;
  searchQuery: string;
  onOpenCandidate?: (candidate: Candidate) => void;
}

export function KanbanBoard({ companyId, positionId, searchQuery, onOpenCandidate }: Props) {
  const isMobile = useIsMobile();
  const { t } = useLanguage();
  const { candidates, positions, companies, moveCandidateStatus, deleteCandidate, rejectCandidate, getCompanyStages, updateStage, addStage, deleteStage, reorderStages } = useATS();
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [newStageName, setNewStageName] = useState('');
  const [isAddingStage, setIsAddingStage] = useState(false);
  const newStageInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const lastClickedRef = useRef<string | null>(null);

  // Batch activity fetch (fix N+1)
  const [activityMap, setActivityMap] = useState<Record<string, ActivityInfo>>({});

  // FIX #5: Use exact match for rejected stage labels, not substring
  const stages = useMemo(() => {
    const REJECTED_LABELS = new Set(['rejected', 'declined', 'rejected / declined', 'rejected/ declined', 'declined/ rejected', 'declined / rejected', 'отказ']);
    const filterRejected = (s: Stage) => !REJECTED_LABELS.has(s.label.trim().toLowerCase());
    if (companyId) return getCompanyStages(companyId).filter(filterRejected);
    const allStages: Stage[] = [];
    const seen = new Set<string>();
    companies.forEach(c => {
      c.stages.forEach(s => {
        if (!seen.has(s.id) && filterRejected(s)) {
          seen.add(s.id);
          allStages.push(s);
        }
      });
    });
    return allStages.sort((a, b) => a.sort_order - b.sort_order);
  }, [companyId, companies, getCompanyStages]);

  const filtered = useMemo(() => {
    let result = candidates.filter(c => !c.is_rejected);
    if (positionId) {
      result = result.filter(c => c.position_id === positionId);
    } else if (companyId) {
      const posIds = positions.filter(p => p.company_id === companyId).map(p => p.id);
      result = result.filter(c => posIds.includes(c.position_id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.notes?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    return result;
  }, [candidates, positions, companyId, positionId, searchQuery]);

  // Fetch all activities for visible candidates in one query
  useEffect(() => {
    const ids = filtered.map(c => c.id);
    if (ids.length === 0) {
      setActivityMap({});
      return;
    }
    (supabase.from('activities' as any)
      .select('entity_id, action, created_at, user_id')
      .eq('entity_type', 'candidate')
      .in('entity_id', ids)
      .order('created_at', { ascending: false })
      .limit(ids.length * 2) as any)
      .then(async ({ data }: any) => {
        if (!data) return;
        // Collect unique user IDs
        const userIds = [...new Set((data as any[]).map((r: any) => r.user_id).filter(Boolean))] as string[];
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
        const map: Record<string, ActivityInfo> = {};
        for (const row of data) {
          if (!map[row.entity_id]) {
            map[row.entity_id] = { action: row.action, created_at: row.created_at, userName: nameMap[row.user_id] || '' };
          }
        }
        setActivityMap(map);
      });
  }, [filtered]);

  // Flat ordered list for shift+click range selection
  const flatOrder = useMemo(() => {
    const order: string[] = [];
    const map: Record<string, Candidate[]> = {};
    stages.forEach(s => { map[s.id] = []; });
    const unassigned: Candidate[] = [];
    filtered.forEach(c => {
      if (c.stage_id && map[c.stage_id]) {
        map[c.stage_id].push(c);
      } else {
        unassigned.push(c);
      }
    });
    stages.forEach(s => map[s.id].forEach(c => order.push(c.id)));
    unassigned.forEach(c => order.push(c.id));
    return order;
  }, [filtered, stages]);

  const { grouped, unassigned } = useMemo(() => {
    const map: Record<string, Candidate[]> = {};
    const unassigned: Candidate[] = [];
    stages.forEach(s => { map[s.id] = []; });
    filtered.forEach(c => {
      if (c.stage_id && map[c.stage_id]) {
        map[c.stage_id].push(c);
      } else {
        unassigned.push(c);
      }
    });
    return { grouped: map, unassigned };
  }, [filtered, stages]);

  const handleSelect = useCallback((candidateId: string, shiftKey: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (shiftKey && lastClickedRef.current) {
        const startIdx = flatOrder.indexOf(lastClickedRef.current);
        const endIdx = flatOrder.indexOf(candidateId);
        if (startIdx !== -1 && endIdx !== -1) {
          const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
          for (let i = from; i <= to; i++) {
            next.add(flatOrder[i]);
          }
        }
      } else {
        if (next.has(candidateId)) {
          next.delete(candidateId);
        } else {
          next.add(candidateId);
        }
      }
      lastClickedRef.current = candidateId;
      return next;
    });
  }, [flatOrder]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    lastClickedRef.current = null;
  }, []);

  const handleBulkMove = useCallback(async (stageId: string) => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map(id => moveCandidateStatus(id, stageId)));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      toast.error(`${failed} of ${ids.length} candidates failed to move`);
    }
    clearSelection();
  }, [selectedIds, moveCandidateStatus, clearSelection]);

  const handleBulkReject = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map(id => rejectCandidate(id)));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      toast.error(`${failed} of ${ids.length} candidates failed to reject`);
    }
    clearSelection();
  }, [selectedIds, rejectCandidate, clearSelection]);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const results = await Promise.allSettled(ids.map(id => deleteCandidate(id)));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      toast.error(`${failed} of ${ids.length} candidates failed to delete`);
    }
    clearSelection();
  }, [selectedIds, deleteCandidate, clearSelection]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    // Column reorder
    if (result.type === 'COLUMN') {
      if (!companyId) return;
      const newOrder = [...stages];
      const [moved] = newOrder.splice(result.source.index, 1);
      newOrder.splice(result.destination.index, 0, moved);
      reorderStages(companyId, newOrder.map(s => s.id));
      return;
    }

    // Card move
    const destId = result.destination.droppableId;
    if (destId === 'unassigned') {
      moveCandidateStatus(result.draggableId, '');
    } else {
      moveCandidateStatus(result.draggableId, destId);
    }
  };

  const startEditing = useCallback((stage: Stage) => {
    setEditingStageId(stage.id);
    setEditValue(stage.label);
    setTimeout(() => editInputRef.current?.select(), 0);
  }, []);

  const saveEdit = useCallback((stageCompanyId: string) => {
    if (editingStageId && editValue.trim()) {
      updateStage(stageCompanyId, editingStageId, { label: editValue.trim() });
    }
    setEditingStageId(null);
  }, [editingStageId, editValue, updateStage]);

  const handleOpenDetail = useCallback((candidate: Candidate) => {
    onOpenCandidate?.(candidate);
  }, [onOpenCandidate]);

  const cancelEdit = useCallback(() => {
    setEditingStageId(null);
  }, []);

  const handleAddStage = useCallback(async () => {
    if (!newStageName.trim() || !companyId) return;
    await addStage(companyId, newStageName.trim(), 'blue');
    setNewStageName('');
    setIsAddingStage(false);
  }, [newStageName, companyId, addStage]);

  const startAddingStage = useCallback(() => {
    setIsAddingStage(true);
    setNewStageName('');
    setTimeout(() => newStageInputRef.current?.focus(), 0);
  }, []);

  const getCandidateCountForStage = useCallback((stageId: string) => {
    return candidates.filter(c => c.stage_id === stageId && !c.is_rejected).length;
  }, [candidates]);

  const handleDeleteStage = useCallback((stage: Stage) => {
    const count = getCandidateCountForStage(stage.id);
    if (count > 0) {
      toast.error(`Cannot delete "${stage.label}" — it has ${count} active candidate(s). Move them first.`);
      return;
    }
    setDeleteConfirm({ id: stage.id, label: stage.label });
  }, [getCandidateCountForStage]);

  const confirmDeleteStage = useCallback(() => {
    if (!deleteConfirm || !companyId) return;
    deleteStage(companyId, deleteConfirm.id);
    setDeleteConfirm(null);
  }, [deleteConfirm, companyId, deleteStage]);

  const renderCard = (candidate: Candidate, index: number) => (
    <Draggable key={candidate.id} draggableId={candidate.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={snapshot.isDragging ? 'rotate-2 scale-105' : ''}
        >
          <CandidateCard
            candidate={candidate}
            onOpenDetail={handleOpenDetail}
            isSelected={selectedIds.has(candidate.id)}
            onSelect={handleSelect}
            lastActivity={activityMap[candidate.id] || null}
          />
        </div>
      )}
    </Draggable>
  );

  const renderColumnHeader = (stage: Stage) => (
    <div
      className="rounded-t-lg px-3 py-2.5 border-t-2"
      style={{
        backgroundColor: `hsl(var(--stage-${stage.color}))`,
        borderColor: `hsl(var(--stage-${stage.color}-accent) / 0.3)`,
      }}
    >
      <div className="flex items-center gap-2 group/header">
        {companyId && (
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0 cursor-grab" />
        )}
        {companyId && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-2.5 w-2.5 rounded-full shrink-0 hover:scale-125 transition-transform cursor-pointer ring-offset-1 hover:ring-2 hover:ring-primary/30"
                style={{ backgroundColor: `hsl(var(--stage-${stage.color}-accent))` }}
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="grid grid-cols-4 gap-1.5">
                {STAGE_COLORS.map(c => (
                  <Tooltip key={c.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => updateStage(companyId, stage.id, { color: c.key })}
                        className={`h-6 w-6 rounded-full transition-all hover:scale-110 flex items-center justify-center ${
                          stage.color === c.key ? 'ring-2 ring-offset-2 ring-primary ring-offset-background' : ''
                        }`}
                        style={{ backgroundColor: `hsl(var(--stage-${c.key}-accent))` }}
                      >
                        {stage.color === c.key && <Check className="h-3 w-3 text-white" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{c.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {!companyId && (
          <div
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: `hsl(var(--stage-${stage.color}-accent))` }}
          />
        )}

        {editingStageId === stage.id ? (
          <input
            ref={editInputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') saveEdit(stage.company_id);
              if (e.key === 'Escape') cancelEdit();
            }}
            onBlur={() => saveEdit(stage.company_id)}
            className="text-sm font-semibold text-foreground bg-transparent border-b border-foreground/30 outline-none flex-1 min-w-0 py-0"
            autoFocus
          />
        ) : (
          <span
            className="text-sm font-semibold text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1 min-w-0"
            onDoubleClick={() => companyId && startEditing(stage)}
            title="Double-click to rename"
          >
            <span className="truncate">{stage.label}</span>
            {companyId && (
              <Pencil
                className="h-3 w-3 text-muted-foreground opacity-0 group-hover/header:opacity-100 transition-opacity shrink-0 cursor-pointer hover:text-primary"
                onClick={() => startEditing(stage)}
              />
            )}
          </span>
        )}

        <span className="ml-auto flex items-center gap-1 shrink-0">
          <span className="text-xs font-medium text-muted-foreground bg-card rounded-full px-2 py-0.5">
            {(grouped[stage.id] || []).length}
          </span>
          {companyId && (
            <Trash2
              className="h-3 w-3 text-muted-foreground/40 opacity-0 group-hover/header:opacity-100 transition-opacity cursor-pointer hover:text-destructive"
              onClick={() => handleDeleteStage(stage)}
            />
          )}
        </span>
      </div>
    </div>
  );

  return (
    <>
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="board-columns" direction="horizontal" type="COLUMN">
          {(colProvided) => (
            <div
              ref={colProvided.innerRef}
              {...colProvided.droppableProps}
              className={`flex gap-3 h-full overflow-x-auto pb-4 ${isMobile ? 'snap-x snap-mandatory' : 'gap-4'}`}
            >
              {stages.map((stage, colIndex) => {
                const items = grouped[stage.id] || [];
                const columnContent = (
                  <div className={`flex-shrink-0 flex flex-col ${isMobile ? 'w-64 snap-start' : 'w-72'}`}>
                    {renderColumnHeader(stage)}
                    <Droppable droppableId={stage.id} type="CARD">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-[200px] space-y-2 p-2 transition-colors rounded-b-lg ${
                            snapshot.isDraggingOver ? 'bg-accent/50' : 'bg-muted/30'
                          }`}
                        >
                          {items.map((candidate, index) => renderCard(candidate, index))}
                          {provided.placeholder}
                          {items.length === 0 && !snapshot.isDraggingOver && (
                            <p className="text-xs text-muted-foreground text-center py-8">
                              {t('candidate.dropHere')}
                            </p>
                          )}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );

                if (!companyId) {
                  return <div key={stage.id}>{columnContent}</div>;
                }

                return (
                  <Draggable key={stage.id} draggableId={`col-${stage.id}`} index={colIndex}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        className={`flex-shrink-0 flex flex-col transition-shadow ${isMobile ? 'w-64 snap-start' : 'w-72'} ${dragSnapshot.isDragging ? 'shadow-xl opacity-90' : ''}`}
                      >
                        <div {...dragProvided.dragHandleProps}>
                          {renderColumnHeader(stage)}
                        </div>
                        <Droppable droppableId={stage.id} type="CARD">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`flex-1 min-h-[200px] space-y-2 p-2 transition-colors rounded-b-lg ${
                                snapshot.isDraggingOver ? 'bg-accent/50' : 'bg-muted/30'
                              }`}
                            >
                              {items.map((candidate, index) => renderCard(candidate, index))}
                              {provided.placeholder}
                               {items.length === 0 && !snapshot.isDraggingOver && (
                                 <p className="text-xs text-muted-foreground text-center py-8">
                                   {t('candidate.dropHere')}
                                 </p>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </div>
                    )}
                  </Draggable>
                );
              })}

              {/* Unassigned column */}
              {unassigned.length > 0 && (
                <div className={`flex-shrink-0 flex flex-col ${isMobile ? 'w-64 snap-start' : 'w-72'}`}>
                  <div className="rounded-t-lg px-3 py-2.5 border-t-2 bg-muted border-muted-foreground/30">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-muted-foreground" />
                      <span className="text-sm font-semibold text-foreground">{t('candidate.unassigned')}</span>
                      <span className="ml-auto text-xs font-medium text-muted-foreground bg-card rounded-full px-2 py-0.5">
                        {unassigned.length}
                      </span>
                    </div>
                  </div>
                  <Droppable droppableId="unassigned" type="CARD">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 min-h-[200px] space-y-2 p-2 transition-colors rounded-b-lg ${
                          snapshot.isDraggingOver ? 'bg-accent/50' : 'bg-muted/30'
                        }`}
                      >
                        {unassigned.map((candidate, index) => renderCard(candidate, index))}
                        {provided.placeholder}
                         {unassigned.length === 0 && !snapshot.isDraggingOver && (
                           <p className="text-xs text-muted-foreground text-center py-8">
                             {t('candidate.dropHere')}
                           </p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )}

              {/* Add Stage column */}
              {companyId && (
                <div className={`flex-shrink-0 flex flex-col ${isMobile ? 'w-64 snap-start' : 'w-72'}`}>
                  {isAddingStage ? (
                    <div className="rounded-lg border-2 border-dashed border-border p-3">
                      <input
                        ref={newStageInputRef}
                        value={newStageName}
                        onChange={e => setNewStageName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleAddStage();
                          if (e.key === 'Escape') { setIsAddingStage(false); setNewStageName(''); }
                        }}
                        onBlur={() => {
                          if (newStageName.trim()) {
                            handleAddStage();
                          } else {
                            setIsAddingStage(false);
                          }
                        }}
                        placeholder="Stage name..."
                        className="w-full text-sm font-medium bg-transparent border-b border-foreground/20 outline-none pb-1 text-foreground placeholder:text-muted-foreground/50"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={startAddingStage}
                      className="rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/50 transition-all px-3 py-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      {t('kanban.addStage')}
                    </button>
                  )}
                </div>
              )}

              {colProvided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <BulkActionBar
        count={selectedIds.size}
        stages={stages}
        onMoveToStage={handleBulkMove}
        onReject={handleBulkReject}
        onDelete={handleBulkDelete}
        onClearSelection={clearSelection}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Delete Stage"
        description={`Delete "${deleteConfirm?.label}"? This cannot be undone.`}
        onConfirm={confirmDeleteStage}
      />
    </>
  );
}
