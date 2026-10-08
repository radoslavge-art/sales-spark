import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

export async function r2Upload(filePath: string, file: File | Blob, contentType: string): Promise<void> {
  const headers = await getAuthHeaders();
  const url = `${SUPABASE_URL}/functions/v1/r2-storage?action=upload&path=${encodeURIComponent(filePath)}&contentType=${encodeURIComponent(contentType)}`;
  
  const arrayBuffer = await (file instanceof File ? file.arrayBuffer() : file.arrayBuffer());
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': contentType,
    },
    body: arrayBuffer,
  });
  
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(err.error || 'Upload failed');
  }
}

export async function r2Download(filePath: string): Promise<Blob> {
  const headers = await getAuthHeaders();
  const url = `${SUPABASE_URL}/functions/v1/r2-storage?action=download&path=${encodeURIComponent(filePath)}`;
  
  const resp = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  if (resp.ok) return await resp.blob();

  // Fallback: try old Supabase storage for files that weren't migrated
  const { data, error } = await supabase.storage
    .from('candidate-attachments')
    .download(filePath);
  if (error || !data) throw new Error('Download failed from both R2 and legacy storage');
  return data;
}

export async function r2SignedUrl(filePath: string, expiresIn = 60): Promise<string> {
  const headers = await getAuthHeaders();
  const url = `${SUPABASE_URL}/functions/v1/r2-storage?action=signed-url&path=${encodeURIComponent(filePath)}&expiresIn=${expiresIn}`;
  
  const resp = await fetch(url, {
    method: 'GET',
    headers,
  });
  
  if (!resp.ok) throw new Error('Failed to get signed URL');
  const data = await resp.json();
  return data.signedUrl;
}

export async function r2Delete(paths: string[]): Promise<void> {
  const headers = await getAuthHeaders();
  const url = `${SUPABASE_URL}/functions/v1/r2-storage?action=delete`;
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ paths }),
  });
  
  if (!resp.ok) throw new Error('Delete failed');
}
