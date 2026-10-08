export interface Activity {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
}
