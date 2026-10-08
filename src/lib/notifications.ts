import { supabase } from '@/integrations/supabase/client';

interface CreateNotificationParams {
  userId: string;
  type: 'mention' | 'comment' | 'interview' | 'info';
  entityType: string;
  entityId?: string;
  content: string;
}

export async function createNotification({
  userId,
  type,
  entityType,
  entityId,
  content,
}: CreateNotificationParams) {
  try {
    await (supabase.from('notifications' as any).insert({
      user_id: userId,
      type,
      entity_type: entityType,
      entity_id: entityId || null,
      content,
    }) as any);
  } catch (err) {
    console.error('Failed to create notification:', err);
  }
}

/**
 * Parse @mentions from comment content and create notifications for mentioned users.
 * profilesMap: Map<userId, name>
 */
export async function notifyMentions(
  commentContent: string,
  authorName: string,
  candidateId: string,
  profilesMap: Map<string, string>,
  authorId: string
) {
  const mentionPattern = /@(\w[\w\s]*?\b)/g;
  const mentions = [...commentContent.matchAll(mentionPattern)].map(m => m[1].trim());
  if (mentions.length === 0) return;

  // Reverse lookup: name -> userId
  const nameToId = new Map<string, string>();
  profilesMap.forEach((name, id) => {
    nameToId.set(name.toLowerCase(), id);
  });

  for (const mention of mentions) {
    const userId = nameToId.get(mention.toLowerCase());
    if (userId && userId !== authorId) {
      await createNotification({
        userId,
        type: 'mention',
        entityType: 'candidate',
        entityId: candidateId,
        content: `${authorName} mentioned you in a comment`,
      });
    }
  }
}

/**
 * Notify about a new comment on a candidate (for involved users).
 */
export async function notifyComment(
  candidateId: string,
  authorName: string,
  authorId: string,
  candidateName: string
) {
  // Find other users who have commented on this candidate
  const { data: existingComments } = await (supabase
    .from('candidate_comments' as any)
    .select('user_id')
    .eq('candidate_id', candidateId) as any);

  if (!existingComments) return;

  const involvedUserIds = [...new Set((existingComments as any[]).map(c => c.user_id))];
  
  for (const userId of involvedUserIds) {
    if (userId === authorId) continue;
    await createNotification({
      userId,
      type: 'comment',
      entityType: 'candidate',
      entityId: candidateId,
      content: `${authorName} commented on ${candidateName}`,
    });
  }
}

/**
 * Notify about interview scheduling.
 */
export async function notifyInterviewScheduled(
  candidateId: string,
  candidateName: string,
  interviewTitle: string,
  scheduledBy: string,
  scheduledByName: string,
  notifyUserIds: string[]
) {
  for (const userId of notifyUserIds) {
    if (userId === scheduledBy) continue;
    await createNotification({
      userId,
      type: 'interview',
      entityType: 'candidate',
      entityId: candidateId,
      content: `Interview "${interviewTitle}" scheduled for ${candidateName}`,
    });
  }
}
