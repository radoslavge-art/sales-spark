import { useState } from 'react';
import { useATS } from '@/context/ATSContext';
import { Briefcase, Plus, Pencil, Trash2, Pin, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { HighlightText } from './HighlightText';
import { useLanguage } from '@/context/LanguageContext';

interface Props {
  companyId: string;
  selectedPositionId: string | null;
  onSelectPosition: (id: string | null) => void;
  searchQuery?: string;
  isPinned?: (id: string) => boolean;
  onTogglePin?: (id: string, type: 'company' | 'position') => void;
  onViewStats?: (positionId: string | null) => void;
}

export function PositionManager({ companyId, selectedPositionId, onSelectPosition, searchQuery = '', isPinned, onTogglePin, onViewStats }: Props) {
  const { positions, candidates, addPosition, updatePosition, deletePosition } = useATS();
  const { t } = useLanguage();
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; message: string } | null>(null);

  const filtered = positions.filter(p => {
    if (p.company_id !== companyId) return false;
    if (searchQuery) {
      return p.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const allPositions = positions.filter(p => p.company_id === companyId);

  const getCandidateCount = (posId: string) =>
    candidates.filter(c => c.position_id === posId && !c.is_rejected).length;

  const totalCandidates = allPositions.reduce((sum, p) => sum + getCandidateCount(p.id), 0);

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addPosition(newTitle.trim(), companyId);
    setNewTitle('');
    setDialogOpen(false);
  };

  const handleEdit = (id: string) => {
    if (!editTitle.trim()) return;
    updatePosition(id, { title: editTitle.trim() });
    setEditingId(null);
  };

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onSelectPosition(null)}
        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-all duration-150 ${
          selectedPositionId === null
            ? 'bg-accent text-accent-foreground font-semibold'
            : 'hover:bg-muted/60 text-foreground/80'
        }`}
      >
        <Briefcase className="h-3.5 w-3.5 shrink-0" />
        <span className="font-medium text-[13px]">{t('position.allPositions')}</span>
        {totalCandidates > 0 && (
          <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted/80 rounded-md px-2 py-0.5 min-w-[1.5rem] text-center">{totalCandidates}</span>
        )}
      </button>

      {filtered.map(p => {
        const count = getCandidateCount(p.id);
        const isSelected = selectedPositionId === p.id;
        const pinned = isPinned?.(p.id) ?? false;
        return (
          <div key={p.id} className="group/pos">
            {editingId === p.id ? (
              <form onSubmit={e => { e.preventDefault(); handleEdit(p.id); }} className="flex gap-1 px-1">
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-8 text-sm" autoFocus onBlur={() => handleEdit(p.id)} />
              </form>
            ) : (
              <button
                onClick={() => onSelectPosition(p.id)}
                title={p.title}
                className={`w-full flex items-start gap-2 pl-4 pr-2.5 py-2 rounded-lg text-[13px] transition-all duration-150 ${
                  isSelected
                    ? 'bg-accent text-accent-foreground font-semibold'
                    : 'hover:bg-muted/60 text-foreground/70'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${isSelected ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className="line-clamp-2 text-left leading-snug">
                  <HighlightText text={p.title} query={searchQuery} />
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {count > 0 && (
                    <span className="text-[11px] font-medium text-muted-foreground bg-muted/80 rounded-md px-2 py-0.5 min-w-[1.5rem] text-center">{count}</span>
                  )}
                  <span className="flex gap-0.5 opacity-0 group-hover/pos:opacity-100 transition-opacity">
                    {onViewStats && (
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); onViewStats(p.id); }}
                        className="p-1 rounded hover:bg-secondary cursor-pointer"
                        title="View Stats"
                      >
                        <BarChart3 className="h-3 w-3" />
                      </span>
                    )}
                    {onTogglePin && (
                      <span
                        role="button"
                        onClick={e => { e.stopPropagation(); onTogglePin(p.id, 'position'); }}
                        className={`p-1 rounded hover:bg-secondary cursor-pointer ${pinned ? 'text-primary opacity-100' : ''}`}
                        title={pinned ? 'Unpin' : 'Pin'}
                      >
                        <Pin className="h-3 w-3" />
                      </span>
                    )}
                    <span role="button" onClick={e => { e.stopPropagation(); setEditingId(p.id); setEditTitle(p.title); }} className="p-1 rounded hover:bg-secondary cursor-pointer">
                      <Pencil className="h-3 w-3" />
                    </span>
                    <span role="button" onClick={e => { e.stopPropagation(); const count = getCandidateCount(p.id); const msg = count > 0 ? `Delete "${p.title}"? This will also remove ${count} candidate(s). This cannot be undone.` : `Delete "${p.title}"? This cannot be undone.`; setDeleteConfirm({ id: p.id, message: msg }); }} className="p-1 rounded hover:bg-destructive/10 text-destructive cursor-pointer">
                      <Trash2 className="h-3 w-3" />
                    </span>
                  </span>
                </span>
              </button>
            )}
          </div>
        );
      })}

      {filtered.length === 0 && allPositions.length === 0 && (
        <p className="text-xs text-muted-foreground/60 px-3 py-2">{t('position.noPositions')}</p>
      )}
      {filtered.length === 0 && allPositions.length > 0 && searchQuery && (
        <p className="text-xs text-muted-foreground/60 px-3 py-2">{t('position.noMatchingPositions')}</p>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <button className="w-full flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer mt-1">
            <Plus className="h-3 w-3" />
            {t('position.addPosition')}
          </button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('position.addPosition')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={e => { e.preventDefault(); handleAdd(); }} className="flex gap-2">
            <Input placeholder={t('position.jobTitle')} value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
            <Button type="submit" disabled={!newTitle.trim()}>{t('common.add')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={t('position.deletePosition')}
        description={deleteConfirm?.message || ''}
        onConfirm={() => { if (deleteConfirm) { deletePosition(deleteConfirm.id); if (selectedPositionId === deleteConfirm.id) onSelectPosition(null); setDeleteConfirm(null); } }}
      />
    </div>
  );
}
