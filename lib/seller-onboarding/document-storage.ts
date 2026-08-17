export function sellerDocumentAdminUrl(storageKey: string, fileName: string) {
  const path = String(storageKey || '').trim().replace(/^\/+/, '');
  const name = String(fileName || 'document').trim().slice(0, 255) || 'document';
  if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) {
    throw new Error('Invalid seller document storage path');
  }
  const params = new URLSearchParams({ path, name });
  return `/api/admin/seller-documents/file?${params.toString()}`;
}

export function sellerDocumentStoragePathFromAdminUrl(value: string | null | undefined) {
  const source = String(value || '').trim();
  if (!source.startsWith('/api/admin/seller-documents/file?')) return null;
  try {
    const url = new URL(source, 'https://neejee.local');
    const path = String(url.searchParams.get('path') || '').trim().replace(/^\/+/, '');
    if (!path || path.includes('..') || path.includes('\\') || path.includes('\0')) return null;
    return path;
  } catch {
    return null;
  }
}
