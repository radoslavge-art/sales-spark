import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { Loader2 } from 'lucide-react';

interface PreviewAttachment {
  file_name: string;
  mime_type: string;
}

interface Props {
  attachment: PreviewAttachment | null;
  previewUrl: string | null;
  previewHtml: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const isPdfFile = (fileName: string, mimeType: string) =>
  mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');

const isDocxFile = (fileName: string, mimeType: string) =>
  mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.toLowerCase().endsWith('.docx');

export function CandidateFilePreview({ attachment, previewUrl, previewHtml, t }: Props) {
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [pdfError, setPdfError] = useState(false);

  const isPdf = useMemo(() => {
    if (!attachment || !previewUrl) return false;
    return isPdfFile(attachment.file_name, attachment.mime_type);
  }, [attachment, previewUrl]);

  const isDocx = useMemo(() => {
    if (!attachment) return false;
    return isDocxFile(attachment.file_name, attachment.mime_type);
  }, [attachment]);

  useEffect(() => {
    let cancelled = false;

    const renderPdf = async () => {
      if (!isPdf || !previewUrl) {
        setPdfPages([]);
        setPdfError(false);
        return;
      }

      setPdfPages([]);
      setPdfError(false);

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

        const pdf = await pdfjsLib.getDocument(previewUrl).promise;
        const nextPages: string[] = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) continue;

          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);

          await page.render({ canvasContext: context, viewport }).promise;
          nextPages.push(canvas.toDataURL('image/png'));
        }

        if (!cancelled) {
          setPdfPages(nextPages);
        }
      } catch (error) {
        console.error('PDF preview error:', error);
        if (!cancelled) {
          setPdfError(true);
        }
      }
    };

    void renderPdf();

    return () => {
      cancelled = true;
    };
  }, [isPdf, previewUrl]);

  if (!attachment) {
    return <p className="text-sm text-muted-foreground">{t('attachments.noCvAttached')}</p>;
  }

  if (isPdf) {
    if (pdfError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('attachments.previewUnavailable')}</p>
          {previewUrl && (
            <a
              href={previewUrl}
              download={attachment.file_name}
              className="text-sm font-medium text-primary underline underline-offset-4"
            >
              {t('attachments.download')}
            </a>
          )}
        </div>
      );
    }

    if (pdfPages.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('common.loading')}
        </div>
      );
    }

    return (
      <div className="h-full w-full overflow-y-auto rounded-lg border border-border bg-card/40 p-4">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {pdfPages.map((pageUrl, index) => (
            <img
              key={`${attachment.file_name}-${index}`}
              src={pageUrl}
              alt={`CV preview page ${index + 1}`}
              loading={index === 0 ? 'eager' : 'lazy'}
              className="w-full rounded-md border border-border bg-background shadow-sm"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isDocx && previewHtml) {
    return (
      <div className="h-full w-full overflow-y-auto rounded-lg border border-border bg-card/40 p-6">
        <article
          className="prose prose-sm max-w-none text-foreground [&_h1]:text-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_li]:text-foreground [&_p]:text-foreground"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-lg border border-border bg-card/40 p-6 text-center">
      <p className="text-sm text-muted-foreground">{t('attachments.previewUnavailable')}</p>
      {previewUrl && (
        <a
          href={previewUrl}
          download={attachment.file_name}
          className="text-sm font-medium text-primary underline underline-offset-4"
        >
          {t('attachments.download')}
        </a>
      )}
    </div>
  );
}
