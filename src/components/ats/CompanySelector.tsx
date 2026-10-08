import { useState, useRef, useEffect, useMemo } from 'react';
import { useATS } from '@/context/ATSContext';
import { useAuth } from '@/context/AuthContext';
import { Building2, Plus, Pencil, Trash2, ChevronRight, ArrowDownAZ, ArrowUpZA, Pin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { PositionManager } from './PositionManager';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

import { useSidebarPrefs } from '@/hooks/useSidebarPrefs';
import { useLanguage } from '@/context/LanguageContext';

type SortOrder = 'asc' | 'desc';

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  selectedPositionId: string | null;
  onSelectPosition: (id: string | null) => void;
  isAdmin?: boolean;
  onViewStats?: (positionId: string | null) => void;
}

export function CompanySelector({ selectedId, onSelect, selectedPositionId, onSelectPosition, isAdmin, onViewStats }: Props) {
  const { companies, positions, candidates, addCompany, updateCompany, deleteCompany } = useATS();
  const { user } = useAuth();
  const { pinnedCompanyIds, pinnedPositionIds, isPinned, togglePin, trackRecent, recentItems } = useSidebarPrefs();
  const { t } = useLanguage();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isCompaniesOpen, setIsCompaniesOpen] = useState(false);
  const companyRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; message: string } | null>(null);

  useEffect(() => {
    if (selectedId) {
      setIsCompaniesOpen(true);
      trackRecent(selectedId, 'company');
      if (companyRefs.current[selectedId]) {
        setTimeout(() => {
          companyRefs.current[selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 50);
      }
    }
  }, [selectedId, trackRecent]);

  // Track position selections
  useEffect(() => {
    if (selectedPositionId) {
      trackRecent(selectedPositionId, 'position');
    }
  }, [selectedPositionId, trackRecent]);

  
  // Filter companies and positions by search
  const filteredCompanies = useMemo(() => {
    return [...companies].sort((a, b) =>
      sortOrder === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    );
  }, [companies, sortOrder]);

  // Pinned companies
  const pinnedCompanies = useMemo(() => {
    return filteredCompanies.filter(c => pinnedCompanyIds.includes(c.id));
  }, [filteredCompanies, pinnedCompanyIds]);

  // Unpinned companies
  const unpinnedCompanies = useMemo(() => {
    return filteredCompanies.filter(c => !pinnedCompanyIds.includes(c.id));
  }, [filteredCompanies, pinnedCompanyIds]);

  // Recent items resolved
  const resolvedRecent = useMemo(() => {
    return recentItems
      .map(r => {
        if (r.type === 'company') {
          const c = companies.find(co => co.id === r.id);
          if (!c || pinnedCompanyIds.includes(c.id)) return null;
          return { ...r, label: c.name, parentLabel: undefined };
        } else {
          const p = positions.find(po => po.id === r.id);
          if (!p || pinnedPositionIds.includes(p.id)) return null;
          const c = companies.find(co => co.id === p.company_id);
          return { ...r, label: p.title, parentLabel: c?.name, companyId: p.company_id };
        }
      })
      .filter(Boolean)
      .slice(0, 5) as Array<{ id: string; type: 'company' | 'position'; label: string; parentLabel?: string; companyId?: string }>;
  }, [recentItems, companies, positions, pinnedCompanyIds, pinnedPositionIds]);

  const getPositionCount = (companyId: string) => positions.filter(p => p.company_id === companyId).length;

  const handleAdd = async () => {
    if (!newName.trim()) return;
    const c = await addCompany(newName.trim());
    setNewName('');
    if (c) onSelect(c.id);
  };

  const handleEdit = (id: string) => {
    if (!editName.trim()) {
      setEditingId(null);
      return;
    }
    const original = companies.find(c => c.id === id);
    if (original && editName.trim() !== original.name) {
      updateCompany(id, { name: editName.trim() });
    }
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const company = companies.find(c => c.id === id);
    const posCount = positions.filter(p => p.company_id === id).length;
    const candCount = candidates.filter(c => positions.filter(p => p.company_id === id).map(p => p.id).includes(c.position_id)).length;
    const warning = posCount > 0 || candCount > 0
      ? `This will permanently delete "${company?.name}" along with ${posCount} position(s) and ${candCount} candidate(s). This cannot be undone.`
      : `Delete "${company?.name}"? This cannot be undone.`;
    setDeleteConfirm({ id, message: warning });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    deleteCompany(deleteConfirm.id);
    if (selectedId === deleteConfirm.id) onSelect(null);
    setDeleteConfirm(null);
  };

  const handleSelectCompany = (id: string) => {
    onSelect(id);
  };

  const handleRecentClick = (item: { id: string; type: string; companyId?: string }) => {
    if (item.type === 'company') {
      onSelect(item.id);
    } else {
      if (item.companyId) onSelect(item.companyId);
      onSelectPosition(item.id);
    }
  };

  const renderCompanyRow = (c: typeof companies[0]) => {
    const count = getPositionCount(c.id);
    const isActive = selectedId === c.id;
    const pinned = isPinned(c.id);
    const canDelete = isAdmin || c.created_by === user?.id;

    return (
      <div key={c.id} className="group/company" ref={el => { companyRefs.current[c.id] = el; }}>
        {editingId === c.id ? (
          <form onSubmit={e => { e.preventDefault(); handleEdit(c.id); }} className="flex gap-1 px-2">
            <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" autoFocus onBlur={() => handleEdit(c.id)} />
          </form>
        ) : (
          <button
            onClick={() => handleSelectCompany(c.id)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm transition-all duration-150 group/row ${
              isActive
                ? 'bg-primary/10 text-primary font-bold shadow-sm ring-1 ring-primary/20'
                : 'hover:bg-muted/70 hover:border-l-2 hover:border-primary/30 hover:pl-2 text-foreground/80'
            }`}
          >
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${isActive ? 'rotate-90 text-primary' : 'text-muted-foreground/50'}`} />
            <span className="text-left leading-snug line-clamp-2 break-words">
              <span className="font-semibold">{c.name}</span>
            </span>
            <span className="ml-auto flex items-center gap-1 shrink-0">
              {count > 0 && (isActive ? (
                <span className="text-[11px] font-medium text-muted-foreground bg-muted/80 rounded-md px-2 py-0.5 min-w-[1.5rem] text-center">{count}</span>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground bg-muted/80 rounded-md px-2 py-0.5 min-w-[1.5rem] text-center opacity-0 group-hover/row:opacity-100 transition-opacity">{count}</span>
              ))}
              <span className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); togglePin(c.id, 'company'); }}
                  className={`p-1 rounded hover:bg-secondary cursor-pointer ${pinned ? 'text-primary opacity-100' : ''}`}
                  title={pinned ? 'Unpin' : 'Pin'}
                >
                  <Pin className="h-3 w-3" />
                </span>
                <span role="button" onClick={e => { e.stopPropagation(); setEditingId(c.id); setEditName(c.name); }} className="p-1 rounded hover:bg-secondary cursor-pointer">
                  <Pencil className="h-3 w-3" />
                </span>
                {canDelete && (
                  <span role="button" onClick={e => { e.stopPropagation(); handleDelete(c.id); }} className="p-1 rounded hover:bg-destructive/10 text-destructive cursor-pointer">
                    <Trash2 className="h-3 w-3" />
                  </span>
                )}
              </span>
            </span>
          </button>
        )}
        {isActive && (
          <div className="ml-4 mt-2 mb-2 space-y-1 border-l-2 border-border pl-2">
            <PositionManager
              companyId={c.id}
              selectedPositionId={selectedPositionId}
              onSelectPosition={onSelectPosition}
              onViewStats={onViewStats}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">

      {pinnedCompanies.length > 0 && (
        <div className="mb-2">
          <div className="flex items-center gap-1.5 px-2 mb-1.5">
            <Pin className="h-3 w-3 text-primary/60" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">{t('company.pinned')}</span>
          </div>
          <div className="space-y-1.5 px-0.5">
            {pinnedCompanies.map(c => renderCompanyRow(c))}
          </div>
        </div>
      )}


      {/* Companies header */}
      <div className="flex items-center justify-between px-2 mb-2 mt-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">{t('company.allCompanies')}</span>
        <span className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
            onClick={() => setSortOrder(s => s === 'asc' ? 'desc' : 'asc')}
            title={sortOrder === 'asc' ? 'Sorted A–Z' : 'Sorted Z–A'}
          >
            {sortOrder === 'asc' ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpZA className="h-3.5 w-3.5" />}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/60 hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t('company.addCompany')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={e => { e.preventDefault(); handleAdd(); setDialogOpen(false); }} className="flex gap-2">
                <Input placeholder={t('company.companyName')} value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
                <Button type="submit" disabled={!newName.trim()}>{t('common.add')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </span>
      </div>

      {/* All Companies toggle */}
      <button
          onClick={() => setIsCompaniesOpen(prev => !prev)}
          className="w-full flex items-center gap-2.5 px-3 py-3 rounded-lg text-sm transition-all duration-150 hover:bg-muted/60"
        >
          <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground ${isCompaniesOpen ? 'rotate-90' : ''}`} />
          <Building2 className="h-4.5 w-4.5 shrink-0 text-primary" />
          <span className="text-base font-bold text-foreground">{t('company.allCompanies')}</span>
          <span className="ml-auto text-[11px] font-medium text-muted-foreground bg-muted/80 rounded-md px-2 py-0.5 min-w-[1.5rem] text-center">
            {companies.length}
          </span>
        </button>

      {/* Company list */}
      {isCompaniesOpen && (
        <div className="mt-2 space-y-1.5 ml-3 border-l-2 border-border pl-1.5">
          {unpinnedCompanies.map(c => renderCompanyRow(c))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title={t('company.deleteCompany')}
        description={deleteConfirm?.message || ''}
        confirmLabel={t('common.delete')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
