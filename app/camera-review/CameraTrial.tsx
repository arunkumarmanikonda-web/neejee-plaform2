'use client';
import { useEffect, useRef, useState } from 'react';
import GuidedCapture from '@/components/admin/capture/GuidedCapture';
export default function CameraTrial() {
  const [images,setImages] = useState<string[]>([]);
  const urls = useRef(new Set<string>());
  useEffect(() => { const owned = urls.current; return () => { owned.forEach(url => URL.revokeObjectURL(url)); }; }, []);
  return <main style={{maxWidth:'55rem',margin:'auto',padding:'clamp(1rem,5vw,3rem)'}}>
    <h1 className="font-display text-3xl mb-2">Try the staff camera</h1>
    <p className="font-ui text-sm mb-5">Choose a view, line up your piece and take a photo. This preview keeps pictures on this device until you leave the page.</p>
    <GuidedCapture category="Sarees" images={images} onUse={async (file,previous) => {
      const objectUrl=URL.createObjectURL(file);
      urls.current.add(objectUrl);
      // A fragment carries the same shot label used in the saved catalogue filename.
      const url=objectUrl + '#/' + file.name;
      setImages(list => previous ? list.map(old => old === previous ? url : old) : [...list, url]);
      if (previous) { const old=previous.split('#')[0]; urls.current.delete(old); URL.revokeObjectURL(old); }
    }}/>
  </main>;
}
