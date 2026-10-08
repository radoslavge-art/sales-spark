import { toast } from 'sonner';

/**
 * Validate board task data before insert.
 * Returns true if valid, false otherwise (shows toast on failure).
 */
export function validateTaskInsert(params: {
  title: string;
  columnId: string;
  userId?: string;
  boardId?: string;
  isDefault: boolean;
  isShared: boolean;
}): boolean {
  const { title, columnId, userId, boardId, isDefault, isShared } = params;

  if (!title || !title.trim()) {
    toast.error('Task title cannot be empty');
    return false;
  }

  if (title.trim().length > 500) {
    toast.error('Task title is too long (max 500 characters)');
    return false;
  }

  if (!columnId) {
    console.error('[Validation] Missing column_id for task insert');
    toast.error('Invalid column — please refresh and try again');
    return false;
  }

  if (isDefault && !userId) {
    console.error('[Validation] Missing user_id for personal task insert');
    toast.error('Authentication required');
    return false;
  }

  if (isShared && !boardId) {
    console.error('[Validation] Missing board_id for shared task insert');
    toast.error('No board selected');
    return false;
  }

  return true;
}

/**
 * Validate candidate-to-board addition.
 */
export function validateCandidateInsert(params: {
  candidateId: string;
  candidateName: string;
  columnId: string;
  userId?: string;
  boardId?: string;
  isDefault: boolean;
  isShared: boolean;
  existingTasks?: Array<{ candidate_id: string | null; column_id: string | null }>;
}): boolean {
  const { candidateId, candidateName, columnId, userId, boardId, isDefault, isShared, existingTasks } = params;

  if (!candidateId) {
    toast.error('Invalid candidate');
    return false;
  }

  if (!candidateName?.trim()) {
    toast.error('Candidate name is missing');
    return false;
  }

  // Check for duplicate candidate in the same column
  if (existingTasks?.some(t => t.candidate_id === candidateId && t.column_id === columnId)) {
    toast.error('This candidate is already in this column');
    return false;
  }

  return validateTaskInsert({ title: candidateName, columnId, userId, boardId, isDefault, isShared });
}

/**
 * Validate column creation.
 */
export function validateColumnInsert(params: {
  label: string;
  userId?: string;
  boardId?: string;
  isDefault: boolean;
  isShared: boolean;
  existingLabels?: string[];
}): boolean {
  const { label, userId, boardId, isDefault, isShared, existingLabels } = params;

  if (!label || !label.trim()) {
    toast.error('Column name cannot be empty');
    return false;
  }

  if (label.trim().length > 100) {
    toast.error('Column name is too long (max 100 characters)');
    return false;
  }

  if (existingLabels?.some(l => l.toLowerCase() === label.trim().toLowerCase())) {
    toast.error('A column with this name already exists');
    return false;
  }

  if (isDefault && !userId) {
    toast.error('Authentication required');
    return false;
  }

  if (isShared && !boardId) {
    toast.error('No board selected');
    return false;
  }

  return true;
}
