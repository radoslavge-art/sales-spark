export interface Stage {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  company_id: string;
}

export const STAGE_COLORS = [
  { key: 'blue', label: 'Blue' },
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'orange', label: 'Orange' },
  { key: 'red', label: 'Red' },
  { key: 'pink', label: 'Pink' },
  { key: 'purple', label: 'Purple' },
  { key: 'indigo', label: 'Indigo' },
  { key: 'teal', label: 'Teal' },
  { key: 'amber', label: 'Amber' },
  { key: 'gray', label: 'Gray' },
  { key: 'slate', label: 'Slate' },
] as const;

export type StageColor = typeof STAGE_COLORS[number]['key'];

export const DEFAULT_STAGES: { label: string; color: string; sort_order: number }[] = [
  { label: 'Contacted', color: 'blue', sort_order: 0 },
  { label: 'Interview', color: 'amber', sort_order: 1 },
  { label: 'Offer', color: 'purple', sort_order: 2 },
  { label: 'Hired', color: 'green', sort_order: 3 },
];

export interface Company {
  id: string;
  name: string;
  notes: string;
  stages: Stage[];
  created_at: string;
  created_by?: string | null;
}

export interface Position {
  id: string;
  title: string;
  company_id: string;
  notes: string;
  created_at: string;
}

export interface Owner {
  id: string;
  name: string;
  created_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  notes: string;
  ai_summary: string;
  expected_salary: string;
  notice_period: string;
  phone: string;
  email: string;
  stage_id: string | null;
  owner_id: string | null;
  position_id: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
  is_rejected: boolean;
  previous_stage_id: string | null;
}
