import { useState, useCallback, useEffect } from 'react';
import { Building2, MoreHorizontal, Upload, Ban, BarChart3, Menu, X, Trash2, ClipboardList, Table2, MousePointerClick, Briefcase, Files, Users, Kanban, Search, LayoutDashboard, ArrowRight } from 'lucide-react';
import { NotificationBell } from '@/components/ats/NotificationBell';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useIsMobile } from '@/hooks/use-mobile';
import autoSorsaLogo from '@/assets/autsorsa-logo-hires.png';
import autoSorsaLogoDark from '@/assets/autsorsa-logo-dark.png';
import autoSorsaIcon from '@/assets/autsorsa-icon.png';
import AdminPanel from '@/pages/AdminPanel';
import UserSettings from '@/pages/UserSettings';
import { UserMenu } from '@/components/UserMenu';
import { GlobalSearchDropdown } from '@/components/ats/GlobalSearchDropdown';
import { Button } from '@/components/ui/button';
import { CompanySelector } from '@/components/ats/CompanySelector';
import { ExportCandidatesButton } from '@/components/ats/ExportCandidatesButton';
import { KanbanBoard } from '@/components/ats/KanbanBoard';
import { AddCandidateDialog } from '@/components/ats/AddCandidateDialog';
import { ImportCandidatesDialog } from '@/components/ats/ImportCandidatesDialog';
import { BulkCvUploadDialog } from '@/components/ats/BulkCvUploadDialog';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useATS } from '@/context/ATSContext';
import { CandidateDetailSheet } from '@/components/ats/CandidateDetailSheet';
import { StatsPanel } from '@/components/ats/StatsPanel';
import { MyBoard } from '@/components/ats/MyBoard';
import { supabase } from '@/integrations/supabase/client';
import { Candidate } from '@/types/ats';
import { RejectedDrawer } from '@/components/ats/RejectedDrawer';
import { TrashDrawer } from '@/components/ats/TrashDrawer';

type View = 'board' | 'admin' | 'settings' | 'myboard';

