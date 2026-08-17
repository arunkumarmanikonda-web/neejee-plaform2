'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function DeleteAiPreviewButton({
  previewId,
  onDeleted,
}: {
  previewId: string | null | undefined;
  onDeleted?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  if (!previewId) return null;

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/ai/previews/${encodeURIComponent(previewId)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to delete preview');
      setMessage('Deleted from your NEEJEE previews.');
      onDeleted?.();
    } catch (error: any) {
      setMessage(error?.message || 'Unable to delete preview right now.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 text-center">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex items-center gap-2 font-ui text-[10px] tracking-widest text-mitti hover:text-madder disabled:opacity-50"
      >
        <Trash2 className="w-3.5 h-3.5" />
        {busy ? 'DELETING…' : 'DELETE MY UPLOADED IMAGE & PREVIEW'}
      </button>
      {message && <p className="font-ui text-[10px] text-mitti mt-2">{message}</p>}
    </div>
  );
}
