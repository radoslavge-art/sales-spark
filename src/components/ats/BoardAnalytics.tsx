import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useATS } from '@/context/ATSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ArrowRight, Users, TrendingUp, BarChart3 } from 'lucide-react';

interface ColumnStats {
  id: string;
  label: string;
  color: string;
  total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardName: string;
}

export function BoardAnalytics({ open, onOpenChange, boardId, boardName }: Props) {
  const { candidates, positions, companies } = useATS();
  const { t } = useLanguage();
  const [columns, setColumns] = useState<{ id: string; label: string; color: string; sort_order: number }[]>([]);
  const [tasks, setTasks] = useState<{ id: string; column_id: string | null; card_type: string; candidate_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !boardId) return;
    (async () => {
      setLoading(true);
      const [colRes, taskRes] = await Promise.all([
        supabase.from('board_columns').select('id, label, color, sort_order').eq('board_id', boardId).is('deleted_at', null).order('sort_order'),
        supabase.from('board_tasks').select('id, column_id, card_type, candidate_id').eq('board_id', boardId).is('deleted_at', null),
      ]);
      setColumns((colRes.data || []) as any);
      setTasks((taskRes.data || []) as any);
      setLoading(false);
    })();
  }, [open, boardId]);

  const stats = useMemo(() => {
    const columnStats: ColumnStats[] = columns.map(col => ({
      id: col.id,
      label: col.label,
      color: col.color,
      total: tasks.filter(t => t.column_id === col.id).length,
    }));

    const totalCards = tasks.length;
    const totalCandidates = tasks.filter(t => t.card_type === 'candidate').length;
    const totalTasks = tasks.filter(t => t.card_type === 'task').length;
    const unassigned = tasks.filter(t => !t.column_id).length;

    const conversions: { from: string; to: string; rate: string }[] = [];
    for (let i = 0; i < columnStats.length - 1; i++) {
      const from = columnStats[i];
      const to = columnStats[i + 1];
      const fromTotal = columnStats.slice(i).reduce((s, c) => s + c.total, 0);
      const toTotal = columnStats.slice(i + 1).reduce((s, c) => s + c.total, 0);
      const rate = fromTotal > 0 ? ((toTotal / fromTotal) * 100).toFixed(1) : '0.0';
      conversions.push({ from: from.label, to: to.label, rate });
    }

    return { columnStats, totalCards, totalCandidates, totalTasks, unassigned, conversions };
  }, [columns, tasks]);

  const maxCount = Math.max(...stats.columnStats.map(c => c.total), 1);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            {t('boardAnalytics.title')}
          </SheetTitle>
          <p className="text-xs text-muted-foreground">{boardName}</p>
        </SheetHeader>

        {loading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">{t('boardAnalytics.loading')}</div>
        ) : (
          <div className="mt-4 space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: t('boardAnalytics.total'), value: stats.totalCards, icon: Users },
                { label: t('boardAnalytics.candidates'), value: stats.totalCandidates, icon: Users },
                { label: t('boardAnalytics.tasks'), value: stats.totalTasks, icon: TrendingUp },
              ].map(item => (
                <div key={item.label} className="bg-muted/30 border border-border rounded-lg p-3 text-center">
                  <span className="text-[11px] text-muted-foreground block mb-1">{item.label}</span>
                  <span className="text-lg font-bold text-foreground tabular-nums">{item.value}</span>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('boardAnalytics.pipeline')}</h3>
              <div className="space-y-1.5">
                {stats.columnStats.map(col => {
                  const width = Math.max((col.total / maxCount) * 100, 8);
                  return (
                    <div key={col.id} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-24 truncate text-right">{col.label}</span>
                      <div className="flex-1 h-6 bg-muted/40 rounded overflow-hidden">
                        <div
                          className="h-full bg-primary/20 rounded flex items-center px-2"
                          style={{ width: `${width}%` }}
                        >
                          <span className="text-[10px] font-semibold text-foreground tabular-nums">{col.total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {stats.unassigned > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground/60 w-24 text-right italic">{t('boardAnalytics.unassigned')}</span>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{stats.unassigned}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border border-border rounded-lg p-3">
              <span className="text-[11px] font-medium text-muted-foreground mb-2 block">{t('boardAnalytics.flow')}</span>
              <div className="flex items-center gap-1 flex-wrap">
                {stats.columnStats.map((col, i) => (
                  <div key={col.id} className="flex items-center gap-1">
                    <div className="text-center">
                      <span className="text-sm font-bold text-foreground block tabular-nums">{col.total}</span>
                      <span className="text-[9px] text-muted-foreground leading-tight block">{col.label}</span>
                    </div>
                    {i < stats.columnStats.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-0.5" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {stats.conversions.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">{t('boardAnalytics.conversionRates')}</h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="bg-muted/30 text-muted-foreground">
                        <th className="text-left py-2 px-3 font-medium">{t('boardAnalytics.stage')}</th>
                        <th className="text-center py-2 px-2 font-medium">→</th>
                        <th className="text-left py-2 px-2 font-medium">{t('boardAnalytics.nextStage')}</th>
                        <th className="text-right py-2 px-3 font-medium">{t('boardAnalytics.rate')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.conversions.map((conv, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-2 px-3 text-foreground">{conv.from}</td>
                          <td className="py-2 px-2 text-center text-muted-foreground/40">→</td>
                          <td className="py-2 px-2 text-foreground">{conv.to}</td>
                          <td className="py-2 px-3 text-right text-foreground tabular-nums font-medium">{conv.rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
