import { useMemo } from 'react';
import { useATS } from '@/context/ATSContext';
import { Users, Building2, Briefcase } from 'lucide-react';

export function Dashboard() {
  const { candidates, companies, positions } = useATS();

  const statCards = [
    { label: 'Total Candidates', value: candidates.length, icon: Users, color: 'text-primary' },
    { label: 'Companies', value: companies.length, icon: Building2, color: 'text-amber-500' },
    { label: 'Open Positions', value: positions.length, icon: Briefcase, color: 'text-purple-500' },
  ];

  const stageCounts = useMemo(() => {
    const counts: { label: string; count: number; color: string }[] = [];
    const seen = new Map<string, number>();
    companies.forEach(c => {
      c.stages.forEach(s => {
        const candidatesInStage = candidates.filter(cand => cand.stage_id === s.id).length;
        if (seen.has(s.label)) {
          counts[seen.get(s.label)!].count += candidatesInStage;
        } else {
          seen.set(s.label, counts.length);
          counts.push({ label: s.label, count: candidatesInStage, color: s.color });
        }
      });
    });
    return counts;
  }, [candidates, companies]);

  const recent = useMemo(() =>
    [...candidates].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5),
    [candidates]
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 mb-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
            </div>
            <span className="text-2xl font-bold text-card-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      {stageCounts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stageCounts.map(s => (
            <div key={s.label} className="bg-card rounded-lg border p-3 text-center">
              <span className="text-lg font-bold text-card-foreground">{s.count}</span>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {recent.length > 0 && (
        <div className="bg-card rounded-lg border p-4">
          <h3 className="text-sm font-semibold mb-3">Recently Added</h3>
          <div className="space-y-2">
            {recent.map(c => {
              const pos = positions.find(p => p.id === c.position_id);
              const company = pos ? companies.find(co => co.id === pos.company_id) : null;
              const stage = company?.stages.find(s => s.id === c.stage_id);
              return (
                <div key={c.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{stage?.label ?? '—'}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
