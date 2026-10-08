import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useATS } from '@/context/ATSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Building2, Briefcase, User, Search, XCircle, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Candidate } from '@/types/ats';
import { supabase } from '@/integrations/supabase/client';

type SearchScope = 'all' | 'position';
type SearchFilter = 'all' | 'companies' | 'positions' | 'candidates';

interface SearchResult {
  type: 'company' | 'position' | 'candidate'; id: string; label: string; sub: string;
  inCurrentPosition: boolean; inCurrentCompany: boolean; data: any;
  isRejected?: boolean; tags?: string[]; cvMatch?: boolean;
}

interface Props {
  selectedCompany: string | null; selectedPosition: string | null;
  onSelectCompany: (id: string) => void; onSelectPosition: (companyId: string, positionId: string) => void;
  onSelectCandidate: (candidate: Candidate) => void; onLocalFilterChange: (query: string) => void;
}

export function GlobalSearchDropdown({ selectedCompany, selectedPosition, onSelectCompany, onSelectPosition, onSelectCandidate, onLocalFilterChange }: Props) {
  const { companies, positions, allCandidates } = useATS();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [scope, setScope] = useState<SearchScope>('all');
  const [filter, setFilter] = useState<SearchFilter>('all');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cvMatchIds, setCvMatchIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); if (query.trim()) setOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [query]);

  useEffect(() => { const t = setTimeout(() => setDebouncedQuery(query), 200); return () => clearTimeout(t); }, [query]);
  useEffect(() => { onLocalFilterChange(scope === 'position' ? query : ''); }, [query, scope, onLocalFilterChange]);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search CV text in database
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q || q.length < 2) { setCvMatchIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      const { data } = await (supabase.from('candidate_attachments') as any)
        .select('candidate_id')
        .is('deleted_at', null)
        .ilike('cv_text', `%${q}%`)
        .limit(50);
      if (!cancelled && data) {
        setCvMatchIds(new Set(data.map((r: any) => r.candidate_id)));
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const results = useMemo(() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) return [];
    if (scope === 'position') {
      const items: SearchResult[] = [];
      const pool = selectedPosition ? allCandidates.filter(c => c.position_id === selectedPosition) : selectedCompany ? allCandidates.filter(c => { const pos = positions.find(p => p.id === c.position_id); return pos?.company_id === selectedCompany; }) : allCandidates;
      for (const c of pool) {
        const tagMatch = c.tags?.some(tag => tag.toLowerCase().includes(q));
        const fieldMatch = c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || tagMatch;
        const cvMatch = cvMatchIds.has(c.id);
        if (fieldMatch || cvMatch) {
          const pos = positions.find(p => p.id === c.position_id);
          items.push({ type: 'candidate', id: c.id, label: c.name, sub: pos?.title || '', inCurrentPosition: c.position_id === selectedPosition, inCurrentCompany: pos?.company_id === selectedCompany, data: c, isRejected: c.is_rejected, tags: c.tags, cvMatch: cvMatch && !fieldMatch });
        }
      }
      return items.slice(0, 20);
    }
    const items: SearchResult[] = [];
    for (const c of companies) { if (c.name.toLowerCase().includes(q)) items.push({ type: 'company', id: c.id, label: c.name, sub: `${positions.filter(p => p.company_id === c.id).length} ${t('search.positions').toLowerCase()}`, inCurrentPosition: false, inCurrentCompany: c.id === selectedCompany, data: c }); }
    for (const p of positions) { const company = companies.find(c => c.id === p.company_id); if (p.title.toLowerCase().includes(q) || company?.name.toLowerCase().includes(q)) items.push({ type: 'position', id: p.id, label: p.title, sub: company?.name || '', inCurrentPosition: p.id === selectedPosition, inCurrentCompany: p.company_id === selectedCompany, data: p }); }
    for (const c of allCandidates) {
      const tagMatch = c.tags?.some(tag => tag.toLowerCase().includes(q));
      const fieldMatch = c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q) || tagMatch;
      const cvMatch = cvMatchIds.has(c.id);
      if (fieldMatch || cvMatch) {
        const pos = positions.find(p => p.id === c.position_id);
        items.push({ type: 'candidate', id: c.id, label: c.name, sub: pos?.title || '', inCurrentPosition: c.position_id === selectedPosition, inCurrentCompany: pos?.company_id === selectedCompany, data: c, isRejected: c.is_rejected, tags: c.tags, cvMatch: cvMatch && !fieldMatch });
      }
    }
    return items.slice(0, 30);
  }, [debouncedQuery, scope, companies, positions, allCandidates, selectedCompany, selectedPosition, t, cvMatchIds]);

  const grouped = useMemo(() => {
    const groups: { type: 'company' | 'position' | 'candidate'; label: string; items: SearchResult[] }[] = [];
    const companyItems = results.filter(r => r.type === 'company');
    const positionItems = results.filter(r => r.type === 'position');
    const candidateItems = results.filter(r => r.type === 'candidate');
    if ((filter === 'all' || filter === 'companies') && companyItems.length) groups.push({ type: 'company', label: t('search.companies'), items: companyItems });
    if ((filter === 'all' || filter === 'positions') && positionItems.length) groups.push({ type: 'position', label: t('search.positions'), items: positionItems });
    if ((filter === 'all' || filter === 'candidates') && candidateItems.length) groups.push({ type: 'candidate', label: t('search.candidates'), items: candidateItems });
    return groups;
  }, [results, filter, t]);

  const flatResults = useMemo(() => grouped.flatMap(g => g.items), [grouped]);
  const indexedGroups = useMemo(() => { let idx = 0; return grouped.map(group => ({ ...group, items: group.items.map(item => ({ ...item, flatIndex: idx++ })) })); }, [grouped]);

  const select = useCallback((item: SearchResult) => { setOpen(false); setQuery(''); if (item.type === 'company') onSelectCompany(item.id); else if (item.type === 'position') onSelectPosition(item.data.company_id, item.id); else onSelectCandidate(item.data); }, [onSelectCompany, onSelectPosition, onSelectCandidate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!open || flatResults.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, flatResults.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flatResults[activeIndex]) { e.preventDefault(); select(flatResults[activeIndex]); }
  }, [open, flatResults, activeIndex, select]);

  useEffect(() => { setActiveIndex(0); }, [debouncedQuery]);
  useEffect(() => { const el = dropdownRef.current?.querySelector(`[data-idx="${activeIndex}"]`); el?.scrollIntoView({ block: 'nearest' }); }, [activeIndex]);

  const iconFor = (type: string) => {
    if (type === 'company') return <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    if (type === 'position') return <Briefcase className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    return <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
  };

  const showDropdown = open && debouncedQuery.trim().length > 0;

  return (
    <div ref={containerRef} className="relative flex-1">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); if (e.target.value.trim()) setOpen(true); }}
        onFocus={() => { if (query.trim()) setOpen(true); }}
        onKeyDown={handleKeyDown}
        placeholder={t('search.searchPlaceholder')}
        data-global-search
        className="flex h-10 w-full rounded-lg border border-input bg-background pl-10 pr-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />

      {showDropdown && (
        <div ref={dropdownRef} className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50">
          <div className="flex items-center gap-1 px-2 pt-2 pb-1 border-b border-border/50">
            {([['all', t('search.filterAll')], ['companies', t('search.filterCompanies')], ['positions', t('search.filterPositions')], ['candidates', t('search.filterCandidates')]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key as SearchFilter)} className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors ${filter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {flatResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">{t('common.noResults')}</p>
            )}
            {indexedGroups.map(group => (
              <div key={group.type}>
                <div className="px-3 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{group.label}</div>
                {group.items.map(item => (
                  <button key={`${item.type}-${item.id}`} data-idx={item.flatIndex} onClick={() => select(item)} onMouseEnter={() => setActiveIndex(item.flatIndex)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${item.flatIndex === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground'}`}>
                    {iconFor(item.type)}
                    <span className="truncate font-medium">{item.label}</span>
                    {item.cvMatch && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 gap-0.5 border-primary/30 text-primary">
                        <FileText className="h-2.5 w-2.5" />
                        CV
                      </Badge>
                    )}
                    {item.isRejected && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4 shrink-0 gap-0.5">
                        <XCircle className="h-2.5 w-2.5" />
                        Rejected
                      </Badge>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        {item.tags.slice(0, 2).map(tag => (
                          <Badge key={tag} variant="outline" className="text-[9px] px-1 py-0 h-3.5 shrink-0">
                            {tag}
                          </Badge>
                        ))}
                        {item.tags.length > 2 && (
                          <span className="text-[9px] text-muted-foreground">+{item.tags.length - 2}</span>
                        )}
                      </div>
                    )}
                    {(item.inCurrentPosition || item.inCurrentCompany) && !item.isRejected && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                        {item.inCurrentPosition ? t('search.currentPosition') : t('search.currentCompany')}
                      </Badge>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[120px]">{item.sub}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}