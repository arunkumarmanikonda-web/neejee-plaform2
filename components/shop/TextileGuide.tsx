'use client';
import { useState } from 'react';
import { sareeVocabulary, findSareeTerms, normalizeSareeText } from '@/lib/saree-vocabulary';

export function TextileGuide() {
  const [search,setSearch]=useState('');
  const exact=findSareeTerms(search);
  const query=normalizeSareeText(search);
  const rows=sareeVocabulary.filter(t=>!query||exact.includes(t)||normalizeSareeText([t.name,t.origin,...t.aliases].join(' ')).includes(query));
  return <details className="nj-guide"><summary>Saree textile guide</summary><div className="nj-guide-inner">
    <label>Find a weave, fabric or technique<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Try Bandhej, Ajrakh or Muga silk"/></label>
    <dl>{rows.map(t=><div key={t.id}><dt>{t.name} <small>{t.kind}</small></dt><dd>{t.description}</dd><dd className="nj-guide-place">{t.origin}</dd></div>)}</dl>
    {!rows.length&&<p>No matching textile. Try a different spelling or region.</p>}
  </div></details>;
}
