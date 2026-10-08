import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { r2Upload, r2Delete, r2Download } from '@/lib/r2Storage';
import { sanitizeFileName } from '@/lib/sanitizeFileName';
import { extractTextFromFile } from '@/lib/extractFileText';
import { Upload, FileText, Download, Trash2, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';
import { differenceInDays, differenceInMonths, addMonths } from 'date-fns';

const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB
const GDPR_MONTHS = 6;
const ACCEPTED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

interface Attachment {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  user_id: string;
}

interface Props {
  candidateId: string;
  onAttachmentChange?: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getGdprCountdown(createdAt: string): string {
  const expiry = addMonths(new Date(createdAt), GDPR_MONTHS);
  const now = new Date();
  if (expiry <= now) return 'Expired';
  const months = differenceInMonths(expiry, now);
  const days = differenceInDays(expiry, addMonths(now, months));
  if (months > 0 && days > 0) return `${months}m ${days}d`;
  if (months > 0) return `${months}m`;
  return `${days}d`;
}

export function CandidateAttachments({ candidateId, onAttachmentChange }: Props) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadConfirm, setDownloadConfirm] = useState<Attachment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    const { data } = await supabase
      .from('candidate_attachments')
      .select('*')
      .eq('candidate_id', candidateId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setAttachments((data as Attachment[]) || []);
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    const isDocx = file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx');
    if (!isPdf && !isDocx) {
      toast.error(t('attachments.invalidType'));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('attachments.tooLarge'));
      return;
    }

    setUploading(true);
    try {
      const filePath = `${candidateId}/${Date.now()}_${sanitizeFileName(file.name)}`;
      await r2Upload(filePath, file, file.type || 'application/octet-stream');

      // Extract text for CV search
      let cvText = '';
      try { cvText = await extractTextFromFile(file); } catch { /* non-critical */ }

      const { data: inserted, error: metaError } = await supabase
        .from('candidate_attachments')
        .insert({
          candidate_id: candidateId,
          user_id: user!.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || (isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        } as any)
        .select('id')
        .single();

      if (!metaError && inserted && cvText) {
        await (supabase.from('candidate_attachments') as any).update({ cv_text: cvText }).eq('id', (inserted as any).id);
      }

      if (metaError) throw metaError;

      toast.success(t('attachments.uploaded'));
      fetchAttachments();
      onAttachmentChange?.();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(t('attachments.uploadFailed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (attachment: Attachment) => {
    try {
      const blob = await r2Download(attachment.file_path);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = attachment.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('attachments.downloadFailed'));
    }
    setDownloadConfirm(null);
  };

  const handleDelete = async (attachment: Attachment) => {
    try {
      await r2Delete([attachment.file_path]);

      await supabase
        .from('candidate_attachments')
        .delete()
        .eq('id', attachment.id);

      toast.success(t('attachments.deleted'));
      fetchAttachments();
      onAttachmentChange?.();
    } catch {
      toast.error(t('common.error'));
    }
    setDeleteConfirm(null);
  };


  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-foreground">{t('attachments.title')}</h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('attachments.uploading')}</>
            ) : (
              <><Upload className="h-3.5 w-3.5" /> {t('attachments.attach')}</>
            )}
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground mb-3">
        {t('attachments.formats')}
      </p>

      {loading ? (
        <p className="text-xs text-muted-foreground">{t('common.loading')}</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('attachments.noFiles')}</p>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-muted/30">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setDownloadConfirm(att)}
                  className="text-sm text-foreground font-medium truncate block hover:underline text-left w-full"
                >
                  {att.file_name}
                </button>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{formatFileSize(att.file_size)}</span>
                  <span>·</span>
                  <span>{new Date(att.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    {t('attachments.gdprDelete')}: {getGdprCountdown(att.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setDownloadConfirm(att)}
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                {att.user_id === user?.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => setDeleteConfirm(att)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!downloadConfirm}
        onOpenChange={o => !o && setDownloadConfirm(null)}
        title={t('attachments.downloadTitle')}
        description={t('attachments.downloadConfirm', { name: downloadConfirm?.file_name || '' })}
        confirmLabel={t('attachments.download')}
        onConfirm={() => downloadConfirm && handleDownload(downloadConfirm)}
        destructive={false}
      />

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={o => !o && setDeleteConfirm(null)}
        title={t('attachments.deleteTitle')}
        description={t('attachments.deleteConfirm', { name: deleteConfirm?.file_name || '' })}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />
    </div>
  );
}

export { type Attachment };
export { getGdprCountdown };
