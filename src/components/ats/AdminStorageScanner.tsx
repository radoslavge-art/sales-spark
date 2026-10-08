import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { r2Delete } from '@/lib/r2Storage';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, HardDrive, Trash2, Check, FileText, Database } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Progress } from '@/components/ui/progress';

const STORAGE_LIMIT_MB = 10240; // 10 GB

interface Attachment {
  id: string;
  candidate_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  candidate_name?: string;
  has_activity?: boolean;
}

interface DuplicateGroup {
  key: string;
  fileName: string;
  fileSize: number;
  items: Attachment[];
  resolved: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AdminStorageScanner() {
  const { t } = useLanguage();
  const [scanning, setScanning] = useState(false);
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ groupKey: string; attachmentId: string; fileName: string } | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [storageUsedBytes, setStorageUsedBytes] = useState<number | null>(null);

  const fetchStorageUsage = useCallback(async () => {
    const { data, error } = await supabase
      .from('candidate_attachments')
      .select('file_size')
      .is('deleted_at', null);
    if (!error && data) {
      setStorageUsedBytes(data.reduce((sum, r) => sum + (r.file_size || 0), 0));
    }
  }, []);

  useEffect(() => { fetchStorageUsage(); }, [fetchStorageUsage]);

  const scan = useCallback(async () => {
    setScanning(true);
    setGroups(null);

    try {
      const { data: attachments, error } = await supabase
        .from('candidate_attachments')
        .select('id, candidate_id, file_name, file_path, file_size, mime_type, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!attachments || attachments.length === 0) {
        setGroups([]);
        setScanning(false);
        return;
      }

      // Build duplicate groups
      const map = new Map<string, Attachment[]>();
      for (const a of attachments) {
        const key = `${a.file_name}__${a.file_size}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a as Attachment);
      }

      const dupeGroups: DuplicateGroup[] = [];
      for (const [key, items] of map.entries()) {
        if (items.length < 2) continue;
        dupeGroups.push({ key, fileName: items[0].file_name, fileSize: items[0].file_size, items, resolved: false });
      }

      if (dupeGroups.length === 0) {
        setGroups([]);
        setScanning(false);
        return;
      }

      // Fetch candidate names
      const candidateIds = [...new Set(dupeGroups.flatMap(g => g.items.map(i => i.candidate_id)))];
      if (candidateIds.length > 0) {
        const { data: candidates } = await supabase.from('candidates').select('id, name').in('id', candidateIds);
        if (candidates) {
          const nameMap = new Map(candidates.map(c => [c.id, c.name]));
          for (const g of dupeGroups) {
            for (const item of g.items) {
              item.candidate_name = nameMap.get(item.candidate_id) || 'Unknown';
            }
          }

          // Check for activity on each candidate (comments, emails, interviews)
          const [commentsRes, emailsRes, interviewsRes] = await Promise.all([
            supabase.from('candidate_comments').select('candidate_id').in('candidate_id', candidateIds).is('deleted_at', null),
            supabase.from('candidate_emails').select('candidate_id').in('candidate_id', candidateIds),
            supabase.from('interviews').select('candidate_id').in('candidate_id', candidateIds),
          ]);

          const activeCandidates = new Set<string>();
          for (const row of commentsRes.data || []) activeCandidates.add(row.candidate_id);
          for (const row of emailsRes.data || []) activeCandidates.add(row.candidate_id);
          for (const row of interviewsRes.data || []) activeCandidates.add(row.candidate_id);

          for (const g of dupeGroups) {
            for (const item of g.items) {
              item.has_activity = activeCandidates.has(item.candidate_id);
            }
          }
        }
      }

      setGroups(dupeGroups);
    } catch (err) {
      toast({ title: t('common.error'), description: t('storageScanner.scanFailed'), variant: 'destructive' });
    }
    setScanning(false);
  }, [t]);

  const handleDelete = async (groupKey: string, attachmentId: string) => {
    setDeleting(attachmentId);
    try {
      const group = groups?.find(g => g.key === groupKey);
      const attachment = group?.items.find(i => i.id === attachmentId);
      if (!attachment) return;

      // Remove from R2 storage
      await r2Delete([attachment.file_path]);

      // Hard-delete the DB row (not soft-delete) to ensure rescan works
      const { error: deleteError } = await supabase
        .from('candidate_attachments')
        .delete()
        .eq('id', attachmentId);

      if (deleteError) {
        console.error('Failed to delete attachment row:', deleteError);
        toast({ title: t('common.error'), description: deleteError.message, variant: 'destructive' });
        setDeleting(null);
        return;
      }

      setGroups(prev => prev?.map(g => {
        if (g.key !== groupKey) return g;
        const remaining = g.items.filter(i => i.id !== attachmentId);
        return { ...g, items: remaining, resolved: remaining.length < 2 };
      }) ?? null);

      toast({ title: t('common.success'), description: t('storageScanner.deleted', { name: attachment.file_name }) });
      fetchStorageUsage();
    } catch (err) {
      toast({ title: t('common.error'), description: t('storageScanner.deleteFailed'), variant: 'destructive' });
    }
    setDeleting(null);
    setConfirmDelete(null);
  };

  const handleKeepBoth = (groupKey: string) => {
    setGroups(prev => prev?.map(g => g.key === groupKey ? { ...g, resolved: true } : g) ?? null);
  };

  const handleDeleteAllDuplicates = async () => {
    if (!groups) return;
    setDeletingAll(true);
    let deletedCount = 0;

    try {
      for (const g of groups) {
        if (g.resolved || g.items.length < 2) continue;

        // Only delete items with NO activity; keep oldest + any with activity
        const oldest = g.items[0];
        const rest = g.items.slice(1);

        for (const item of rest) {
          if (item.has_activity) continue; // skip items with candidate activity

          await r2Delete([item.file_path]);
          const { error } = await supabase
            .from('candidate_attachments')
            .delete()
            .eq('id', item.id);

          if (error) {
            console.error('Failed to delete:', item.id, error);
            continue;
          }
          deletedCount++;
        }
      }

      // Update UI state
      setGroups(prev => prev?.map(g => {
        if (g.resolved || g.items.length < 2) return g;
        const kept = [g.items[0], ...g.items.slice(1).filter(i => i.has_activity)];
        return { ...g, items: kept, resolved: kept.length < 2 };
      }) ?? null);

      toast({ title: t('common.success'), description: `Deleted ${deletedCount} duplicate file(s).` });
      fetchStorageUsage();
    } catch (err) {
      toast({ title: t('common.error'), description: t('storageScanner.deleteFailed'), variant: 'destructive' });
    }
    setDeletingAll(false);
    setConfirmDeleteAll(false);
  };

  const unresolvedCount = groups?.filter(g => !g.resolved).length ?? 0;
  const totalWaste = groups?.filter(g => !g.resolved).reduce((sum, g) => sum + g.fileSize * (g.items.length - 1), 0) ?? 0;

  const usedMB = storageUsedBytes !== null ? storageUsedBytes / (1024 * 1024) : null;
  const usedPercent = usedMB !== null ? Math.min((usedMB / STORAGE_LIMIT_MB) * 100, 100) : null;

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-2">{t('storageScanner.title')}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t('storageScanner.description')}</p>

      {/* Storage Usage Tracker */}
      {storageUsedBytes !== null && (
        <div className="mb-5 border rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Database className="h-4 w-4 text-muted-foreground" />
            Storage Usage
          </div>
          <Progress value={usedPercent!} className="h-2.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{usedMB!.toFixed(1)} MB used</span>
            <span>{usedPercent!.toFixed(1)}% of {STORAGE_LIMIT_MB >= 1024 ? `${(STORAGE_LIMIT_MB / 1024).toFixed(0)} GB` : `${STORAGE_LIMIT_MB} MB`}</span>
          </div>
        </div>
      )}

      {groups === null ? (
        <Button onClick={scan} disabled={scanning} variant="outline">
          {scanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDrive className="h-4 w-4 mr-2" />}
          {scanning ? t('storageScanner.scanning') : t('storageScanner.scanForDuplicates')}
        </Button>
      ) : groups.length === 0 ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">✅ {t('storageScanner.noDuplicates')}</p>
          <Button variant="outline" size="sm" onClick={() => setGroups(null)}>{t('storageScanner.scanAgain')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="secondary" className="gap-1">
              <FileText className="h-3 w-3" /> {t('storageScanner.duplicateGroups', { count: groups.length })}
            </Badge>
            {unresolvedCount > 0 && (
              <Badge variant="outline" className="gap-1">
                {t('storageScanner.unresolved', { count: unresolvedCount, size: formatBytes(totalWaste) })}
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setGroups(null)}>{t('storageScanner.rescan')}</Button>
            {unresolvedCount > 0 && (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1"
                disabled={deletingAll}
                onClick={() => setConfirmDeleteAll(true)}
              >
                {deletingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete All Duplicates
              </Button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto space-y-3 pr-2">
            {groups.map(g => (
              <div
                key={g.key}
                className={`border rounded-lg p-4 transition-all ${g.resolved ? 'opacity-50 border-border' : 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/10'}`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(g.fileSize)} · {t('storageScanner.copies', { count: g.items.length })}</p>
                  </div>
                  {g.resolved && (
                    <Badge variant="secondary" className="gap-1 text-xs shrink-0">
                      <Check className="h-3 w-3" /> {t('storageScanner.resolved')}
                    </Badge>
                  )}
                </div>

                <div className="space-y-2 ml-6">
                  {g.items.map(item => (
                    <div key={item.id} className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-foreground truncate max-w-[200px]">{item.candidate_name}</span>
                      {item.has_activity && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">has activity</Badge>
                      )}
                      <span className="text-muted-foreground truncate flex-1">{new Date(item.created_at).toLocaleDateString()}</span>
                      {!g.resolved && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive gap-1"
                          disabled={deleting === item.id}
                          onClick={() => setConfirmDelete({ groupKey: g.key, attachmentId: item.id, fileName: g.fileName })}
                        >
                          {deleting === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                          {t('common.delete')}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {!g.resolved && (
                  <div className="mt-3 ml-6">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleKeepBoth(g.key)}>
                      <Check className="h-3 w-3" /> {t('storageScanner.keepAll')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title={t('storageScanner.deleteDuplicate')}
        description={t('storageScanner.deleteDuplicateConfirm', { name: confirmDelete?.fileName || '' })}
        onConfirm={() => {
          if (confirmDelete) handleDelete(confirmDelete.groupKey, confirmDelete.attachmentId);
        }}
      />
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Delete All Duplicates"
        description={`This will permanently remove duplicate file(s) that have no candidate activity, keeping the oldest copy in each group. Files linked to candidates with comments, emails, or interviews will be preserved. This action cannot be undone.`}
        onConfirm={handleDeleteAllDuplicates}
      />
    </div>
  );
}
