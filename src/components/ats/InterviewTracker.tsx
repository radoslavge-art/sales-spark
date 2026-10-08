import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { CalendarDays, Plus, X, CheckCircle2, Clock, XCircle, CalendarSync } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import { logAuditActivity } from '@/lib/logAuditActivity';

interface Interview {
  id: string;
  candidate_id: string;
  user_id: string;
  title: string;
  scheduled_at: string;
  status: string;
  notes: string;
  created_at: string;
  google_event_id?: string | null;
}

interface Props {
  candidateId: string;
  candidateName?: string;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  scheduled: { icon: Clock, label: 'Scheduled', variant: 'default' },
  completed: { icon: CheckCircle2, label: 'Completed', variant: 'secondary' },
  canceled: { icon: XCircle, label: 'Canceled', variant: 'destructive' },
};

export function InterviewTracker({ candidateId, candidateName }: Props) {
  const { user } = useAuth();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState('10:00');
  const [notes, setNotes] = useState('');
  const [syncCalendar, setSyncCalendar] = useState(false);
  const [hasCalendarToken, setHasCalendarToken] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    fetchInterviews();
    checkCalendarToken();
  }, [candidateId]);

  const checkCalendarToken = async () => {
    if (!user) return;
    const { data } = await (supabase
      .from('google_calendar_tokens' as any)
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle() as any);
    setHasCalendarToken(!!data);
  };

  const fetchInterviews = async () => {
    const { data } = await (supabase
      .from('interviews' as any)
      .select('*')
      .eq('candidate_id', candidateId)
      .order('scheduled_at', { ascending: true }) as any);
    setInterviews((data || []) as Interview[]);
  };

  const syncToGoogleCalendar = async (interviewData: { title: string; startTime: string; description: string }) => {
    try {
      const { data, error } = await supabase.functions.invoke('google-calendar', {
        body: {
          action: 'create-event',
          title: interviewData.title,
          description: interviewData.description,
          startTime: interviewData.startTime,
        },
      });
      if (error) throw error;
      return data?.eventId || null;
    } catch (err: any) {
      toast({ title: 'Calendar sync failed', description: err.message, variant: 'destructive' });
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !date || !user) return;
    setSubmitting(true);
    try {
      const [hours, minutes] = time.split(':').map(Number);
      const scheduledAt = new Date(date);
      scheduledAt.setHours(hours, minutes, 0, 0);

      let googleEventId: string | null = null;

      if (syncCalendar && hasCalendarToken) {
        googleEventId = await syncToGoogleCalendar({
          title: title.trim(),
          startTime: scheduledAt.toISOString(),
          description: candidateName ? `Interview with ${candidateName}\n${notes.trim()}` : notes.trim(),
        });
      }

      await (supabase.from('interviews' as any).insert({
        candidate_id: candidateId,
        user_id: user.id,
        title: title.trim(),
        scheduled_at: scheduledAt.toISOString(),
        notes: notes.trim(),
        status: 'scheduled',
        google_event_id: googleEventId,
      }) as any);

      setTitle('');
      setDate(undefined);
      setTime('10:00');
      setNotes('');
      setSyncCalendar(false);
      setShowForm(false);
      await fetchInterviews();
      toast({ title: googleEventId ? 'Interview scheduled & synced to Google Calendar' : 'Interview scheduled' });
      logAuditActivity({ action: 'create_interview', entity_type: 'interview', entity_id: candidateId, metadata: { title: title.trim(), scheduled_at: scheduledAt.toISOString(), candidate_name: candidateName } });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    await (supabase.from('interviews' as any).update({ status }).eq('id', id) as any);
    setInterviews(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    logAuditActivity({ action: 'update_interview', entity_type: 'interview', entity_id: id, metadata: { new_status: status } });
  };

  const handleNotesAutosave = useCallback((id: string, value: string) => {
    setEditNoteText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      await (supabase.from('interviews' as any).update({ notes: value }).eq('id', id) as any);
      setInterviews(prev => prev.map(i => i.id === id ? { ...i, notes: value } : i));
    }, 500);
  }, []);

  const handleDelete = async (interview: Interview) => {
    // Delete Google Calendar event if synced
    if (interview.google_event_id) {
      try {
        await supabase.functions.invoke('google-calendar', {
          body: { action: 'delete-event', eventId: interview.google_event_id },
        });
      } catch {
        // Continue with local delete even if calendar delete fails
      }
    }
    await (supabase.from('interviews' as any).delete().eq('id', interview.id) as any);
    setInterviews(prev => prev.filter(i => i.id !== interview.id));
    logAuditActivity({ action: 'delete_interview', entity_type: 'interview', entity_id: interview.id, metadata: { title: interview.title } });
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
        {showForm ? 'Cancel' : '+ Schedule Interview'}
      </Button>

      {showForm && (
        <div className="space-y-2 p-3 border border-border rounded-lg bg-muted/20">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Interview title..."
            className="text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("flex-1 justify-start text-left font-normal", !date && "text-muted-foreground")}
                >
                  <CalendarDays className="h-3.5 w-3.5 mr-2" />
                  {date ? format(date, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Input
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="w-28 text-sm"
            />
          </div>
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)..."
            rows={2}
            className="text-sm"
          />
          {hasCalendarToken && (
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="sync-calendar"
                checked={syncCalendar}
                onCheckedChange={(v) => setSyncCalendar(v === true)}
              />
              <label htmlFor="sync-calendar" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" />
                Sync with Google Calendar
              </label>
            </div>
          )}
          {!hasCalendarToken && (
            <p className="text-[10px] text-muted-foreground/60 px-1">
              Connect Google Calendar in Settings to enable sync
            </p>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!title.trim() || !date || submitting}
            className="w-full"
          >
            Schedule
          </Button>
        </div>
      )}

      {interviews.length === 0 && !showForm && (
        <div className="flex flex-col items-center py-8 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground/60">No interviews scheduled</p>
        </div>
      )}

      {interviews.map(interview => {
        const cfg = STATUS_CONFIG[interview.status] || STATUS_CONFIG.scheduled;
        const Icon = cfg.icon;
        const isPast = new Date(interview.scheduled_at) < new Date();

        return (
          <div key={interview.id} className="group p-3 rounded-lg border border-border bg-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{interview.title}</p>
                  <Badge variant={cfg.variant} className="text-[10px] gap-1">
                    <Icon className="h-3 w-3" />
                    {cfg.label}
                  </Badge>
                  {interview.google_event_id && (
                    <Badge variant="outline" className="text-[9px] gap-1 text-muted-foreground">
                      <CalendarDays className="h-2.5 w-2.5" />
                      Synced
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {format(new Date(interview.scheduled_at), 'PPP · HH:mm')}
                  {isPast && interview.status === 'scheduled' && (
                    <span className="text-amber-500 ml-1">(overdue)</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Select value={interview.status} onValueChange={v => handleStatusChange(interview.id, v)}>
                  <SelectTrigger className="h-7 w-[110px] text-[11px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="canceled">Canceled</SelectItem>
                  </SelectContent>
                </Select>
                {interview.user_id === user?.id && (
                  <button
                    onClick={() => handleDelete(interview)}
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive/80 transition-opacity"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
            {editingNotes === interview.id ? (
              <Textarea
                value={editNoteText}
                onChange={e => handleNotesAutosave(interview.id, e.target.value)}
                onBlur={() => setEditingNotes(null)}
                autoFocus
                rows={2}
                className="text-xs mt-2"
                placeholder="Add notes..."
              />
            ) : (
              <button
                onClick={() => { setEditingNotes(interview.id); setEditNoteText(interview.notes); }}
                className="w-full text-left mt-2"
              >
                {interview.notes ? (
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{interview.notes}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/50 italic">Click to add notes...</p>
                )}
              </button>
            )}
            <Separator className="mt-2" />
          </div>
        );
      })}
    </div>
  );
}
