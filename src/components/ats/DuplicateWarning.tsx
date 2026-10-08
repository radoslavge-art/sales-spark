import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Candidate } from '@/types/ats';
import { useLanguage } from '@/context/LanguageContext';

interface DuplicateMatch {
  candidate: Candidate;
  reason: string;
  companyName?: string;
  positionTitle?: string;
}

interface Props {
  duplicates: DuplicateMatch[];
  onOpenExisting: (candidate: Candidate) => void;
}

export function DuplicateWarning({ duplicates, onOpenExisting }: Props) {
  const { t } = useLanguage();
  if (duplicates.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
          {t('duplicateWarning.title')}
        </span>
      </div>
      {duplicates.map(match => (
        <div
          key={match.candidate.id}
          className="flex items-center justify-between gap-3 rounded-md bg-card border px-3 py-2"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{match.candidate.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {match.positionTitle && <span>{match.positionTitle}</span>}
              {match.companyName && <span> · {match.companyName}</span>}
            </p>
            <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">{match.reason}</p>
          </div>
          <button
            type="button"
            onClick={() => onOpenExisting(match.candidate)}
            className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            {t('duplicateWarning.openExisting')}
          </button>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground/70">
        {t('duplicateWarning.note')}
      </p>
    </div>
  );
}
