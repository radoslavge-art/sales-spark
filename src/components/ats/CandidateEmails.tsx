import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Mail, Plus, Send, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';

interface EmailEntry {
  id: string;
  candidate_id: string;
  user_id: string;
  subject: string;
  content: string;
  created_at: string;
  userName?: string;
}

interface Props {
  candidateId: string;
}

export function CandidateEmails({ candidateId }: Props) {
  const { user } = useAuth();
  const [emails, setEmails] = useState<EmailEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchEmails();
  }, [candidateId]);

  const fetchEmails = async () => {
    const { data } = await (supabase
      .from('candidate_emails' as any)
      .select('*')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false }) as any);
    if (!data) { setEmails([]); return; }
    const userIds = [...new Set((data as any[]).map(e => e.user_id))];
    const { data: profiles } = await (supabase
      .from('profiles' as any)
      .select('id, name')
      .in('id', userIds) as any);
    const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
    setEmails((data as any[]).map(e => ({ ...e, userName: nameMap.get(e.user_id) || 'Unknown' })));
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !user) return;
    setSubmitting(true);
    try {
      await (supabase.from('candidate_emails' as any).insert({
        candidate_id: candidateId,
        user_id: user.id,
        subject: subject.trim(),
        content: content.trim(),
      }) as any);
      setSubject('');
      setContent('');
      setShowForm(false);
      await fetchEmails();
      toast({ title: 'Email logged' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    await (supabase.from('candidate_emails' as any).delete().eq('id', id) as any);
    setEmails(prev => prev.filter(e => e.id !== id));
  };

  return (
    <div className="space-y-3">
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setShowForm(!showForm)}
      >
        <Plus className="h-4 w-4 mr-2" />
        {showForm ? 'Cancel' : '+ Log Email'}
      </Button>

      {showForm && (
        <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/20">
          <Input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject..."
            className="text-sm"
            autoFocus
          />
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="Email content..."
            rows={4}
            className="text-sm"
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!subject.trim() || submitting}
            className="w-full"
          >
            <Send className="h-3.5 w-3.5 mr-2" />
            Save Email Log
          </Button>
        </div>
      )}

      {emails.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-8 text-center">
          <Mail className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground/60">No emails logged yet</p>
        </div>
      )}

      {emails.map(email => (
        <div key={email.id} className="group">
          <button
            onClick={() => setExpanded(expanded === email.id ? null : email.id)}
            className="w-full text-left p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{email.subject}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {email.userName} · {formatDistanceToNow(new Date(email.created_at), { addSuffix: true })}
                </p>
                {expanded !== email.id && email.content && (
                  <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">{email.content.slice(0, 100)}{email.content.length > 100 ? '...' : ''}</p>
                )}
              </div>
              {email.user_id === user?.id && (
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(email.id); }}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity shrink-0 mt-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </button>
          {expanded === email.id && email.content && (
            <div className="px-3 py-2 text-sm text-foreground/80 whitespace-pre-line border-x border-b border-border rounded-b-lg bg-muted/10 -mt-px">
              {email.content}
            </div>
          )}
          <Separator className="mt-2" />
        </div>
      ))}
    </div>
  );
}
