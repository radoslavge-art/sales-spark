import { useMemo } from 'react';
import { useATS } from '@/context/ATSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Users, Briefcase, ArrowRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  positionId: string | null;
}

export function StatsPanel({ open, onOpenChange, companyId, positionId }: Props) {
  const { candidates, positions, getCompanyStages } = useATS();
  const { t } = useLanguage();

  const stages = companyId ? getCompanyStages(companyId) : [];
  const companyPositions = positions.filter(p => p.company_id === companyId);
  const activeCandidates = candidates.filter(c => !c.is_rejected);

  const positionStats = useMemo(() => {
    if (!positionId) return null;
    const posCands = activeCandidates.filter(c => c.position_id === positionId);
    const position = positions.find(p => p.id === positionId);
    const funnel = stages.map(s => ({
      label: s.label,
      count: posCands.filter(c => c.stage_id === s.id).length,
    }));
    const unassigned = posCands.filter(c => !c.stage_id).length;
    return { position, total: posCands.length, funnel, unassigned };
  }, [positionId, activeCandidates, positions, stages]);

  const companyStats = useMemo(() => {
    if (!companyId) return null;
    const posIds = new Set(companyPositions.map(p => p.id));
    const companyCands = activeCandidates.filter(c => posIds.has(c.position_id));

    const HIRED_LABELS = new Set(['hired', 'наети', 'наета', 'нает', 'наето']);
    const INTERVIEW_LABELS = new Set(['interview', 'интервю', 'interviews']);
    const hiredStages = stages.filter(s => HIRED_LABELS.has(s.label.trim().toLowerCase())).map(s => s.id);
    const interviewStages = stages.filter(s => INTERVIEW_LABELS.has(s.label.trim().toLowerCase())).map(s => s.id);

    const rejected = candidates.filter(c => c.is_rejected && posIds.has(c.position_id)).length;

    const funnel = stages.map(s => ({
      label: s.label,
      count: companyCands.filter(c => c.stage_id === s.id).length,
    }));

    return {
      total: companyCands.length,
      interviews: companyCands.filter(c => c.stage_id && interviewStages.includes(c.stage_id)).length,
      hires: companyCands.filter(c => c.stage_id && hiredStages.includes(c.stage_id)).length,
      rejected,
      funnel,
    };
  }, [companyId, companyPositions, activeCandidates, candidates, stages]);

  const comparison = useMemo(() => {
    if (!companyId || companyPositions.length === 0) return [];
    const HIRED_LABELS = new Set(['hired', 'наети', 'наета', 'нает', 'наето']);
    const INTERVIEW_LABELS = new Set(['interview', 'интервю', 'interviews']);
    const hiredStages = new Set(stages.filter(s => HIRED_LABELS.has(s.label.trim().toLowerCase())).map(s => s.id));
    const interviewStages = new Set(stages.filter(s => INTERVIEW_LABELS.has(s.label.trim().toLowerCase())).map(s => s.id));

    return companyPositions.map(pos => {
      const posCands = activeCandidates.filter(c => c.position_id === pos.id);
      const total = posCands.length;
      const interviews = posCands.filter(c => c.stage_id && interviewStages.has(c.stage_id)).length;
      const hires = posCands.filter(c => c.stage_id && hiredStages.has(c.stage_id)).length;
      const conversion = total > 0 ? ((hires / total) * 100).toFixed(1) : '0.0';
      return { title: pos.title, total, interviews, hires, conversion };
    });
  }, [companyId, companyPositions, activeCandidates, stages]);

  const defaultTab = positionId ? 'position' : 'company';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
         <SheetTitle className="text-base">{t('statsPanel.analytics')}</SheetTitle>
        </SheetHeader>

        <Tabs key={`${companyId}-${positionId}`} defaultValue={defaultTab} className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="position" className="flex-1 text-xs" disabled={!positionId}>
              {t('statsPanel.position')}
            </TabsTrigger>
            <TabsTrigger value="company" className="flex-1 text-xs">
              {t('statsPanel.company')}
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex-1 text-xs">
              {t('statsPanel.comparison')}
            </TabsTrigger>
          </TabsList>

          {/* Position Tab */}
          <TabsContent value="position" className="mt-4 space-y-4">
            {positionStats ? (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-primary" />
                   <span className="font-semibold">{positionStats.position?.title}</span>
                   <span className="text-muted-foreground">· {positionStats.total} {t('statsPanel.candidates').toLowerCase()}</span>
                </div>
                <div className="space-y-1.5">
                  {positionStats.funnel.map(s => {
                    const max = Math.max(...positionStats.funnel.map(f => f.count), 1);
                    const width = Math.max((s.count / max) * 100, 8);
                    return (
                      <div key={s.label} className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground w-24 truncate text-right">{s.label}</span>
                        <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                          <div
                            className="h-full bg-primary/20 rounded flex items-center px-2"
                            style={{ width: `${width}%` }}
                          >
                            <span className="text-[10px] font-semibold text-foreground tabular-nums">{s.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {positionStats.unassigned > 0 && (
                    <div className="flex items-center gap-2">
                     <span className="text-[11px] text-muted-foreground/60 w-24 text-right italic">{t('candidate.unassigned')}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums">{positionStats.unassigned}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t('statsPanel.selectPosition')}</p>
            )}
          </TabsContent>

          {/* Company Tab */}
          <TabsContent value="company" className="mt-4 space-y-4">
            {companyStats ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                   {[
                     { label: t('statsPanel.candidates'), value: companyStats.total, icon: Users },
                     { label: t('statsPanel.positions'), value: companyPositions.length, icon: Briefcase },
                     { label: t('statsPanel.interviews'), value: companyStats.interviews },
                     { label: t('statsPanel.hires'), value: companyStats.hires },
                   ].map(item => (
                    <div key={item.label} className="bg-muted/30 border rounded-lg p-3">
                      <span className="text-[11px] text-muted-foreground block mb-1">{item.label}</span>
                      <span className="text-lg font-bold text-foreground tabular-nums">{item.value}</span>
                    </div>
                  ))}
                </div>
                {companyStats.rejected > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {companyStats.rejected} rejected candidate{companyStats.rejected !== 1 ? 's' : ''}
                  </div>
                )}
                {companyStats.funnel.length > 0 && (
                  <div className="border rounded-lg p-3">
                    <span className="text-[11px] font-medium text-muted-foreground mb-2 block">{t('statsPanel.pipeline')}</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {companyStats.funnel.map((s, i) => (
                        <div key={s.label} className="flex items-center gap-1">
                          <div className="text-center">
                            <span className="text-sm font-bold text-foreground block tabular-nums">{s.count}</span>
                            <span className="text-[9px] text-muted-foreground leading-tight block">{s.label}</span>
                          </div>
                          {i < companyStats.funnel.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-0.5" />}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
             ) : (
               <p className="text-sm text-muted-foreground">{t('statsPanel.selectCompany')}</p>
            )}
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="mt-4">
            {comparison.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                 <table className="w-full text-[11px]">
                   <thead>
                     <tr className="bg-muted/30 text-muted-foreground">
                       <th className="text-left py-2 px-3 font-medium">{t('statsPanel.position')}</th>
                       <th className="text-center py-2 px-2 font-medium">{t('statsPanel.cand')}</th>
                       <th className="text-center py-2 px-2 font-medium">{t('statsPanel.interv')}</th>
                       <th className="text-center py-2 px-2 font-medium">{t('statsPanel.hires')}</th>
                       <th className="text-center py-2 px-2 font-medium">{t('statsPanel.convPercent')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.map(row => (
                      <tr key={row.title} className="border-t border-border/50">
                        <td className="py-2 px-3 font-medium text-foreground max-w-[140px] truncate">{row.title}</td>
                        <td className="py-2 px-2 text-center text-foreground tabular-nums">{row.total}</td>
                        <td className="py-2 px-2 text-center text-foreground tabular-nums">{row.interviews}</td>
                        <td className="py-2 px-2 text-center text-foreground tabular-nums">{row.hires}</td>
                        <td className="py-2 px-2 text-center text-foreground tabular-nums">{row.conversion}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('statsPanel.noPositionsToCompare')}</p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
