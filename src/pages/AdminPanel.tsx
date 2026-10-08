import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, ShieldCheck, ShieldOff, Loader2, Briefcase, Pencil, Check, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';

import { AdminSecurityAlerts } from '@/components/ats/AdminSecurityAlerts';
import { AdminUserSessions } from '@/components/ats/AdminUserSessions';
import { AdminStorageScanner } from '@/components/ats/AdminStorageScanner';

interface AppUser {
  id: string;
  email: string;
  name: string;
  created_at: string;
  roles: string[];
}

interface CleanupPreview {
  emptyPositions: { id: string; title: string; company_name: string }[];
  orphanCompanies: { id: string; name: string }[];
}

export default function AdminPanel() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<AppUser | null>(null);
  const [togglingRole, setTogglingRole] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [editEmailValue, setEditEmailValue] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Cleanup state
  const [cleanupPreview, setCleanupPreview] = useState<CleanupPreview | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupConfirmOpen, setCleanupConfirmOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').then(({ data }) => {
      setIsAdmin(!!data && data.length > 0);
    });
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    const load = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/admin-users?action=list`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        toast({ title: 'Error', description: 'Failed to load users', variant: 'destructive' });
      }
      setLoading(false);
    };
    load();
  }, [isAdmin]);

  const handleDelete = async (u: AppUser) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/admin-users?action=delete`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: u.id }),
      }
    );

    if (res.ok) {
      setUsers(prev => prev.filter(x => x.id !== u.id));
      toast({ title: 'User deleted' });
    } else {
      const err = await res.json();
      toast({ title: 'Error', description: err.error, variant: 'destructive' });
    }
  };

  const handleToggleRole = async (u: AppUser, role: string) => {
    setTogglingRole(u.id + role);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setTogglingRole(null); return; }

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/admin-users?action=toggle-role`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: u.id, role }),
      }
    );

    if (res.ok) {
      setUsers(prev => prev.map(x => {
        if (x.id !== u.id) return x;
        const hasRole = x.roles.includes(role);
        return { ...x, roles: hasRole ? x.roles.filter(r => r !== role) : [...x.roles, role] };
      }));
      const hasRole = u.roles.includes(role);
      toast({ title: `${u.name || u.email}: ${role} ${hasRole ? 'removed' : 'granted'}` });
    } else {
      const err = await res.json();
      toast({ title: 'Error', description: err.error, variant: 'destructive' });
    }
    setTogglingRole(null);
  };

  const handleChangeEmail = async (u: AppUser) => {
    const newEmail = editEmailValue.trim();
    if (!newEmail || newEmail === u.email) {
      setEditingEmail(null);
      return;
    }
    setSavingEmail(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSavingEmail(false); return; }

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/admin-users?action=change-email`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: u.id, newEmail }),
      }
    );

    if (res.ok) {
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, email: newEmail } : x));
      toast({ title: 'Email updated', description: `${u.name || 'User'}'s email changed to ${newEmail}` });
      setEditingEmail(null);
    } else {
      const err = await res.json();
      toast({ title: 'Error', description: err.error || 'Failed to change email', variant: 'destructive' });
    }
    setSavingEmail(false);
  };

  const scanForCleanup = useCallback(async () => {
    setScanning(true);
    try {
      // Get all positions with candidate counts (exclude soft-deleted)
      const { data: allPositions } = await supabase.from('positions').select('id, title, company_id').is('deleted_at', null);
      const { data: allCandidates } = await supabase.from('candidates').select('position_id').is('deleted_at', null);
      const { data: allCompanies } = await supabase.from('companies').select('id, name').is('deleted_at', null);

      if (!allPositions || !allCandidates || !allCompanies) {
        toast({ title: 'Error', description: 'Failed to scan data', variant: 'destructive' });
        setScanning(false);
        return;
      }

      const candidatesByPos = new Map<string, number>();
      for (const c of allCandidates) {
        candidatesByPos.set(c.position_id, (candidatesByPos.get(c.position_id) || 0) + 1);
      }

      const companyMap = new Map(allCompanies.map(c => [c.id, c.name]));

      // Empty positions = 0 candidates
      const emptyPositions = allPositions
        .filter(p => !candidatesByPos.has(p.id))
        .map(p => ({ id: p.id, title: p.title, company_name: companyMap.get(p.company_id) || 'Unknown' }));

      // After removing empty positions, find companies with no remaining positions
      const emptyPosIds = new Set(emptyPositions.map(p => p.id));
      const remainingPosByCompany = new Map<string, number>();
      for (const p of allPositions) {
        if (!emptyPosIds.has(p.id)) {
          remainingPosByCompany.set(p.company_id, (remainingPosByCompany.get(p.company_id) || 0) + 1);
        }
      }

      const orphanCompanies = allCompanies
        .filter(c => !remainingPosByCompany.has(c.id))
        .map(c => ({ id: c.id, name: c.name }));

      setCleanupPreview({ emptyPositions, orphanCompanies });
    } catch {
      toast({ title: 'Error', description: 'Scan failed', variant: 'destructive' });
    }
    setScanning(false);
  }, []);

  const executeCleanup = useCallback(async () => {
    if (!cleanupPreview) return;
    setCleaning(true);

    let deletedPositions = 0;
    let deletedCompanies = 0;

    // Soft-delete empty positions first
    if (cleanupPreview.emptyPositions.length > 0) {
      const posIds = cleanupPreview.emptyPositions.map(p => p.id);
      const { error } = await supabase.from('positions').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).in('id', posIds);
      if (!error) deletedPositions = posIds.length;
    }

    // Soft-delete orphan companies
    if (cleanupPreview.orphanCompanies.length > 0) {
      const compIds = cleanupPreview.orphanCompanies.map(c => c.id);
      // Also soft-delete stages for these companies
      await supabase.from('stages').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).in('company_id', compIds);
      const { error } = await supabase.from('companies').update({ deleted_at: new Date().toISOString(), deleted_by: user?.id } as any).in('id', compIds);
      if (!error) deletedCompanies = compIds.length;
    }

    toast({
      title: 'Cleanup complete',
      description: `Removed ${deletedPositions} position(s) and ${deletedCompanies} company/ies.`,
    });

    setCleanupPreview(null);
    setCleaning(false);
    setCleanupConfirmOpen(false);
  }, [cleanupPreview]);

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground p-4">Access denied.</p>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">User Management</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading users...</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name || '—'}</TableCell>
                    <TableCell>
                      {editingEmail === u.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editEmailValue}
                            onChange={e => setEditEmailValue(e.target.value)}
                            className="h-7 text-sm w-48"
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleChangeEmail(u);
                              if (e.key === 'Escape') setEditingEmail(null);
                            }}
                            autoFocus
                            disabled={savingEmail}
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleChangeEmail(u)} disabled={savingEmail}>
                            {savingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-green-600" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingEmail(null)} disabled={savingEmail}>
                            <X className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <span>{u.email}</span>
                          {u.id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => { setEditingEmail(u.id); setEditEmailValue(u.email); }}
                            >
                              <Pencil className="h-3 w-3 text-muted-foreground" />
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {u.roles.includes('admin') && (
                          <Badge variant="default" className="text-xs">admin</Badge>
                        )}
                        {u.roles.includes('sales') && (
                          <Badge variant="secondary" className="text-xs">sales</Badge>
                        )}
                        {u.roles.length === 0 && (
                          <Badge variant="outline" className="text-xs">user</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(u.created_at), 'dd MMM yyyy')}</TableCell>
                    <TableCell>
                      {u.id !== user?.id && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleRole(u, 'admin')}
                            disabled={togglingRole === u.id + 'admin'}
                            title={u.roles.includes('admin') ? 'Remove admin' : 'Make admin'}
                          >
                            {u.roles.includes('admin') ? (
                              <ShieldOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleRole(u, 'sales')}
                            disabled={togglingRole === u.id + 'sales'}
                            title={u.roles.includes('sales') ? 'Remove sales access' : 'Grant sales access'}
                          >
                            <Briefcase className={`h-4 w-4 ${u.roles.includes('sales') ? 'text-primary' : 'text-muted-foreground'}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(u)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Data Cleanup Section */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">Data Cleanup</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Scan for empty positions (0 candidates) and orphaned companies. Only safe deletions are performed.
        </p>

        {!cleanupPreview ? (
          <Button onClick={scanForCleanup} disabled={scanning} variant="outline">
            {scanning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {scanning ? 'Scanning...' : 'Scan for cleanup'}
          </Button>
        ) : (
          <div className="space-y-4">
            {cleanupPreview.emptyPositions.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Empty Positions ({cleanupPreview.emptyPositions.length})
                </h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {cleanupPreview.emptyPositions.map(p => (
                    <div key={p.id} className="text-xs text-muted-foreground flex gap-2">
                      <span className="font-medium text-foreground">{p.title}</span>
                      <span>· {p.company_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cleanupPreview.orphanCompanies.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">
                  Orphaned Companies ({cleanupPreview.orphanCompanies.length})
                </h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {cleanupPreview.orphanCompanies.map(c => (
                    <div key={c.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cleanupPreview.emptyPositions.length === 0 && cleanupPreview.orphanCompanies.length === 0 && (
              <p className="text-sm text-muted-foreground">No cleanup needed — all data is valid.</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCleanupPreview(null)}>Cancel</Button>
              {(cleanupPreview.emptyPositions.length > 0 || cleanupPreview.orphanCompanies.length > 0) && (
                <Button
                  variant="destructive"
                  onClick={() => setCleanupConfirmOpen(true)}
                  disabled={cleaning}
                >
                  {cleaning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Delete {cleanupPreview.emptyPositions.length + cleanupPreview.orphanCompanies.length} item(s)
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Storage Scanner */}
      <AdminStorageScanner />

      {/* User Sessions */}
      <AdminUserSessions />

      {/* Security Alerts */}
      <AdminSecurityAlerts />


      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Delete User"
        description={`Delete "${deleteConfirm?.name || deleteConfirm?.email}"? This will revoke their access permanently.`}
        onConfirm={() => { if (deleteConfirm) { handleDelete(deleteConfirm); setDeleteConfirm(null); } }}
      />

      <ConfirmDialog
        open={cleanupConfirmOpen}
        onOpenChange={setCleanupConfirmOpen}
        title="Confirm Cleanup"
        description={`This will permanently delete ${cleanupPreview?.emptyPositions.length ?? 0} empty position(s) and ${cleanupPreview?.orphanCompanies.length ?? 0} orphaned company/ies. This cannot be undone.`}
        onConfirm={executeCleanup}
      />
    </div>
  );
}