import { useState } from 'react';
import { useATS } from '@/context/ATSContext';
import { Briefcase, Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Props {
  companyId: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function PositionSelector({ companyId, selectedId, onSelect }: Props) {
  const { positions, addPosition, updatePosition, deletePosition } = useATS();
  const [newTitle, setNewTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = companyId ? positions.filter(p => p.company_id === companyId) : positions;

  const handleAdd = async () => {
    if (!newTitle.trim() || !companyId) return;
    const p = await addPosition(newTitle.trim(), companyId);
    setNewTitle('');
    if (p) onSelect(p.id);
  };

  const handleEdit = (id: string) => {
    if (!editTitle.trim()) return;
    updatePosition(id, { title: editTitle.trim() });
    setEditingId(null);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Positions</span>
        {companyId && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Position</DialogTitle>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); handleAdd(); setDialogOpen(false); }} className="flex gap-2">
                <Input placeholder="Job title" value={newTitle} onChange={e => setNewTitle(e.target.value)} autoFocus />
                <Button type="submit" disabled={!newTitle.trim()}>Add</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <button
        onClick={() => onSelect(null)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
          selectedId === null ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
        }`}
      >
        <Briefcase className="h-4 w-4 shrink-0" />
        All Positions
      </button>

      {filtered.map(p => (
        <div key={p.id} className="group relative">
          {editingId === p.id ? (
            <form onSubmit={e => { e.preventDefault(); handleEdit(p.id); }} className="flex gap-1 px-2">
              <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="h-8 text-sm" autoFocus onBlur={() => setEditingId(null)} />
            </form>
          ) : (
            <button
              onClick={() => onSelect(p.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                selectedId === p.id ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-muted'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{p.title}</span>
              <span className="ml-auto flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <span role="button" onClick={e => { e.stopPropagation(); setEditingId(p.id); setEditTitle(p.title); }} className="p-1 rounded hover:bg-secondary">
                  <Pencil className="h-3 w-3" />
                </span>
                <span role="button" onClick={e => { e.stopPropagation(); deletePosition(p.id); if (selectedId === p.id) onSelect(null); }} className="p-1 rounded hover:bg-destructive/10 text-destructive">
                  <Trash2 className="h-3 w-3" />
                </span>
              </span>
            </button>
          )}
        </div>
      ))}

      {filtered.length === 0 && companyId && (
        <p className="text-xs text-muted-foreground px-3 py-2">No positions yet. Add one above.</p>
      )}
    </div>
  );
}
