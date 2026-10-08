import { useMemo } from 'react';
import { useATS } from '@/context/ATSContext';
import { Users, Briefcase, ArrowRight } from 'lucide-react';

interface Props {
  companyId: string;
  positionId: string | null;
  onClose: () => void;
}

export function ContextualStats({ companyId, positionId, onClose }: Props) {
  const { candidates, positions, getCompanyStages } = useATS();

  const stages = getCompanyStages(companyId);
  const companyPositions = positions.filter(p => p.company_id === companyId);

  // Position-level stats
  if (positionId) {
    const posCandidates = candidates.filter(c => c.position_id === positionId);
    const position = positions.find(p => p.id === positionId);

    const funnel = stages.map(s => ({
      label: s.label,
      color: s.color,
      count: posCandidates.filter(c => c.stage_id === s.id).length,
    }));

    const unassigned = posCandidates.filter(c => !c.stage_id).length;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Stats: {position?.title}
          </h3>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Close
          </button>
        </div>

        <div className="bg-card border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">
              {posCandidates.length} candidate{posCandidates.length !== 1 ? 's' : ''} total
            </span>
          </div>

          {/* Funnel */}
          <div className="space-y-1.5">
            {funnel.map((s, i) => {
              const maxCount = Math.max(...funnel.map(f => f.count), 1);
              const width = Math.max((s.count / maxCount) * 100, 8);
              return (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground w-20 truncate text-right">{s.label}</span>
                  <div className="flex-1 h-5 bg-muted/40 rounded overflow-hidden">
                    <div
                      className="h-full bg-primary/20 rounded flex items-center px-2 transition-all"
                      style={{ width: `${width}%` }}
                    >
                      <span className="text-[10px] font-semibold text-foreground">{s.count}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {unassigned > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground/60 w-20 truncate text-right italic">Unassigned</span>
                <span className="text-[10px] text-muted-foreground">{unassigned}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Company-level stats
  const totalCandidates = candidates.filter(c =>
    companyPositions.some(p => p.id === c.position_id)
  ).length;

  const funnel = stages.map(s => ({
    label: s.label,
    color: s.color,
    count: candidates.filter(c =>
      companyPositions.some(p => p.id === c.position_id) && c.stage_id === s.id
    ).length,
  }));

  // Comparison table
  const comparison = companyPositions.map(pos => {
    const posCandidates = candidates.filter(c => c.position_id === pos.id);
    const interviewStages = stages.filter(s => s.label.toLowerCase().includes('interview')).map(s => s.id);
    const offerStages = stages.filter(s => s.label.toLowerCase().includes('offer')).map(s => s.id);

    return {
      title: pos.title,
      total: posCandidates.length,
      interview: posCandidates.filter(c => c.stage_id && interviewStages.includes(c.stage_id)).length,
      offer: posCandidates.filter(c => c.stage_id && offerStages.includes(c.stage_id)).length,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Company Stats</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Close
        </button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Briefcase className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] text-muted-foreground">Positions</span>
          </div>
          <span className="text-lg font-bold text-foreground">{companyPositions.length}</span>
        </div>
        <div className="bg-card border rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] text-muted-foreground">Candidates</span>
          </div>
          <span className="text-lg font-bold text-foreground">{totalCandidates}</span>
        </div>
      </div>

      {/* Funnel */}
      {funnel.length > 0 && (
        <div className="bg-card border rounded-lg p-3">
          <span className="text-[11px] font-medium text-muted-foreground mb-2 block">Funnel Overview</span>
          <div className="flex items-center gap-1">
            {funnel.map((s, i) => (
              <div key={s.label} className="flex items-center gap-1">
                <div className="text-center">
                  <span className="text-sm font-bold text-foreground block">{s.count}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight block">{s.label}</span>
                </div>
                {i < funnel.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground/30 mx-0.5" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Compare Positions */}
      {comparison.length > 1 && (
        <div className="bg-card border rounded-lg p-3">
          <span className="text-[11px] font-medium text-muted-foreground mb-2 block">Compare Positions</span>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-muted-foreground border-b">
                <th className="text-left py-1 font-medium">Position</th>
                <th className="text-center py-1 font-medium">Total</th>
                <th className="text-center py-1 font-medium">Interview</th>
                <th className="text-center py-1 font-medium">Offer</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map(row => (
                <tr key={row.title} className="border-b last:border-0">
                  <td className="py-1.5 font-medium text-foreground truncate max-w-[120px]">{row.title}</td>
                  <td className="py-1.5 text-center text-foreground">{row.total}</td>
                  <td className="py-1.5 text-center text-foreground">{row.interview}</td>
                  <td className="py-1.5 text-center text-foreground">{row.offer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
