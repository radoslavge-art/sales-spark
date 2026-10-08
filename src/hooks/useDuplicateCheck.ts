import { useMemo } from 'react';
import { useATS } from '@/context/ATSContext';
import { Candidate } from '@/types/ats';

interface DuplicateMatch {
  candidate: Candidate;
  reason: string;
  companyName?: string;
  positionTitle?: string;
}

/**
 * Checks for potential duplicate candidates by:
 * 1. full name + same company (via position)
 * 2. full name + same email (if both provided)
 */
export function useDuplicateCheck(
  name: string,
  email: string,
  positionId: string,
) {
  const { candidates, positions, companies } = useATS();

  const duplicates = useMemo((): DuplicateMatch[] => {
    const trimmedName = name.trim().toLowerCase();
    if (!trimmedName || trimmedName.length < 2) return [];

    const targetPos = positions.find(p => p.id === positionId);
    const targetCompanyId = targetPos?.company_id;

    const matches: DuplicateMatch[] = [];
    const seen = new Set<string>();

    for (const c of candidates) {
      if (seen.has(c.id)) continue;
      const cName = c.name.trim().toLowerCase();
      if (cName !== trimmedName) continue;

      const pos = positions.find(p => p.id === c.position_id);
      const comp = pos ? companies.find(co => co.id === pos.company_id) : undefined;

      // Match 1: same name + same company
      if (targetCompanyId && pos?.company_id === targetCompanyId) {
        seen.add(c.id);
        matches.push({
          candidate: c,
          reason: `Same name in ${comp?.name || 'same company'}`,
          companyName: comp?.name,
          positionTitle: pos?.title,
        });
        continue;
      }

      // Match 2: same name + same email
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail && c.email?.trim().toLowerCase() === trimmedEmail) {
        seen.add(c.id);
        matches.push({
          candidate: c,
          reason: `Same name and email`,
          companyName: comp?.name,
          positionTitle: pos?.title,
        });
      }
    }

    return matches;
  }, [name, email, positionId, candidates, positions, companies]);

  return duplicates;
}
