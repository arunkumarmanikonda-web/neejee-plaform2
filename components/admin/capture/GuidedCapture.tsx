'use client';
import { useState } from 'react';
import { Camera } from 'lucide-react';
import CaptureDialog from './CaptureDialog';
import { guideFor, guideNames, matchesShot, shotFileName, shotsFor, type CaptureView, type Guide } from '@/lib/product-capture/frames';
import css from './capture.module.css';

type Props = {
  category: string; images: string[]; onUse: (file: File, previous?: string) => Promise<void>;
  max?: number; disabled?: boolean; appendOnly?: boolean;
};
export default function GuidedCapture({ category, images, max = Infinity, disabled, appendOnly, onUse }: Props) {
  const inferred = guideFor(category);
  const [override, setOverride] = useState<{base:Guide; guide:Guide} | null>(null);
  const guide = override?.base === inferred ? override.guide : inferred;
  const [open, setOpen] = useState<CaptureView | null>(null);
  const [message, setMessage] = useState('');
  const fileFor = (shot: CaptureView) => shotFileName(guide, shot);
  const existing = (shot: CaptureView) => images.find(url => matchesShot(url, fileFor(shot)));
  return <section className={css.panel} aria-label="Guided product photography">
    <div className={css.top}><h3>Photograph this piece</h3>
      <label className={css.select}>Shot guide <select value={guide} disabled={disabled} onChange={e => { setOverride({base:inferred,guide:e.target.value as Guide}); setMessage(''); }}>
        {(Object.keys(guideNames) as Guide[]).map(key => <option key={key} value={key}>{guideNames[key]}</option>)}
      </select></label>
    </div>
    <div className={css.grid}>{shotsFor(guide).map(shot => {
      const image = existing(shot);
      return <button key={shot.id} type="button" className={css.slot}
        disabled={disabled || (image ? !!appendOnly : images.length >= max)}
        onClick={() => { setMessage(''); setOpen(shot); }}>
        {image ? <img src={image} alt="" /> : <Camera size={18} aria-hidden="true" />}
        <span>{shot.label}<small>{image ? (appendOnly ? 'Captured' : 'Retake') : (shot.optional ? 'Optional photo' : 'Take photo')}</small></span>
      </button>;
    })}</div>
    <p aria-live="polite" className="text-xs mt-2">{message || (images.length >= max ? 'Gallery is full. Remove an image to add another view.' : '')}</p>
    {open && <CaptureDialog key={fileFor(open)} shot={open} category={guideNames[guide]} fileName={fileFor(open)}
      onClose={() => setOpen(null)} onUse={async file => {
        await onUse(file, existing(open));
        setMessage(open.label + ' added.');
      }} />}
  </section>;
}

export async function uploadShot(file: File, folder: string, endpoint = '/api/admin/upload') {
  const data = new FormData();
  data.append('folder', folder); data.append('file', file);
  const res = await fetch(endpoint, {method:'POST', body:data, credentials:'include'});
  const json = await res.json().catch(() => ({}));
  const url = json.files?.[0]?.url;
  if (!res.ok || typeof url !== 'string') throw new Error(json.error || 'Upload did not finish. You can retry this photo.');
  return url;
}