const Index = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { companies, positions, candidates, loading: atsLoading } = useATS();
  const { user, isSales, isAdmin: authIsAdmin } = useAuth();
  const { t } = useLanguage();
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedCompany, setSelectedCompanyRaw] = useState<string | null>(() => localStorage.getItem('ats_selectedCompany') || null);
  const [selectedPosition, setSelectedPositionRaw] = useState<string | null>(() => localStorage.getItem('ats_selectedPosition') || null);
  const [localFilter, setLocalFilter] = useState('');
  const [view, setViewRaw] = useState<View>(() => (localStorage.getItem('ats_view') as View) || 'board');

  const setSelectedCompany = useCallback((v: string | null | ((prev: string | null) => string | null)) => {
    setSelectedCompanyRaw(prev => {
      const next = typeof v === 'function' ? v(prev) : v;
      if (next) localStorage.setItem('ats_selectedCompany', next);
      else localStorage.removeItem('ats_selectedCompany');
      return next;
    });
  }, []);

  const setSelectedPosition = useCallback((v: string | null) => {
    setSelectedPositionRaw(v);
    if (v) localStorage.setItem('ats_selectedPosition', v);
    else localStorage.removeItem('ats_selectedPosition');
  }, []);

  const setView = useCallback((v: View) => {
    setViewRaw(v);
    localStorage.setItem('ats_view', v);
  }, []);
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [addCandidateOpen, setAddCandidateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [rejectedOpen, setRejectedOpen] = useState(false);
  const [rejectedCount, setRejectedCount] = useState(0);
  const [statsOpen, setStatsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [bulkCvOpen, setBulkCvOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const handleLocalFilterChange = useCallback((q: string) => setLocalFilter(q), []);

  const isBoardView = view === 'board';
  const hasContext = !!(selectedCompany || selectedPosition);

  // Close sidebar when selecting company/position on mobile
  const handleMobileSidebarClose = useCallback(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // Check admin role from database
  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').then(({ data }) => {
      setIsAdmin(!!data && data.length > 0);
    });
  }, [user]);

  // Keyboard shortcut: "N" to add candidate (only when context is selected)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.target as HTMLElement)?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if ((e.key === 'n' || e.key === 'N') && view === 'board' && (selectedCompany || selectedPosition)) {
        e.preventDefault();
        setAddCandidateOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, selectedCompany, selectedPosition]);

  const handlePaletteCompany = useCallback((id: string) => {
    setSelectedCompany(id);
    setSelectedPosition(null);
    setView('board');
    setDetailCandidate(null);
    handleMobileSidebarClose();
  }, [handleMobileSidebarClose]);

  const handlePalettePosition = useCallback((companyId: string, positionId: string) => {
    setSelectedCompany(companyId);
    setSelectedPosition(positionId);
    setView('board');
    handleMobileSidebarClose();
  }, [handleMobileSidebarClose]);

  // FIX #2: Rejected count reacts to candidates state changes (reject/restore)
  useEffect(() => {
    const loadRejectedCount = async () => {
      if (!selectedCompany) {
        setRejectedCount(0);
        return;
      }
      const companyPositionIds = positions.filter(p => p.company_id === selectedCompany).map(p => p.id);
      if (companyPositionIds.length === 0) {
        setRejectedCount(0);
        return;
      }
      const { count } = await supabase
        .from('candidates')
        .select('id', { count: 'exact', head: true })
        .eq('is_rejected', true)
        .is('deleted_at', null)
        .in('position_id', companyPositionIds);
      setRejectedCount(count || 0);
    };

    loadRejectedCount();
  }, [selectedCompany, positions, candidates]);

  const isEmpty = companies.length === 0;

  const handleSelectCompany = (id: string | null) => {
    setSelectedCompany(prev => prev === id ? null : id);
    setSelectedPosition(null);
    if (view !== 'board') setView('board');
    handleMobileSidebarClose();
  };

  const handleSelectPosition = (id: string | null) => {
    setSelectedPosition(id);
    if (id) {
      const position = positions.find(p => p.id === id);
      if (position) setSelectedCompany(position.company_id);
    }
    if (view !== 'board') setView('board');
    handleMobileSidebarClose();
  };

  const selectedCompanyName = companies.find(c => c.id === selectedCompany)?.name;
  const selectedPositionName = positions.find(p => p.id === selectedPosition)?.title;

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile sidebar overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          ${isMobile
            ? `fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'w-[290px] shrink-0'
          }
          bg-card border-r flex flex-col overflow-hidden
        `}
      >
        <div className="shrink-0 w-full flex items-center justify-between px-0">
          <button
            onClick={() => {
              setSelectedCompany(null);
              setSelectedPosition(null);
              setLocalFilter('');
              setDetailCandidate(null);
              setView('board');
              handleMobileSidebarClose();
            }}
            className="flex-1 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity py-3"
            title={t('nav.goToHome')}
          >
            <img src={autoSorsaLogo} alt="Autsorsa" className="h-28 max-w-full object-contain dark:hidden" fetchPriority="high" />
            <img src={autoSorsaLogoDark} alt="Autsorsa" className="h-28 max-w-full object-contain hidden dark:block" fetchPriority="high" />
          </button>
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
        {/* Navigation buttons */}
        <div className="shrink-0 px-3 py-3 flex flex-col gap-2">
          <button
            onClick={() => { setView('myboard'); handleMobileSidebarClose(); }}
            className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-semibold transition-all duration-200 border ${
              view === 'myboard'
                ? 'bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20'
                : 'bg-card text-foreground border-border hover:bg-accent hover:border-primary/30 hover:shadow-sm'
            }`}
          >
            <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
              view === 'myboard' ? 'bg-primary-foreground/20' : 'bg-primary/10'
            }`}>
              <ClipboardList className={`h-5 w-5 ${view === 'myboard' ? 'text-primary-foreground' : 'text-primary'}`} />
            </div>
            <div className="text-left">
              <div className="leading-tight">{t('nav.myBoard')}</div>
              <div className={`text-[11px] font-normal mt-0.5 ${view === 'myboard' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{t('nav.personalTaskBoard')}</div>
            </div>
          </button>
          <button
            onClick={() => { navigate('/weekly-report'); handleMobileSidebarClose(); }}
            className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-semibold transition-all duration-200 border bg-card text-foreground border-border hover:bg-accent hover:border-primary/30 hover:shadow-sm"
          >
            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10">
              <Table2 className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <div className="leading-tight">{t('nav.weeklyReport')}</div>
            </div>
          </button>
          {(isSales || authIsAdmin) && (
            <>
              <button
                onClick={() => { navigate('/sales'); handleMobileSidebarClose(); }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-semibold transition-all duration-200 border bg-card text-foreground border-border hover:bg-accent hover:border-primary/30 hover:shadow-sm"
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10"><Briefcase className="h-5 w-5 text-primary" /></div>
                <div className="text-left flex-1"><div className="leading-tight flex items-center gap-2">{t('nav.sales')}</div></div>
              </button>
              <button
                onClick={() => { navigate('/crm'); handleMobileSidebarClose(); }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-xl text-sm font-semibold transition-all duration-200 border bg-card text-foreground border-border hover:bg-accent hover:border-primary/30 hover:shadow-sm"
              >
                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
                <div className="text-left flex-1"><div className="leading-tight">Sales CRM</div><div className="text-[11px] font-normal mt-0.5 text-muted-foreground">Leads, deals &amp; activities</div></div>
              </button>
            </>
          )}
        </div>
        <div className="h-px bg-border mx-3 mb-1" />
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
          <CompanySelector
            selectedId={selectedCompany}
            onSelect={handleSelectCompany}
            selectedPositionId={selectedPosition}
            onSelectPosition={handleSelectPosition}
            isAdmin={isAdmin}
            onViewStats={(posId) => {
              setSelectedPosition(posId);
              setStatsOpen(true);
              handleMobileSidebarClose();
            }}
          />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Action bar */}
        <header className={`shrink-0 border-b border-border bg-card flex items-center ${isMobile ? 'px-3 h-12 gap-2' : 'px-5 h-14'}`}>
          {/* Mobile hamburger */}
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          )}

          {/* Centered search */}
          {!isMobile && <div className="flex-1" />}
          <div className={`min-w-0 ${isMobile ? 'flex-1' : 'w-full max-w-xl'}`}>
            <GlobalSearchDropdown
              selectedCompany={selectedCompany}
              selectedPosition={selectedPosition}
              onSelectCompany={handlePaletteCompany}
              onSelectPosition={handlePalettePosition}
              onSelectCandidate={(c) => {
                const pos = positions.find(p => p.id === c.position_id);
                if (pos) {
                  setSelectedCompany(pos.company_id);
                  setSelectedPosition(pos.id);
                }
                setView('board');
                setDetailCandidate(c);
              }}
              onLocalFilterChange={handleLocalFilterChange}
            />
          </div>
          {!isMobile && <div className="flex-1" />}

          {/* Context-aware action group */}
          <div className={`flex items-center shrink-0 ${isMobile ? 'gap-1' : 'gap-3'}`}>
            {isBoardView && hasContext && (
              <>
                <AddCandidateDialog companyId={selectedCompany} positionId={selectedPosition} externalOpen={addCandidateOpen} onExternalOpenChange={setAddCandidateOpen} onOpenCandidate={(c) => setDetailCandidate(c)} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className={`${isMobile ? 'h-9 w-9' : 'h-10 w-10'} data-[state=open]:bg-accent data-[state=open]:text-accent-foreground`}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setRejectedOpen(true)} className="py-2">
                      <Ban className="h-4 w-4 mr-2.5" />
                      {t('index.rejectedCandidates')}
                      {rejectedCount > 0 && (
                        <span className="ml-auto text-[11px] bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 tabular-nums font-medium">{rejectedCount}</span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setStatsOpen(true)} className="py-2">
                      <BarChart3 className="h-4 w-4 mr-2.5" /> {t('index.stats')}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {isAdmin && (
                    <DropdownMenuItem onSelect={() => setImportOpen(true)} className="py-2">
                      <Upload className="h-4 w-4 mr-2.5" /> {t('common.import')}
                    </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => setBulkCvOpen(true)} className="py-2">
                      <Files className="h-4 w-4 mr-2.5" /> Bulk CV Upload
                    </DropdownMenuItem>
                    <ExportCandidatesButton companyId={selectedCompany} positionId={selectedPosition} asMenuItem />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setTrashOpen(true)} className="py-2">
                      <Trash2 className="h-4 w-4 mr-2.5" /> {t('index.trash')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <ImportCandidatesDialog companyId={selectedCompany} externalOpen={importOpen} onExternalOpenChange={setImportOpen} isAdmin={isAdmin} />
                <BulkCvUploadDialog open={bulkCvOpen} onOpenChange={setBulkCvOpen} positionId={selectedPosition} onOpenCandidate={(c) => setDetailCandidate(c)} />
              </>
            )}
            <NotificationBell onOpenCandidate={(candidateId) => {
              const c = candidates.find(cd => cd.id === candidateId);
              if (c) {
                const pos = positions.find(p => p.id === c.position_id);
                if (pos) {
                  setSelectedCompany(pos.company_id);
                  setSelectedPosition(pos.id);
                }
                setView('board');
                setDetailCandidate(c);
              }
            }} />
            <UserMenu isAdmin={isAdmin} onNavigate={(v) => {
              if (v === 'weekly-report') { navigate('/weekly-report'); return; }
              setView(v as View);
            }} />
          </div>
        </header>

        <div className={`flex-1 overflow-auto ${isMobile ? 'p-3' : 'p-6'}`}>
          {view === 'myboard' ? (
            <MyBoard />
          ) : view === 'settings' ? (
            <UserSettings />
          ) : view === 'admin' && isAdmin ? (
            <AdminPanel />
          ) : atsLoading ? (
            <div className="flex items-center justify-center h-full" />
          ) : isEmpty ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              {/* Large animated gradient blob */}
              <div className="relative mb-12">
                <div className="absolute -inset-16 rounded-full bg-gradient-to-br from-primary/25 via-primary/10 to-accent/20 blur-3xl animate-pulse" />
                <div className="relative rounded-[2rem] bg-gradient-to-br from-primary via-primary/85 to-primary/60 p-10 shadow-2xl shadow-primary/40 ring-1 ring-primary/30">
                  <Building2 className="h-20 w-20 text-primary-foreground" />
                </div>
              </div>

              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4">
                {t('index.welcomeTitle')}
              </h2>
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-12 max-w-lg">
                {t('index.welcomeDesc')}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl w-full">
                {[
                  { num: '1', title: t('index.step1'), desc: t('index.step1Desc') },
                  { num: '2', title: t('index.step2'), desc: t('index.step2Desc') },
                  { num: '3', title: t('index.step3'), desc: t('index.step3Desc') },
                  { num: '4', title: t('index.step4'), desc: t('index.step4Desc') },
                ].map(step => (
                  <div key={step.num} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm hover:shadow-md transition-shadow">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-primary">{step.num}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : view === 'board' && !selectedCompany ? (
            <div className="flex flex-col items-center justify-center h-full px-6">
              {/* Hero icon */}
              <div className="relative mb-10">
                <div className="absolute -inset-12 rounded-full bg-gradient-to-br from-primary/20 via-primary/5 to-transparent blur-3xl animate-pulse" />
                <img src={autoSorsaIcon} alt="Autsorsa" className="relative h-28 w-auto object-contain drop-shadow-2xl" />
              </div>

              <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-3">
                {t('index.workspaceTitle')}
              </h2>
              <p className="text-base md:text-lg text-muted-foreground leading-relaxed mb-14 max-w-lg text-center">
                {t('index.workspaceDesc')}
              </p>

              {/* Feature cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl w-full mb-14">
                {[
                  { icon: Users, title: t('index.featurePipeline'), desc: t('index.featurePipelineDesc'), color: 'from-blue-500 to-blue-600', action: () => { /* need a company selected - open sidebar */ setSidebarOpen(true); } },
                  { icon: ClipboardList, title: t('index.featureMyBoard'), desc: t('index.featureMyBoardDesc'), color: 'from-emerald-500 to-emerald-600', action: () => setView('myboard') },
                  { icon: Table2, title: t('index.featureReports'), desc: t('index.featureReportsDesc'), color: 'from-amber-500 to-amber-600', action: () => navigate('/weekly-report') },
                  { icon: Search, title: t('index.featureSearch'), desc: t('index.featureSearchDesc'), color: 'from-violet-500 to-violet-600', action: () => { const el = document.querySelector<HTMLInputElement>('[data-global-search]'); el?.focus(); } },
                ].map(feature => (
                  <button key={feature.title} onClick={feature.action} className="group relative rounded-2xl border border-border bg-card p-6 text-left hover:shadow-lg hover:border-primary/20 transition-all duration-300 cursor-pointer overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className={`relative h-12 w-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg`}>
                      <feature.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="relative text-sm font-bold text-foreground mb-1">{feature.title}</h3>
                    <p className="relative text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </button>
                ))}
              </div>

            </div>
          ) : view === 'board' ? (
            <KanbanBoard companyId={selectedCompany} positionId={selectedPosition} searchQuery={localFilter} onOpenCandidate={setDetailCandidate} />
          ) : null}
        </div>
      </main>
      <CandidateDetailSheet
        candidate={detailCandidate}
        open={!!detailCandidate}
        onOpenChange={(open) => { if (!open) setDetailCandidate(null); }}
      />
      <RejectedDrawer open={rejectedOpen} onOpenChange={setRejectedOpen} companyId={selectedCompany} />
      <StatsPanel open={statsOpen} onOpenChange={setStatsOpen} companyId={selectedCompany} positionId={selectedPosition} />
      <TrashDrawer open={trashOpen} onOpenChange={setTrashOpen} scope={selectedCompany ? { type: 'company', companyId: selectedCompany } : { type: 'global' }} />
    </div>
  );
};

export default Index;
