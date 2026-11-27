'use client';
import { useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { frameCrop, type CaptureView } from '@/lib/product-capture/frames';
import css from './capture.module.css';

type Props = {
  shot: CaptureView; fileName: string; category: string; onClose: () => void;
  onUse: (file: File) => Promise<void>;
};
export default function CaptureDialog({ shot, fileName, category, onClose, onUse }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const titleId = useId();
  const [photo, setPhoto] = useState<{file: File; url: string} | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [cameraError, setCameraError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const taking = useRef(false);
  const saving = useRef(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const node = dialog.current;
    node?.showModal();
    return () => { mounted.current = false; node?.close(); };
  }, []);
  useEffect(() => { return () => { if (photo) URL.revokeObjectURL(photo.url); }; }, [photo]);
  useEffect(() => {
    if (photo) return;
    let active = true;
    let stream: MediaStream | undefined;
    const el = video.current;
    if (!el) return;
    const release = () => {
      stream?.getTracks().forEach(track => track.stop());
      el.srcObject = null;
    };
    const fail = (message: string) => {
      if (!active) return;
      release(); setReady(false); setCameraError(true); setError(message);
    };
    const onHidden = () => {
      if (document.hidden) {
        fail('Camera paused. Return to the frame and tap Restart camera.');
        active = false;
      }
    };
    setReady(false); setCameraError(false); setError('');
    document.addEventListener('visibilitychange', onHidden);
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Open this secure preview directly in Safari or Chrome to use the camera.');
        stream = await navigator.mediaDevices.getUserMedia({audio:false, video:{facingMode:{ideal:'environment'}, width:{ideal:3072}, height:{ideal:3072}}});
        if (!active || !el) { stream.getTracks().forEach(track => track.stop()); return; }
        el.srcObject = stream;
        stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => fail('The camera disconnected. Tap Restart camera.')));
        await el.play();
      } catch (err) {
        const name = err instanceof Error ? err.name : '';
        const message = name === 'NotAllowedError' ? 'Camera access is off. Allow camera access for Neejee in your browser or app settings, then restart.'
          : name === 'NotFoundError' ? 'No camera was found on this device. Open the preview on your phone.'
          : name === 'NotReadableError' ? 'The camera is in use. Close the other camera app and restart.'
          : err instanceof Error ? err.message : 'Could not start the camera. Please restart.';
        fail(message);
      }
    }
    void start();
    return () => { active = false; document.removeEventListener('visibilitychange', onHidden); release(); };
  }, [photo, attempt]);

  async function take() {
    const el = video.current;
    if (!el || !ready || taking.current) return;
    taking.current = true;
    try {
      const box = el.getBoundingClientRect();
      const {sx, sy, sw, sh} = frameCrop(el.videoWidth, el.videoHeight, box.width / box.height);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 3000 / Math.max(sw, sh));
      canvas.width = Math.max(1, Math.round(sw * scale));
      canvas.height = Math.max(1, Math.round(sh * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('The camera image could not be read. Try again.');
      ctx.drawImage(el, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('The image could not be saved. Try again.')), 'image/jpeg', .92));
      if (mounted.current) {
        setError('');
        setPhoto({file:new File([blob], fileName, {type:'image/jpeg'}), url:URL.createObjectURL(blob)});
      }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Try the photograph again.'); }
    finally { taking.current = false; }
  }
  async function confirm() {
    if (!photo || saving.current) return;
    saving.current = true; setBusy(true); setError('');
    try { await onUse(photo.file); if (mounted.current) onClose(); }
    catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Could not save this photo. Please try again.'); }
    finally { saving.current = false; if (mounted.current) setBusy(false); }
  }
  return <dialog ref={dialog} className={css.dialog} aria-labelledby={titleId} onCancel={e => { e.preventDefault(); if (!saving.current) onClose(); }}>
    <div className={css.shell}>
      <header className={css.bar}><div><span>{category}</span><h3 id={titleId}>{shot.label}</h3></div>
        <button type="button" onClick={onClose} disabled={busy}>Close</button></header>
      <p className={css.hint}>{shot.hint}</p>
      <div className={css.stage}>
        <div className={css.frame} style={{'--ratio':shot.ratio} as CSSProperties}>
          {photo ? <img src={photo.url} alt={'Captured ' + shot.label.toLowerCase()} /> : <>
            <video ref={video} muted playsInline autoPlay onLoadedData={e => setReady(e.currentTarget.videoWidth > 0)} />
            <i className={css.corners} aria-hidden="true" />
            {!ready && !cameraError && <span className={css.wait}>Opening camera…</span>}
          </>}
        </div>
      </div>
      {error && <p role="alert" className={css.error}>{error}</p>}
      <footer className={css.controls}>
        {photo ? <><button type="button" disabled={busy} onClick={() => setPhoto(null)}>Retake</button><button type="button" className={css.primary} disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Use this photo'}</button></>
          : cameraError ? <button type="button" className={css.primary} onClick={() => setAttempt(n => n + 1)}>Restart camera</button>
          : <button type="button" className={css.primary} disabled={!ready} onClick={take}>Take photo</button>}
      </footer>
    </div>
  </dialog>;
}
