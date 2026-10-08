import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useATS } from '@/context/ATSContext';
import { Plus, ChevronRight, Trash2, Users, X, Phone, Mail, CheckCircle2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface PersonalColumn {
  id: string;
  user_id: string;
  label: string;
  sort_order: number;
}

interface PersonalTask {
  id: string;
  user_id: string;
  column_id: string | null;
  title: string;
  notes: string;
  candidate_id: string | null;
  sort_order: number;
  card_type?: string;
}

type CardTypeFilter = 'all' | 'candidate' | 'task';

const DEFAULT_COLUMNS = ['To Review', 'Call', 'Waiting', 'Done'];

export function MobileMyBoard() {
  const { user } = useAuth();
  const { candidates, positions, companies, getCompanyStages } = useATS();
  const [columns, setColumns] = useState<PersonalColumn[]>([]);
  const [tasks, setTasks] = useState<PersonalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState('');
  const [quickAddValue, setQuickAddValue] = useState('');
  const [filterCardType, setFilterCardType] = useState<CardTypeFilter>('all');

  const fetchData = useCallback(async () => {
    if (!user) return;
    const [colRes, taskRes] = await Promise.all([
      supabase.from('personal_columns').select('*').eq('user_id', user.id).is('deleted_at', null).order('sort_order') as any,
      supabase.from('personal_tasks').select('*').eq('user_id', user.id).is('deleted_at', null).order('sort_order') as any,
    ]);

    let cols = (colRes.data || []) as PersonalColumn[];
    if (cols.length === 0) {
      const inserts = DEFAULT_COLUMNS.map((label, i) => ({
        user_id: user.id, label, sort_order: i,
      }));
      const { data } = await (supabase.from('personal_columns').insert(inserts).select() as any);
      cols = (data || []) as PersonalColumn[];
    }

    setColumns(cols);
    setTasks((taskRes.data || []) as PersonalTask[]);
    setLoading(false);
    if (!activeColumn && cols.length > 0) setActiveColumn(cols[0].id);
  }, [user, activeColumn]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const boardCandidateIds = useMemo(() =>
    new Set(tasks.filter(t => t.candidate_id).map(t => t.candidate_id!)),
    [tasks]
  );

  const filteredCandidates = useMemo(() => {
    const q = candidateSearch.toLowerCase();
    return candidates
      .filter(c => !boardCandidateIds.has(c.id))
      .filter(c => !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
      .slice(0, 20);
  }, [candidates, boardCandidateIds, candidateSearch]);

  const currentTasks = useMemo(() => {
    if (!activeColumn) return [];
    let result = tasks.filter(t => t.column_id === activeColumn).sort((a, b) => a.sort_order - b.sort_order);
    if (filterCardType !== 'all') {
      result = result.filter(t => {
        const type = t.card_type || (t.candidate_id ? 'candidate' : 'task');
        return type === filterCardType;
      });
    }
    return result;
  }, [tasks, activeColumn, filterCardType]);

  const getCandidateInfo = useCallback((candidateId: string) => {
    const c = candidates.find(cd => cd.id === candidateId);
    if (!c) return null;
    const pos = positions.find(p => p.id === c.position_id);
    const company = pos ? companies.find(co => co.id === pos.company_id) : null;
    const stgs = company ? getCompanyStages(company.id) : [];
    const stage = stgs.find(s => s.id === c.stage_id);
    return { candidate: c, position: pos, company, stage };
  }, [candidates, positions, companies, getCompanyStages]);

  const handleAddCandidateToBoard = async (candidateId: string) => {
    if (!user || !activeColumn) return;
    const candidate = candidates.find(c => c.id === candidateId);
    if (!candidate) return;
    await (supabase.from('personal_tasks').insert({
      user_id: user.id, column_id: activeColumn, title: candidate.name,
      candidate_id: candidateId, sort_order: Date.now(), card_type: 'candidate',
    }) as any);
    setAddCandidateOpen(false);
    setCandidateSearch('');
    fetchData();
    toast.success(`${candidate.name} added`);
  };

  const handleQuickAdd = async () => {
    const title = quickAddValue.trim();
    if (!title || !user || !activeColumn) return;
    await (supabase.from('personal_tasks').insert({
      user_id: user.id, column_id: activeColumn, title,
      sort_order: Date.now(), card_type: 'task',
    }) as any);
    setQuickAddValue('');
    fetchData();
  };

  const handleDeleteTask = async (id: string) => {
    await (supabase.from('personal_tasks').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).eq('id', id) as any);
    fetchData();
  };

  const handleMoveTask = async (taskId: string, direction: 'left' | 'right') => {
    const colIdx = columns.findIndex(c => c.id === activeColumn);
    const newIdx = direction === 'right' ? colIdx + 1 : colIdx - 1;
    if (newIdx < 0 || newIdx >= columns.length) return;
    const newColId = columns[newIdx].id;
    await (supabase.from('personal_tasks').update({ column_id: newColId }).eq('id', taskId) as any);
    fetchData();
    toast.success(`Moved to ${columns[newIdx].label}`);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><span className="text-sm text-muted-foreground">Loading...</span></div>;
  }

  const activeColumnIndex = columns.findIndex(c => c.id === activeColumn);

  return (
    <div className="flex flex-col gap-3">
      {/* Column tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {columns.map(col => {
          const count = tasks.filter(t => t.column_id === col.id).length;
          return (
            <button
              key={col.id}
              onClick={() => setActiveColumn(col.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                activeColumn === col.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {col.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Card type filter */}
      <div className="flex gap-1.5">
        {(['all', 'candidate', 'task'] as const).map(type => (
          <button
            key={type}
            onClick={() => setFilterCardType(type)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              filterCardType === type
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {type === 'all' ? 'All' : type === 'candidate' ? 'Candidates' : 'Tasks'}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <form onSubmit={e => { e.preventDefault(); handleQuickAdd(); }} className="flex-1 flex gap-2">
          <Input
            placeholder="Task title..."
            value={quickAddValue}
            onChange={e => setQuickAddValue(e.target.value)}
            className="h-10 text-sm"
          />
          <Button type="submit" variant="outline" size="icon" className="h-10 w-10 shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => { setAddCandidateOpen(true); setCandidateSearch(''); }}
          title="Link candidate"
        >
          <Users className="h-4 w-4" />
        </Button>
      </div>

      {/* Task list */}
      {currentTasks.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">No items in this column</p>
        </div>
      ) : (
        <div className="space-y-2">
          {currentTasks.map(task => {
            const info = task.candidate_id ? getCandidateInfo(task.candidate_id) : null;
            const isCandidate = !!task.candidate_id;

            return (
              <div
                key={task.id}
                className={`bg-card border border-border rounded-xl p-4 ${
                  isCandidate ? 'border-l-2 border-l-primary/40' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 flex items-center gap-1.5">
                    {(task.card_type === 'task' || (!task.card_type && !isCandidate))
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    }
                    <p className="text-sm font-medium text-card-foreground">
                      {info?.candidate?.name || task.title}
                    </p>
                    {info?.position && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {info.position.title}{info.company ? ` · ${info.company.name}` : ''}
                      </p>
                    )}
                    {info?.stage && (
                      <Badge variant="secondary" className="text-[10px] mt-1 px-1.5 py-0 font-normal">
                        {info.stage.label}
                      </Badge>
                    )}
                    {info && (
                      <div className="flex flex-wrap gap-3 mt-1.5">
                        {info.candidate.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" /> {info.candidate.phone}
                          </span>
                        )}
                        {info.candidate.email && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {info.candidate.email}
                          </span>
                        )}
                      </div>
                    )}
                    {!isCandidate && task.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{task.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="p-1.5 rounded-lg text-muted-foreground active:bg-destructive/10 active:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {/* Move buttons */}
                <div className="flex gap-2 mt-3">
                  {activeColumnIndex > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => handleMoveTask(task.id, 'left')}
                    >
                      ← {columns[activeColumnIndex - 1].label}
                    </Button>
                  )}
                  {activeColumnIndex < columns.length - 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => handleMoveTask(task.id, 'right')}
                    >
                      {columns[activeColumnIndex + 1].label} →
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add candidate dialog */}
      <Dialog open={addCandidateOpen} onOpenChange={setAddCandidateOpen}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl">
          <DialogHeader><DialogTitle>Link Candidate</DialogTitle></DialogHeader>
          <Input
            placeholder="Search candidates..."
            value={candidateSearch}
            onChange={e => setCandidateSearch(e.target.value)}
            autoFocus
            className="h-10"
          />
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-1">
              {filteredCandidates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No candidates found</p>
              ) : (
                filteredCandidates.map(c => {
                  const pos = positions.find(p => p.id === c.position_id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleAddCandidateToBoard(c.id)}
                      className="w-full text-left px-3 py-3 rounded-lg active:bg-accent transition-colors"
                    >
                      <p className="text-sm font-medium text-foreground">{c.name}</p>
                      {pos && <p className="text-xs text-muted-foreground">{pos.title}</p>}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
