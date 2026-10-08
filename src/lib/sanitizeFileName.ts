/**
 * Transliterates Cyrillic characters to Latin equivalents
 * and removes any remaining non-ASCII / unsafe characters,
 * keeping the result S3/R2-path-safe.
 */
const CYRILLIC_MAP: Record<string, string> = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Е: 'E', Ж: 'Zh', З: 'Z',
  И: 'I', Й: 'Y', К: 'K', Л: 'L', М: 'M', Н: 'N', О: 'O', П: 'P',
  Р: 'R', С: 'S', Т: 'T', У: 'U', Ф: 'F', Х: 'Kh', Ц: 'Ts', Ч: 'Ch',
  Ш: 'Sh', Щ: 'Sht', Ъ: 'A', Ь: '', Ю: 'Yu', Я: 'Ya', Э: 'E',
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch',
  ш: 'sh', щ: 'sht', ъ: 'a', ь: '', ю: 'yu', я: 'ya', э: 'e',
};

function transliterate(text: string): string {
  return text
    .split('')
    .map((ch) => CYRILLIC_MAP[ch] ?? ch)
    .join('');
}

/**
 * Returns an S3/R2-safe filename.
 * - Transliterates Cyrillic → Latin
 * - Replaces non-alphanumeric characters (except . - _) with underscores
 * - Collapses consecutive underscores
 * - Falls back to "file" if result is empty
 */
export function sanitizeFileName(originalName: string): string {
  const dotIdx = originalName.lastIndexOf('.');
  const ext = dotIdx > 0 ? originalName.slice(dotIdx) : '';
  const base = dotIdx > 0 ? originalName.slice(0, dotIdx) : originalName;

  let safe = transliterate(base)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  if (!safe) safe = 'file';

  return safe + ext.toLowerCase();
}
