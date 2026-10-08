import { useState, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useATS } from '@/context/ATSContext';
import { STAGE_COLORS, StageColor } from '@/types/ats';
import { Plus, Trash2, Settings2, GripVertical, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 p-1">
      {STAGE_COLORS.map(c => (
        <Tooltip key={c.key}>
          <TooltipTrigger asChild>
            <button
              onClick={() => onChange(c.key)}
              className={`h-6 w-6 rounded-full transition-all hover:scale-110 flex items-center justify-center ${
                value === c.key ? 'ring-2 ring-offset-2 ring-primary ring-offset-background' : ''
              }`}
              style={{ backgroundColor: `hsl(var(--stage-${c.key}-accent))` }}
            >
              {value === c.key && <Check className="h-3 w-3 text-white" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{c.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

interface Props {
  companyId: string;
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function StageManager({ companyId, externalOpen, onExternalOpenChange }: Props) {
  const { getCompanyStages, addStage, updateStage, deleteStage, reorderStages, candidates, positions } = useATS();
  const [internalOpen, setInternalOpen] = useState(false);
  
  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? (v: boolean) => onExternalOpenChange?.(v) : setInternalOpen;
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState<StageColor>('blue');
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const stages = getCompanyStages(companyId);

  const handleLabelChange = useCallback((stageId: string, value: string) => {
    setEditLabels(prev => ({ ...prev, [stageId]: value }));
    if (debounceTimers.current[stageId]) clearTimeout(debounceTimers.current[stageId]);
    debounceTimers.current[stageId] = setTimeout(() => {
      if (value.trim()) updateStage(companyId, stageId, { label: value.trim() });
    }, 500);
  }, [companyId, updateStage]);

  const posIds = positions.filter(p => p.company_id === companyId).map(p => p.id);
  const companyCandidates = candidates.filter(c => posIds.includes(c.position_id));

  const handleAdd = () => {
    if (!newLabel.trim()) return;
    addStage(companyId, newLabel.trim(), newColor);
    setNewLabel('');
    setNewColor('blue');
  };

  const getCandidateCount = (stageId: string) =>
    companyCandidates.filter(c => c.stage_id === stageId).length;

  const onDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const ids = stages.map(s => s.id);
    const [moved] = ids.splice(result.source.index, 1);
    ids.splice(result.destination.index, 0, moved);
    reorderStages(companyId, ids);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 w-full justify-start text-xs text-muted-foreground">
            <Settings2 className="h-3.5 w-3.5" /> Manage Stages
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pipeline Stages</DialogTitle>
        </DialogHeader>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="stages">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2 mt-2">
                {stages.map((stage, i) => {
                  const count = getCandidateCount(stage.id);
                  return (
                    <Draggable key={stage.id} draggableId={stage.id} index={i}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 transition-shadow ${
                            snapshot.isDragging ? 'shadow-lg opacity-90' : ''
                          }`}
                        >
                          <div
                            {...provided.dragHandleProps}
                            className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <GripVertical className="h-4 w-4" />
                          </div>
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: `hsl(var(--stage-${stage.color}-accent))` }}
                          />
                          <Input
                            value={editLabels[stage.id] !== undefined ? editLabels[stage.id] : stage.label}
                            onChange={e => handleLabelChange(stage.id, e.target.value)}
                            className="h-8 text-sm flex-1"
                          />
                          <Popover>
                            <PopoverTrigger asChild>
                              <button
                                className="h-7 w-7 rounded-md border border-border shrink-0 hover:scale-105 transition-transform"
                                style={{ backgroundColor: `hsl(var(--stage-${stage.color}-accent))` }}
                                title="Change color"
                              />
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2" align="end">
                              <ColorPicker value={stage.color} onChange={v => updateStage(companyId, stage.id, { color: v })} />
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteConfirm({ id: stage.id, label: stage.label })}
                            disabled={count > 0}
                            title={count > 0 ? `${count} candidate(s) in this stage` : 'Delete stage'}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="New stage name..."
            className="h-8 text-sm flex-1"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="h-8 w-8 rounded-md border border-border shrink-0 hover:scale-105 transition-transform"
                style={{ backgroundColor: `hsl(var(--stage-${newColor}-accent))` }}
                title="Pick color"
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <ColorPicker value={newColor} onChange={v => setNewColor(v as StageColor)} />
            </PopoverContent>
          </Popover>
          <Button size="sm" className="h-8 gap-1" onClick={handleAdd} disabled={!newLabel.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={!!deleteConfirm}
      onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
      title="Delete Stage"
      description={`Delete stage "${deleteConfirm?.label}"? This cannot be undone.`}
      onConfirm={() => { if (deleteConfirm) { deleteStage(companyId, deleteConfirm.id); setDeleteConfirm(null); } }}
    />
    </>
  );
}
