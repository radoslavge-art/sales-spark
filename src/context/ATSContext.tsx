import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Company, Position, Candidate, Stage, Owner, DEFAULT_STAGES } from '@/types/ats';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { logActivity } from '@/lib/logActivity';

// Exact labels that represent rejection stages — not substring match
const REJECTED_STAGE_LABELS = new Set([
  'rejected',
  'declined',
  'rejected / declined',
  'rejected/ declined',
  'declined/ rejected',
  'declined / rejected',
  'отказ',
  'отказ на кандидат',
  'отказ на кандидата',
  'отказ на клиент',
  'отказ на клиента',
]);

function isRejectedStageLabel(label: string): boolean {
  return REJECTED_STAGE_LABELS.has(label.trim().toLowerCase());
}

interface ATSContextType {
  companies: Company[];
  positions: Position[];
  candidates: Candidate[];
  allCandidates: Candidate[];
  owners: Owner[];
  loading: boolean;
  addCompany: (name: string, notes?: string) => Promise<Company | null>;
  updateCompany: (id: string, data: Partial<Pick<Company, 'name' | 'notes'>>) => Promise<void>;
  deleteCompany: (id: string) => Promise<void>;
  addPosition: (title: string, companyId: string, notes?: string) => Promise<Position | null>;
  updatePosition: (id: string, data: Partial<Pick<Position, 'title' | 'notes'>>) => Promise<void>;
  deletePosition: (id: string) => Promise<void>;
  addCandidate: (name: string, positionId: string, data?: { expected_salary?: string; notes?: string; ai_summary?: string; stage_id?: string | null; notice_period?: string; owner_id?: string | null; phone?: string; email?: string; tags?: string[] }) => Promise<Candidate | null>;
  updateCandidate: (id: string, data: Partial<Pick<Candidate, 'name' | 'notes' | 'ai_summary' | 'expected_salary' | 'notice_period' | 'stage_id' | 'position_id' | 'owner_id' | 'phone' | 'email' | 'tags'>>) => Promise<void>;
  deleteCandidate: (id: string) => Promise<void>;
  restoreDeletedItem: (table: 'companies' | 'positions' | 'candidates', id: string) => Promise<void>;
  moveCandidateStatus: (id: string, stageId: string) => Promise<void>;
  rejectCandidate: (id: string) => Promise<void>;
  restoreCandidate: (id: string) => Promise<void>;
  addStage: (companyId: string, label: string, color: string) => Promise<Stage | null>;
  updateStage: (companyId: string, stageId: string, data: Partial<Pick<Stage, 'label' | 'color' | 'sort_order'>>) => Promise<void>;
  deleteStage: (companyId: string, stageId: string) => Promise<void>;
  reorderStages: (companyId: string, stageIds: string[]) => Promise<void>;
  getCompanyStages: (companyId: string) => Stage[];
  addOwner: (name: string) => Promise<Owner | null>;
}

const ATSContext = createContext<ATSContextType | null>(null);

