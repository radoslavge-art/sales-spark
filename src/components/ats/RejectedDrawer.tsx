import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useATS } from '@/context/ATSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { RotateCcw, Phone, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Candidate } from '@/types/ats';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId?: string | null;
}

export const RejectedDrawer = memo(function RejectedDrawer({ open, onOpenChange, companyId }: Props) {
  const { positions, companies, restoreCandidate } = useATS();
  const { t } = useLanguage();
  const [rejected, setRejected] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);

  const scopedPositionIds = useMemo(() => {
    if (!companyId) return null;
    return positions.filter(p => p.company_id === companyId).map(p => p.id);
  }, [companyId, positions]);

  useEffect(() => {
    if (!open) return;

    const loadRejected = async () => {
      setLoading(true);
      let query = supabase.from('candidates').select('*').eq('is_rejected', true).is('deleted_at', null).order('created_at', { ascending: false });

      if (scopedPositionIds && scopedPositionIds.length > 0) {
        query = query.in('position_id', scopedPositionIds);
      } else if (companyId) {
        setRejected([]);
        setLoading(false);
        return;
      }

      const { data } = await query;
      setRejected((data || []) as Candidate[]);
      setLoading(false);
    };

    loadRejected();
  }, [open, companyId, scopedPositionIds]);

  const groupedRejected = useMemo(() => {
    const groups = new Map<string, Candidate[]>();
    rejected.forEach(candidate => {
      const pos = positions.find(p => p.id === candidate.position_id);
      const key = pos?.title || 'Unknown Position';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(candidate);
    });
    return Array.from(groups.entries());
  }, [rejected, positions]);

  const handleRestore = useCallback(async (id: string) => {
    await restoreCandidate(id);
    setRejected(prev => prev.filter(candidate => candidate.id !== id));
  }, [restoreCandidate]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[440px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {t('candidate.rejectedCandidates')}
            <span className="text-xs font-normal text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {rejected.length}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto mt-4 space-y-4">
          {loading && (
            <p className="text-sm text-muted-foreground text-center py-12">{t('candidate.loadingRejected')}</p>
          )}

          {!loading && rejected.length === 0 && (
           <p className="text-sm text-muted-foreground text-center py-12">
              {t('candidate.noRejectedCandidates')}
            </p>
          )}

          {!loading && groupedRejected.map(([positionTitle, candidates]) => (
            <div key={positionTitle} className="space-y-2">
              <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  {positionTitle}
                </p>
              </div>
              {candidates.map(c => {
                const pos = positions.find(p => p.id === c.position_id);
                const comp = pos ? companies.find(co => co.id === pos.company_id) : null;
                return (
                  <div
                    key={c.id}
                    className="border rounded-lg p-3 flex items-start justify-between gap-3 bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                      {pos && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {pos.title}{comp ? ` · ${comp.name}` : ''}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        Rejected {formatDistanceToNow(new Date((c as any).rejected_at || c.created_at), { addSuffix: true })}
                      </p>
                      {c.phone && (
                        <div className="flex items-center gap-1 mt-1.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-1 mt-1">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground truncate">{c.email}</span>
                        </div>
                      )}
                      {c.notes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{c.notes.substring(0, 60)}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 gap-1.5 text-xs h-7 hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleRestore(c.id)}
                    >
                      <RotateCcw className="h-3 w-3" />
                      {t('candidate.restore')}
                    </Button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
});