import { useMemo, useState } from 'react';
import { useATS } from '@/context/ATSContext';
import { Candidate, Stage } from '@/types/ats';
import { Phone, Mail, ChevronRight, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  companyId: string | null;
  positionId: string | null;
  searchQuery: string;
  onOpenDetail: (candidate: Candidate) => void;
}

export function MobileCandidateList({ companyId, positionId, searchQuery, onOpenDetail }: Props) {
  const { candidates, positions, companies, getCompanyStages } = useATS();
  const [stageFilter, setStageFilter] = useState<string | null>(null);

  const stages = useMemo(() => {
    if (companyId) return getCompanyStages(companyId);
    return [];
  }, [companyId, getCompanyStages]);

  const filtered = useMemo(() => {
    let result = candidates;
    if (positionId) {
      result = result.filter(c => c.position_id === positionId);
    } else if (companyId) {
      const posIds = positions.filter(p => p.company_id === companyId).map(p => p.id);
      result = result.filter(c => posIds.includes(c.position_id));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    if (stageFilter) {
      result = result.filter(c => c.stage_id === stageFilter);
    }
    return result;
  }, [candidates, positions, companyId, positionId, searchQuery, stageFilter]);

  const stageMap = useMemo(() => {
    const map = new Map<string, Stage>();
    stages.forEach(s => map.set(s.id, s));
    return map;
  }, [stages]);

  if (!companyId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="rounded-full bg-muted p-4 mb-3">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Select a company</p>
        <p className="text-xs text-muted-foreground mt-1">Choose a company above to see candidates</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Stage filter pills */}
      {stages.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <button
            onClick={() => setStageFilter(null)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !stageFilter
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            All ({filtered.length})
          </button>
          {stages.map(stage => {
            const count = candidates.filter(c => {
              if (positionId) return c.position_id === positionId && c.stage_id === stage.id;
              if (companyId) {
                const posIds = positions.filter(p => p.company_id === companyId).map(p => p.id);
                return posIds.includes(c.position_id) && c.stage_id === stage.id;
              }
              return false;
            }).length;
            return (
              <button
                key={stage.id}
                onClick={() => setStageFilter(stageFilter === stage.id ? null : stage.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  stageFilter === stage.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {stage.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Candidate list */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No candidates found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(candidate => {
            const stage = candidate.stage_id ? stageMap.get(candidate.stage_id) : null;
            const pos = positions.find(p => p.id === candidate.position_id);

            return (
              <button
                key={candidate.id}
                onClick={() => onOpenDetail(candidate)}
                className="w-full text-left bg-card border border-border rounded-xl p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-card-foreground truncate">{candidate.name}</p>
                    {pos && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{pos.title}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {stage && (
                      <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-normal">
                        {stage.label}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                {(candidate.phone || candidate.email) && (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {candidate.phone && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" /> {candidate.phone}
                      </span>
                    )}
                    {candidate.email && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="h-3 w-3" /> {candidate.email}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
