import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, BrainCircuit, CalendarClock, ChevronLeft, Handshake, Mail, Phone, Plus, Search, Sparkles, Target, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'negotiation' | 'won' | 'lost';
type Tab = 'dashboard' | 'leads' | 'deals' | 'activities' | 'assistant';
type Lead = { id: string; name: string; company: string | null; email: string | null; phone: string | null; status: LeadStatus; priority: string; notes: string | null; created_at: string };
type Deal = { id: string; title: string; value: number; status: LeadStatus; expected_close_date: string | null; created_at: string; crm_leads?: { name: string } | null };
type Activity = { id: string; type: string; description: string | null; due_date: string | null; completed: boolean; created_at: string; crm_leads?: { name: string } | null };

const STATUS: LeadStatus[] = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'];
const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);
const statusStyle: Record<string, string> = {
  new: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300', contacted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
  qualified: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300', negotiation: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  won: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300', lost: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
};

export default function CRM() {
  const navigate = useNavigate();
  const { user, isAdmin, isSales } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [leadResult, dealResult, activityResult] = await Promise.all([
      (supabase.from('crm_leads' as any).select('*').order('created_at', { ascending: false }) as any),
      (supabase.from('crm_deals' as any).select('*, crm_leads(name)').order('created_at', { ascending: false }) as any),
      (supabase.from('crm_activities' as any).select('*, crm_leads(name)').order('due_date', { ascending: true }) as any),
    ]);
    if (leadResult.error?.code === '42P01') {
      toast({ title: 'CRM database setup required', description: 'Run the included Supabase migration to activate CRM data.' });
    } else if (leadResult.error) {
      toast({ title: 'Could not load CRM', description: leadResult.error.message, variant: 'destructive' });
    }
    setLeads(leadResult.data || []); setDeals(dealResult.data || []); setActivities(activityResult.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const stats = useMemo(() => ({
    newLeads: leads.filter((lead) => lead.status === 'new').length,
    pipelineValue: deals.filter((deal) => !['won', 'lost'].includes(deal.status)).reduce((sum, deal) => sum + Number(deal.value || 0), 0),
    wonValue: deals.filter((deal) => deal.status === 'won').reduce((sum, deal) => sum + Number(deal.value || 0), 0),
    due: activities.filter((activity) => !activity.completed && activity.due_date && new Date(activity.due_date) <= new Date(Date.now() + 7 * 86400000)).length,
  }), [activities, deals, leads]);
  const filteredLeads = leads.filter((lead) => `${lead.name} ${lead.company || ''} ${lead.email || ''}`.toLowerCase().includes(query.toLowerCase()));

  async function createLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const values = new FormData(event.currentTarget);
    setSaving(true);
    const { error } = await (supabase.from('crm_leads' as any).insert({
      name: values.get('name'), company: values.get('company') || null, email: values.get('email') || null,
      phone: values.get('phone') || null, priority: values.get('priority') || 'medium', notes: values.get('notes') || null,
      status: 'new', owner_id: user.id, created_by: user.id,
    }) as any);
    setSaving(false);
    if (error) { toast({ title: 'Could not create lead', description: error.message, variant: 'destructive' }); return; }
    setDialogOpen(false); toast({ title: 'Lead created', description: 'The lead is ready for follow-up.' }); loadData();
  }

  async function updateStatus(lead: Lead, status: LeadStatus) {
    const { error } = await (supabase.from('crm_leads' as any).update({ status }).eq('id', lead.id) as any);
    if (error) { toast({ title: 'Could not update lead', description: error.message, variant: 'destructive' }); return; }
    setLeads((current) => current.map((item) => item.id === lead.id ? { ...item, status } : item));
  }

  const tabs: { id: Tab; label: string; icon: typeof BarChart3 }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 }, { id: 'leads', label: 'Leads', icon: Users },
    { id: 'deals', label: 'Deals', icon: Handshake }, { id: 'activities', label: 'Activities', icon: CalendarClock },
    { id: 'assistant', label: 'AI Assistant', icon: BrainCircuit },
  ];
  const canAccess = isAdmin || isSales;

  return <div className="min-h-screen bg-muted/20">
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} aria-label="Back to ATS"><ChevronLeft className="h-5 w-5" /></Button>
        <div className="min-w-0 flex-1"><p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Autsorsa</p><h1 className="text-lg font-bold">Sales CRM</h1></div>
        <Button onClick={() => setDialogOpen(true)} disabled={!canAccess}><Plus className="mr-2 h-4 w-4" />New lead</Button>
      </div>
      <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={cn('flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors', tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground')}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
    </header>
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {!canAccess && <Card className="mb-6 border-amber-300"><CardContent className="p-4 text-sm">You need a Sales or Admin role to create and manage CRM records.</CardContent></Card>}
      {tab === 'dashboard' && <Dashboard stats={stats} leads={leads} deals={deals} loading={loading} onLeads={() => setTab('leads')} />}
      {tab === 'leads' && <section className="space-y-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-bold">Leads</h2><p className="text-sm text-muted-foreground">Track prospects from first contact to conversion.</p></div><div className="relative w-full sm:w-72"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" placeholder="Search leads…" /></div></div><LeadTable leads={filteredLeads} loading={loading} onStatusChange={updateStatus} /></section>}
      {tab === 'deals' && <DealsList deals={deals} loading={loading} />}
      {tab === 'activities' && <ActivitiesList activities={activities} loading={loading} />}
      {tab === 'assistant' && <AIAssistant />}
    </main>
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent><DialogHeader><DialogTitle>Create lead</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={createLead}><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" name="name" required /><Field label="Company" name="company" /><Field label="Email" name="email" type="email" /><Field label="Phone" name="phone" /></div><div><Label htmlFor="priority">Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger id="priority"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent></Select></div><div><Label htmlFor="notes">Notes</Label><Textarea id="notes" name="notes" placeholder="Context, needs, or next step…" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button disabled={saving}>{saving ? 'Creating…' : 'Create lead'}</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

function Field({ label, name, type = 'text', required = false }: { label: string; name: string; type?: string; required?: boolean }) { return <div><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={type} required={required} /></div>; }
function Metric({ label, value, icon: Icon, accent }: { label: string; value: string; icon: typeof Target; accent: string }) { return <Card><CardContent className="flex items-center gap-4 p-5"><div className={cn('rounded-lg p-3', accent)}><Icon className="h-5 w-5" /></div><div><p className="text-sm text-muted-foreground">{label}</p><p className="text-2xl font-bold">{value}</p></div></CardContent></Card>; }
function Dashboard({ stats, leads, deals, loading, onLeads }: { stats: { newLeads: number; pipelineValue: number; wonValue: number; due: number }; leads: Lead[]; deals: Deal[]; loading: boolean; onLeads: () => void }) { return <section className="space-y-6"><div><h2 className="text-2xl font-bold">Good morning</h2><p className="text-sm text-muted-foreground">Your sales pipeline at a glance.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="New leads" value={String(stats.newLeads)} icon={Users} accent="bg-sky-100 text-sky-700" /><Metric label="Pipeline value" value={stats.pipelineValue.toLocaleString(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} icon={Target} accent="bg-violet-100 text-violet-700" /><Metric label="Won revenue" value={stats.wonValue.toLocaleString(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} icon={Handshake} accent="bg-emerald-100 text-emerald-700" /><Metric label="Due this week" value={String(stats.due)} icon={CalendarClock} accent="bg-amber-100 text-amber-700" /></div><div className="grid gap-6 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Pipeline overview</CardTitle><CardDescription>Lead distribution by stage</CardDescription></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3">{STATUS.map((status) => <button key={status} onClick={onLeads} className="rounded-lg border p-4 text-left transition-shadow hover:shadow-sm"><Badge className={cn('mb-3 border-0', statusStyle[status])}>{statusLabel(status)}</Badge><p className="text-2xl font-bold">{loading ? '—' : leads.filter((lead) => lead.status === status).length}</p><p className="text-xs text-muted-foreground">{statusLabel(status)} leads</p></button>)}</CardContent></Card><Card><CardHeader><CardTitle>Recent deals</CardTitle></CardHeader><CardContent className="space-y-4">{deals.slice(0, 4).map((deal) => <div key={deal.id} className="flex items-start justify-between gap-3"><div><p className="font-medium">{deal.title}</p><p className="text-xs text-muted-foreground">{deal.crm_leads?.name || 'Unassigned lead'}</p></div><p className="text-sm font-semibold">{Number(deal.value).toLocaleString(undefined, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</p></div>)}{!loading && deals.length === 0 && <p className="text-sm text-muted-foreground">No deals yet.</p>}</CardContent></Card></div></section>; }
function LeadTable({ leads, loading, onStatusChange }: { leads: Lead[]; loading: boolean; onStatusChange: (lead: Lead, status: LeadStatus) => void }) { return <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-4">Lead</th><th className="p-4">Contact</th><th className="p-4">Priority</th><th className="p-4">Stage</th></tr></thead><tbody>{loading ? <tr><td className="p-6 text-muted-foreground" colSpan={4}>Loading leads…</td></tr> : leads.map((lead) => <tr key={lead.id} className="border-b last:border-0"><td className="p-4"><p className="font-medium">{lead.name}</p><p className="text-xs text-muted-foreground">{lead.company || 'No company'}</p></td><td className="p-4 text-muted-foreground"><p className="flex items-center gap-1">{lead.email && <Mail className="h-3 w-3" />}{lead.email || '—'}</p><p className="flex items-center gap-1">{lead.phone && <Phone className="h-3 w-3" />}{lead.phone || ''}</p></td><td className="p-4"><Badge variant="outline" className="capitalize">{lead.priority}</Badge></td><td className="p-4"><Select value={lead.status} onValueChange={(value) => onStatusChange(lead, value as LeadStatus)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{STATUS.map((status) => <SelectItem value={status} key={status}>{statusLabel(status)}</SelectItem>)}</SelectContent></Select></td></tr>)}{!loading && !leads.length && <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}>No leads match this view. Create your first lead to start the pipeline.</td></tr>}</tbody></table></div></CardContent></Card>; }
function DealsList({ deals, loading }: { deals: Deal[]; loading: boolean }) { return <section><h2 className="mb-1 text-2xl font-bold">Deals</h2><p className="mb-5 text-sm text-muted-foreground">Revenue opportunities connected to your leads.</p><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{deals.map((deal) => <Card key={deal.id}><CardHeader><div className="flex justify-between gap-2"><CardTitle className="text-base">{deal.title}</CardTitle><Badge className={cn('border-0', statusStyle[deal.status])}>{statusLabel(deal.status)}</Badge></div><CardDescription>{deal.crm_leads?.name || 'Unassigned lead'}</CardDescription></CardHeader><CardContent><p className="text-2xl font-bold">{Number(deal.value).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}</p><p className="mt-1 text-xs text-muted-foreground">Expected close: {deal.expected_close_date || 'Not set'}</p></CardContent></Card>)}{!loading && !deals.length && <Card className="md:col-span-2 xl:col-span-3"><CardContent className="p-8 text-center text-muted-foreground">No deals yet. Convert a qualified lead into a deal from the sales workflow.</CardContent></Card>}</div></section>; }
function ActivitiesList({ activities, loading }: { activities: Activity[]; loading: boolean }) { return <section><h2 className="mb-1 text-2xl font-bold">Activities</h2><p className="mb-5 text-sm text-muted-foreground">Calls, meetings, notes, and follow-ups across your pipeline.</p><Card><CardContent className="divide-y p-0">{activities.map((activity) => <div key={activity.id} className="flex items-center gap-4 p-4"><div className="rounded-full bg-primary/10 p-2 text-primary"><CalendarClock className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="font-medium capitalize">{activity.type} <span className="font-normal text-muted-foreground">· {activity.crm_leads?.name || 'CRM record'}</span></p><p className="truncate text-sm text-muted-foreground">{activity.description || 'No description'}</p></div><div className="text-right text-xs text-muted-foreground"><p>{activity.due_date ? new Date(activity.due_date).toLocaleDateString() : 'No due date'}</p><p>{activity.completed ? 'Complete' : 'Open'}</p></div></div>)}{!loading && !activities.length && <div className="p-8 text-center text-muted-foreground">No activities yet.</div>}{loading && <div className="p-6 text-muted-foreground">Loading activities…</div>}</CardContent></Card></section>; }
function AIAssistant() { const [leadContext, setLeadContext] = useState(''); const [draft, setDraft] = useState(''); function generate() { if (!leadContext.trim()) { toast({ title: 'Add some lead context first', description: 'Include the name, company, and reason for reaching out.' }); return; } setDraft(`Subject: A quick idea for ${leadContext.split(/[,.]/)[0]}\n\nHi there,\n\nI noticed your team may be exploring ways to make hiring and candidate management more efficient. Autsorsa gives teams a clear, collaborative view of every opportunity without the spreadsheet overhead.\n\nWould a short conversation next week be useful?\n\nBest regards,`); } return <section className="mx-auto max-w-3xl"><div className="mb-6"><div className="mb-2 flex items-center gap-2"><Sparkles className="h-6 w-6 text-primary" /><h2 className="text-2xl font-bold">AI Sales Assistant</h2></div><p className="text-sm text-muted-foreground">Draft outreach and surface the next best action. This module is ready for a production AI provider connection.</p></div><Card><CardHeader><CardTitle>Draft outreach email</CardTitle><CardDescription>Describe the lead, their company, and the purpose of your outreach.</CardDescription></CardHeader><CardContent className="space-y-4"><Textarea value={leadContext} onChange={(e) => setLeadContext(e.target.value)} rows={4} placeholder="Example: Maria at Acme, growing their recruitment team and currently tracking candidates in spreadsheets." /><Button onClick={generate}><Sparkles className="mr-2 h-4 w-4" />Generate draft</Button>{draft && <div className="rounded-lg border bg-muted/30 p-4 whitespace-pre-wrap text-sm leading-6">{draft}</div>}</CardContent></Card></section>; }
