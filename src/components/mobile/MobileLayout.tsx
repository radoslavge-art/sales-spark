import { useState } from 'react';
import autoSorsaLogo from '@/assets/autsorsa-logo-hires.png';
import autoSorsaLogoDark from '@/assets/autsorsa-logo-dark.png';
import { Search, Plus, Settings, ClipboardList, LayoutGrid, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useATS } from '@/context/ATSContext';
import { useLanguage } from '@/context/LanguageContext';
import { Candidate } from '@/types/ats';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { MobileCandidateList } from './MobileCandidateList';
import { MobileCandidateDetail } from './MobileCandidateDetail';
import { MobileMyBoard } from './MobileMyBoard';
import { AddCandidateDialog } from '@/components/ats/AddCandidateDialog';
import UserSettings from '@/pages/UserSettings';

type MobileView = 'board' | 'detail' | 'myboard' | 'settings';

export function MobileLayout() {
  const { user, signOut, profile } = useAuth();
  const { companies, positions } = useATS();
  const { t } = useLanguage();

  const [view, setView] = useState<MobileView>('board');
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailCandidate, setDetailCandidate] = useState<Candidate | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filteredPositions = selectedCompany
    ? positions.filter(p => p.company_id === selectedCompany)
    : [];

  const handleOpenDetail = (candidate: Candidate) => {
    setDetailCandidate(candidate);
    setView('detail');
  };

  const handleBackFromDetail = () => {
    setDetailCandidate(null);
    setView('board');
  };

  // Detail view is fullscreen
  if (view === 'detail' && detailCandidate) {
    return <MobileCandidateDetail candidate={detailCandidate} onBack={handleBackFromDetail} />;
  }

  // Settings view
  if (view === 'settings') {
    return (
      <div className="flex flex-col h-screen bg-background">
        <div className="shrink-0 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView('board')} className="text-sm text-primary font-medium">← {t('common.back')}</button>
          <span className="text-base font-semibold text-foreground">{t('userMenu.settings')}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <UserSettings />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Top bar */}
      <header className="shrink-0 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <img src={autoSorsaLogo} alt="Autsorsa ATS" className="h-6 w-auto dark:hidden" />
          <img src={autoSorsaLogoDark} alt="Autsorsa ATS" className="h-6 w-auto hidden dark:block" />
          <div className="flex items-center gap-1">
            {view === 'board' && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setAddOpen(true)}>
                <Plus className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant={view === 'myboard' ? 'secondary' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => setView(view === 'myboard' ? 'board' : 'myboard')}
            >
              <ClipboardList className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setView('settings')}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {view === 'board' && (
          <div className="space-y-2">
            {/* Company / Position selectors */}
            <div className="flex gap-2">
              <Select
                value={selectedCompany || 'all'}
                onValueChange={v => {
                  setSelectedCompany(v === 'all' ? null : v);
                  setSelectedPosition(null);
                }}
              >
                <SelectTrigger className="h-9 text-sm flex-1">
                  <SelectValue placeholder="All Companies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('company.allCompanies')}</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filteredPositions.length > 0 && (
                <Select
                  value={selectedPosition || 'all'}
                  onValueChange={v => setSelectedPosition(v === 'all' ? null : v)}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue placeholder="All Positions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('position.allPositions')}</SelectItem>
                    {filteredPositions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('candidate.searchCandidates')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        )}

        {view === 'myboard' && (
          <p className="text-xs text-muted-foreground">{t('nav.personalTaskBoard')}</p>
        )}
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {view === 'board' && (
          <MobileCandidateList
            companyId={selectedCompany}
            positionId={selectedPosition}
            searchQuery={searchQuery}
            onOpenDetail={handleOpenDetail}
          />
        )}
        {view === 'myboard' && <MobileMyBoard />}
      </div>

      {/* Add candidate - full screen on mobile */}
      <AddCandidateDialog
        companyId={selectedCompany}
        externalOpen={addOpen}
        onExternalOpenChange={setAddOpen}
      />
    </div>
  );
}
