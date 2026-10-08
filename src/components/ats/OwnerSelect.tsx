import { useState, useRef } from 'react';
import { useATS } from '@/context/ATSContext';
import { Plus } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  value: string | null;
  onValueChange: (value: string | null) => void;
}

export function OwnerSelect({ value, onValueChange }: Props) {
  const { owners, addOwner } = useATS();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = async (e: React.MouseEvent | React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!newName.trim()) return;
    const owner = await addOwner(newName.trim());
    if (owner) {
      onValueChange(owner.id);
      setNewName('');
      setAdding(false);
    }
  };

  return (
    <Select value={value ?? 'none'} onValueChange={v => onValueChange(v === 'none' ? null : v)}>
      <SelectTrigger>
        <SelectValue placeholder="Select owner" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">No owner</SelectItem>
        {owners.map(o => (
          <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
        ))}
        <div className="border-t border-border mt-1 pt-1 px-1 pb-1">
          {adding ? (
            <div className="flex gap-1.5 items-center" onPointerDown={e => e.stopPropagation()}>
              <Input
                ref={inputRef}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="Owner name"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleAdd(e);
                  if (e.key === 'Escape') { setAdding(false); setNewName(''); }
                }}
              />
              <Button size="sm" className="h-8 px-2.5" onClick={handleAdd} disabled={!newName.trim()}>Add</Button>
            </div>
          ) : (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onPointerDown={e => {
                e.preventDefault();
                e.stopPropagation();
                setAdding(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> New Owner
            </button>
          )}
        </div>
      </SelectContent>
    </Select>
  );
}