export function ATSProvider({ children }: { children: React.ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionReady, setSessionReady] = useState(false);

  // Wait for auth session before fetching data
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionReady(!!session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionReady(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Helper to fetch all rows from a table (handles 1000-row limit)
  const fetchAllRows = async <T,>(query: any): Promise<T[]> => {
    const PAGE_SIZE = 1000;
    let allData: T[] = [];
    let from = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
      if (error || !data) break;
      allData = allData.concat(data);
      hasMore = data.length === PAGE_SIZE;
      from += PAGE_SIZE;
    }
    return allData;
  };

  // Fetch all data only when session is ready
  useEffect(() => {
    if (!sessionReady) {
      setCompanies([]);
      setPositions([]);
      setCandidates([]);
      setStages([]);
      setOwners([]);
      setLoading(false);
      return;
    }
    const fetchAll = async () => {
      setLoading(true);
      const [compData, stagesData, posData, candData, ownData] = await Promise.all([
        fetchAllRows<Company>(supabase.from('companies').select('*').is('deleted_at', null).order('created_at')),
        fetchAllRows<Stage>(supabase.from('stages').select('*').is('deleted_at', null).order('sort_order')),
        fetchAllRows<Position>(supabase.from('positions').select('*').is('deleted_at', null).order('created_at')),
        fetchAllRows<Candidate>(supabase.from('candidates').select('*').is('deleted_at', null).order('created_at')),
        fetchAllRows<Owner>(supabase.from('owners').select('*').is('deleted_at', null).order('created_at')),
      ]);

      setStages(stagesData);
      setCompanies(compData.map(c => ({
        ...c,
        stages: stagesData.filter(s => s.company_id === c.id),
      })));

      // Auto-migrate: run only once per browser
      const migrationKey = 'rejected_migration_done_v1';
      if (!localStorage.getItem(migrationKey)) {
        const rejectedStageIds = new Set(
          stagesData.filter(s => isRejectedStageLabel(s.label)).map(s => s.id)
        );

        if (rejectedStageIds.size > 0) {
          const { data: rejectedStageCandidates } = await supabase
            .from('candidates')
            .select('*')
            .eq('is_rejected', false)
            .in('stage_id', Array.from(rejectedStageIds));

          if (rejectedStageCandidates && rejectedStageCandidates.length > 0) {
            await Promise.all(
              rejectedStageCandidates.map(c =>
                supabase.from('candidates').update({
                  is_rejected: true,
                  previous_stage_id: c.previous_stage_id || null,
                  stage_id: null,
                  rejected_at: new Date().toISOString(),
                } as any).eq('id', c.id)
              )
            );
          }
        }
        localStorage.setItem(migrationKey, 'true');
      }

      setPositions(posData);
      const rejectedStageIds = new Set(
        stagesData.filter(s => isRejectedStageLabel(s.label)).map(s => s.id)
      );
      setAllCandidates(candData);
      setCandidates(candData.filter(c => !c.is_rejected && !(c.stage_id && rejectedStageIds.has(c.stage_id))));
      setOwners(ownData as any);
      setLoading(false);
    };
    fetchAll();
  }, [sessionReady]);

  // Helper to rebuild companies with stages
  const rebuildCompanies = useCallback((comps: typeof companies, stgs: Stage[]) => {
    return comps.map(c => ({ ...c, stages: stgs.filter(s => s.company_id === c.id) }));
  }, []);

  const addCompany = useCallback(async (name: string, notes = '') => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: comp, error } = await supabase.from('companies').insert({ name, notes, created_by: user?.id } as any).select().single();
    if (error || !comp) { toast({ title: 'Error', description: error?.message, variant: 'destructive' }); return null; }

    const stageInserts = DEFAULT_STAGES.map(s => ({ ...s, company_id: comp.id }));
    const { data: newStages } = await supabase.from('stages').insert(stageInserts).select();
    const stgs = newStages || [];

    setStages(prev => [...prev, ...stgs]);
    const newCompany: Company = { ...comp, stages: stgs };
    setCompanies(prev => [...prev, newCompany]);
    return newCompany;
  }, []);

  const updateCompany = useCallback(async (id: string, data: Partial<Pick<Company, 'name' | 'notes'>>) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('companies').update({ ...data, updated_by: authUser?.id } as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
  }, []);

  const restoreDeletedItem = useCallback(async (table: 'companies' | 'positions' | 'candidates', id: string) => {
    const { data, error } = await supabase.from(table).update({ deleted_at: null, deleted_by: null } as any).eq('id', id).select().single();
    if (error || !data) { toast({ title: 'Error', description: error?.message, variant: 'destructive' }); return; }
    if (table === 'companies') {
      const comp = data as any as Company;
      const { data: stgs } = await supabase.from('stages').select('*').eq('company_id', id).is('deleted_at', null);
      setStages(prev => [...prev, ...(stgs || [])]);
      setCompanies(prev => [...prev, { ...comp, stages: stgs || [] }]);
    } else if (table === 'positions') {
      setPositions(prev => [...prev, data as any as Position]);
    } else if (table === 'candidates') {
      setCandidates(prev => [...prev, data as any as Candidate]);
    }
    toast({ title: 'Restored successfully' });
  }, []);

  const deleteCompany = useCallback(async (id: string) => {
    const company = companies.find(c => c.id === id);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const deletedBy = authUser?.id;

    // Cascade soft-delete: stages, positions, and their candidates in DB
    const posIds = positions.filter(p => p.company_id === id).map(p => p.id);
    const cascadePromises: Promise<any>[] = [
      supabase.from('companies').update({ deleted_at: now, deleted_by: deletedBy } as any).eq('id', id) as any,
      supabase.from('stages').update({ deleted_at: now, deleted_by: deletedBy } as any).eq('company_id', id).is('deleted_at', null) as any,
      supabase.from('positions').update({ deleted_at: now, deleted_by: deletedBy } as any).eq('company_id', id).is('deleted_at', null) as any,
    ];
    if (posIds.length > 0) {
      cascadePromises.push(
        supabase.from('candidates').update({ deleted_at: now, deleted_by: deletedBy } as any).in('position_id', posIds).is('deleted_at', null) as any
      );
    }
    const results = await Promise.all(cascadePromises);
    const firstError = results.find(r => r.error);
    if (firstError?.error) { toast({ title: 'Error', description: firstError.error.message, variant: 'destructive' }); return; }

    setStages(prev => prev.filter(s => s.company_id !== id));
    setCompanies(prev => prev.filter(c => c.id !== id));
    setPositions(prev => prev.filter(p => p.company_id !== id));
    setCandidates(prev => prev.filter(c => !posIds.includes(c.position_id)));
    toast({ title: 'Moved to trash', description: `"${company?.name}" was deleted`, duration: 5000, action: <ToastAction altText="Undo" onClick={() => restoreDeletedItem('companies', id)}>Undo</ToastAction> });
  }, [positions, companies, restoreDeletedItem]);

  const addPosition = useCallback(async (title: string, companyId: string, notes = '') => {
    const { data, error } = await supabase.from('positions').insert({ title, company_id: companyId, notes }).select().single();
    if (error || !data) { toast({ title: 'Error', description: error?.message, variant: 'destructive' }); return null; }
    setPositions(prev => [...prev, data]);
    return data;
  }, []);

  const updatePosition = useCallback(async (id: string, data: Partial<Pick<Position, 'title' | 'notes'>>) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('positions').update({ ...data, updated_by: authUser?.id } as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setPositions(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
  }, []);

  const deletePosition = useCallback(async (id: string) => {
    const pos = positions.find(p => p.id === id);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const now = new Date().toISOString();
    const deletedBy = authUser?.id;

    // Cascade soft-delete: position + its candidates in DB
    const [posResult, candResult] = await Promise.all([
      supabase.from('positions').update({ deleted_at: now, deleted_by: deletedBy } as any).eq('id', id),
      supabase.from('candidates').update({ deleted_at: now, deleted_by: deletedBy } as any).eq('position_id', id).is('deleted_at', null) as any,
    ]);
    if (posResult.error) { toast({ title: 'Error', description: posResult.error.message, variant: 'destructive' }); return; }

    setPositions(prev => prev.filter(p => p.id !== id));
    setCandidates(prev => prev.filter(c => c.position_id !== id));
    toast({ title: 'Moved to trash', description: `"${pos?.title}" was deleted`, duration: 5000, action: <ToastAction altText="Undo" onClick={() => restoreDeletedItem('positions', id)}>Undo</ToastAction> });
  }, [positions, restoreDeletedItem]);

  const addCandidate = useCallback(async (name: string, positionId: string, data?: { expected_salary?: string; notes?: string; ai_summary?: string; stage_id?: string | null; notice_period?: string; owner_id?: string | null; phone?: string; email?: string; tags?: string[] }) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    // owner_id references the owners table, not auth.users — only set if explicitly provided and valid
    const insert = {
      name,
      position_id: positionId,
      expected_salary: data?.expected_salary || '',
      notes: data?.notes || '',
      ai_summary: data?.ai_summary || '',
      stage_id: data?.stage_id || null,
      notice_period: data?.notice_period || '',
      owner_id: data?.owner_id || null,
      phone: data?.phone || '',
      email: data?.email || '',
      tags: data?.tags || [],
      created_by: authUser?.id,
    };
    const { data: cand, error } = await supabase.from('candidates').insert(insert as any).select().single();
    if (error || !cand) { toast({ title: 'Error', description: error?.message, variant: 'destructive' }); return null; }
    setCandidates(prev => [...prev, cand]);
    logActivity(`Created candidate "${name}"`, 'candidate', cand.id);

    if ((!data?.tags || data.tags.length === 0) && data?.notes) {
      supabase.functions.invoke('extract-tags', { body: { text: data.notes } })
        .then(({ data: tagData }) => {
          if (tagData?.tags?.length > 0) {
            supabase.from('candidates').update({ tags: tagData.tags } as any).eq('id', cand.id).then(() => {
              setCandidates(prev => prev.map(c => c.id === cand.id ? { ...c, tags: tagData.tags } : c));
            });
          }
        })
        .catch(() => {});
    }

    return cand;
  }, []);

  const updateCandidate = useCallback(async (id: string, data: Partial<Pick<Candidate, 'name' | 'notes' | 'ai_summary' | 'expected_salary' | 'notice_period' | 'stage_id' | 'position_id' | 'owner_id' | 'phone' | 'email' | 'tags'>>) => {
    const prev = candidates.find(c => c.id === id);
    const { data: { user: authUser } } = await supabase.auth.getUser();

    // Soft conflict detection: check if updated_at changed since we fetched
    if (prev?.updated_at) {
      const { data: current } = await supabase.from('candidates').select('updated_at').eq('id', id).single();
      if (current && current.updated_at && current.updated_at !== prev.updated_at) {
        toast({ title: 'Conflict detected', description: 'This item was updated by another user. Your changes were still saved, but please review.', variant: 'destructive' });
      }
    }

    const { error } = await supabase.from('candidates').update({ ...data, updated_by: authUser?.id } as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    // Re-fetch updated_at so future edits have the latest snapshot
    const { data: refreshed } = await supabase.from('candidates').select('updated_at').eq('id', id).single();
    setCandidates(p => p.map(c => c.id === id ? { ...c, ...data, updated_at: refreshed?.updated_at ?? c.updated_at } : c));

    const fieldLabels: Record<string, string> = {
      name: 'candidate name', notes: 'notes', expected_salary: 'expected salary',
      notice_period: 'notice period', phone: 'phone number', email: 'email',
      owner_id: 'candidate owner', position_id: 'position', stage_id: 'stage',
    };

    const changedKeys = Object.keys(data).filter(k => !prev || (prev as any)[k] !== (data as any)[k]);
    const meaningful = changedKeys.filter(k => k !== 'stage_id' && k !== 'tags');
    
    if (meaningful.length === 1) {
      logActivity(`Updated ${fieldLabels[meaningful[0]] || meaningful[0]}`, 'candidate', id);
    } else if (meaningful.length > 1) {
      logActivity(`Updated ${meaningful.map(k => fieldLabels[k] || k).join(', ')}`, 'candidate', id);
    }

    if (data.notes && data.notes !== prev?.notes) {
      supabase.functions.invoke('extract-tags', { body: { text: data.notes } })
        .then(({ data: tagData }) => {
          if (tagData?.tags) {
            supabase.from('candidates').update({ tags: tagData.tags } as any).eq('id', id).then(() => {
              setCandidates(p => p.map(c => c.id === id ? { ...c, tags: tagData.tags } : c));
            });
          }
        })
        .catch(() => {});
    }
  }, [candidates]);

  const deleteCandidate = useCallback(async (id: string) => {
    const cand = candidates.find(c => c.id === id);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('candidates').update({ deleted_at: new Date().toISOString(), deleted_by: authUser?.id } as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setCandidates(prev => prev.filter(c => c.id !== id));
    toast({ title: 'Moved to trash', description: `"${cand?.name}" was deleted`, duration: 5000, action: <ToastAction altText="Undo" onClick={() => restoreDeletedItem('candidates', id)}>Undo</ToastAction> });
  }, [candidates, restoreDeletedItem]);

  // FIX #3: Use stages from state (add to deps)
  const moveCandidateStatus = useCallback(async (id: string, stageId: string) => {
    const newStageId = stageId || null;

    // Optimistic: update UI immediately so drag-drop feels instant
    const prev = candidates;
    setCandidates(cs => cs.map(c => c.id === id ? { ...c, stage_id: newStageId } : c));

    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('candidates').update({ stage_id: newStageId, updated_by: authUser?.id } as any).eq('id', id);
    if (error) {
      // Rollback on failure
      setCandidates(prev);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    const stage = stages.find(s => s.id === stageId);
    logActivity(`moved to "${stage?.label ?? 'Unassigned'}"`, 'candidate', id);
  }, [stages, candidates]);

  // FIX #4: Optimistic reject with rejected_at
  const rejectCandidate = useCallback(async (id: string) => {
    const candidate = candidates.find(c => c.id === id);
    if (!candidate) return;

    // Optimistic: remove from UI immediately
    setCandidates(prev => prev.filter(c => c.id !== id));

    const { error } = await supabase.from('candidates').update({
      is_rejected: true,
      previous_stage_id: candidate.stage_id || null,
      stage_id: null,
      rejected_at: new Date().toISOString(),
    } as any).eq('id', id);

    if (error) {
      // Rollback on failure
      setCandidates(prev => [...prev, candidate]);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }

    logActivity('rejected', 'candidate', id);
  }, [candidates]);

  // FIX: Also clear rejected_at on restore
  const restoreCandidate = useCallback(async (id: string) => {
    const { data: candidate } = await supabase.from('candidates').select('*').eq('id', id).single();
    if (!candidate) return;
    const restoreStageId = candidate.previous_stage_id || null;
    const { error } = await supabase.from('candidates').update({
      is_rejected: false,
      stage_id: restoreStageId,
      previous_stage_id: null,
      rejected_at: null,
    } as any).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setCandidates(prev => [...prev, { ...candidate, is_rejected: false, stage_id: restoreStageId, previous_stage_id: null }]);
    logActivity('restored from rejected', 'candidate', id);
  }, []);

  const addStage = useCallback(async (companyId: string, label: string, color: string) => {
    const company = companies.find(c => c.id === companyId);
    const maxOrder = company ? Math.max(...company.stages.map(s => s.sort_order), -1) + 1 : 0;
    const { data, error } = await supabase.from('stages').insert({ company_id: companyId, label, color, sort_order: maxOrder }).select().single();
    if (error || !data) { toast({ title: 'Error', description: error?.message, variant: 'destructive' }); return null; }
    setStages(prev => [...prev, data]);
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, stages: [...c.stages, data] } : c));
    return data;
  }, [companies]);

  const updateStage = useCallback(async (companyId: string, stageId: string, data: Partial<Pick<Stage, 'label' | 'color' | 'sort_order'>>) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('stages').update({ ...data, updated_by: authUser?.id } as any).eq('id', stageId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setStages(prev => prev.map(s => s.id === stageId ? { ...s, ...data } : s));
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, stages: c.stages.map(s => s.id === stageId ? { ...s, ...data } : s) } : c));
  }, []);

  const deleteStage = useCallback(async (companyId: string, stageId: string) => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    const { error } = await supabase.from('stages').update({ deleted_at: new Date().toISOString(), deleted_by: authUser?.id } as any).eq('id', stageId);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    setStages(prev => prev.filter(s => s.id !== stageId));
    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, stages: c.stages.filter(s => s.id !== stageId) } : c));
  }, []);

  const reorderStages = useCallback(async (companyId: string, stageIds: string[]) => {
    const updates = stageIds.map((id, i) => supabase.from('stages').update({ sort_order: i }).eq('id', id));
    await Promise.all(updates);
    
    setStages(prev => prev.map(s => {
      const idx = stageIds.indexOf(s.id);
      return idx >= 0 ? { ...s, sort_order: idx } : s;
    }));
    setCompanies(prev => prev.map(c => {
      if (c.id !== companyId) return c;
      const reordered = stageIds.map((id, i) => {
        const stage = c.stages.find(s => s.id === id);
        return stage ? { ...stage, sort_order: i } : null;
      }).filter(Boolean) as Stage[];
      return { ...c, stages: reordered };
    }));
  }, []);

  const getCompanyStages = useCallback((companyId: string): Stage[] => {
    const company = companies.find(c => c.id === companyId);
    return company ? [...company.stages].sort((a, b) => a.sort_order - b.sort_order) : [];
  }, [companies]);

  const addOwner = useCallback(async (name: string) => {
    const { data, error } = await supabase.from('owners').insert({ name } as any).select().single();
    if (error || !data) { toast({ title: 'Error', description: error?.message, variant: 'destructive' }); return null; }
    const owner = data as any as Owner;
    setOwners(prev => [...prev, owner]);
    return owner;
  }, []);




  return (
    <ATSContext.Provider value={{
      companies, positions, candidates, allCandidates, owners, loading,
      addCompany, updateCompany, deleteCompany,
      addPosition, updatePosition, deletePosition,
      addCandidate, updateCandidate, deleteCandidate, restoreDeletedItem,
      moveCandidateStatus, rejectCandidate, restoreCandidate,
      addStage, updateStage, deleteStage, reorderStages, getCompanyStages,
      addOwner,
    }}>
      {children}
    </ATSContext.Provider>
  );
}

export function useATS() {
  const ctx = useContext(ATSContext);
  if (!ctx) throw new Error('useATS must be used within ATSProvider');
  return ctx;
}
