import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useATS } from '@/context/ATSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Building2, Briefcase, User, Search } from 'lucide-react';

interface Props {
  onSelectCompany: (id: string) => void;
  onSelectPosition: (companyId: string, positionId: string) => void;
  onSelectCandidate: (candidate: { id: string; position_id: string }) => void;
}

export function CommandPalette({ onSelectCompany, onSelectPosition, onSelectCandidate }: Props) {
  const { companies, positions, candidates } = useATS();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const items: { type: 'company' | 'position' | 'candidate'; id: string; label: string; sub: string; data: any }[] = [];

    for (const c of companies) {
      if (c.name.toLowerCase().includes(q)) {
        items.push({ type: 'company', id: c.id, label: c.name, sub: 'Company', data: c });
      }
    }
    for (const p of positions) {
      const company = companies.find(c => c.id === p.company_id);
      if (p.title.toLowerCase().includes(q) || company?.name.toLowerCase().includes(q)) {
        items.push({ type: 'position', id: p.id, label: p.title, sub: company?.name || '', data: p });
      }
    }
    for (const c of candidates) {
      if (
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q)
      ) {
        const pos = positions.find(p => p.id === c.position_id);
        items.push({ type: 'candidate', id: c.id, label: c.name, sub: pos?.title || '', data: c });
      }
    }

    return items.slice(0, 20);
  }, [query, companies, positions, candidates]);

  const select = useCallback((item: typeof results[0]) => {
    setOpen(false);
    if (item.type === 'company') onSelectCompany(item.id);
    else if (item.type === 'position') onSelectPosition(item.data.company_id, item.id);
    else onSelectCandidate(item.data);
  }, [onSelectCompany, onSelectPosition, onSelectCandidate]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIndex]) { e.preventDefault(); select(results[activeIndex]); }
  }, [results, activeIndex, select]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const iconFor = (type: string) => {
    if (type === 'company') return <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />;
    if (type === 'position') return <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />;
    return <User className="h-4 w-4 text-muted-foreground shrink-0" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={() => setOpen(false)}>
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-popover border border-border rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.searchPlaceholder')}
            className="flex-1 py-3.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="text-[10px] font-medium text-muted-foreground/60 border border-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
          {query && results.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('common.noResults')}</p>
          )}
          {!query && (
            <p className="text-sm text-muted-foreground text-center py-8">{t('search.startTyping')}</p>
          )}
          {results.map((item, i) => (
            <button
              key={`${item.type}-${item.id}`}
              data-index={i}
              onClick={() => select(item)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                i === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground'
              }`}
            >
              {iconFor(item.type)}
              <span className="truncate font-medium">{item.label}</span>
              <span className="ml-auto text-xs text-muted-foreground truncate max-w-[140px]">{item.sub}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
