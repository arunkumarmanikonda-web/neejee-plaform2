'use client';

import { buildProductNarrative, readNarrativeEvidence } from '@/lib/catalog/product-narrative';
import { narrativeTitleIsFinal } from '@/lib/catalog/narrative-fields';
import { formatINR } from '@/lib/money';
import styles from './ProductNarrativePanel.module.css';

type Facts = Record<string, string>;
type CopyFields = { name: string; shortName: string; poeticLine: string; description: string; keepTitle: boolean };
type Form = CopyFields & { pieceFacts: Facts; sellingPrice: number; region?: string; material?: string; craft?: string };
type FactField = readonly [key: string, label: string, example?: string];

const basic: FactField[] = [
  ['colour', 'Main colour', 'e.g. Indigo'],
  ['motif', 'Motif or pattern', 'e.g. Ivory dotted diamonds'],
];
const saree: FactField[] = [
  ['border', 'Border', 'e.g. A narrow wine-coloured floral band'],
  ['pallu', 'Pallu', 'e.g. Fine ivory stripes at the end'],
  ['blouse', 'Blouse piece'],
  ['cloth', 'Saree length and width'],
  ['drape', 'Weight and fall'],
  ['opacity', 'Sheerness'],
];
const suit: FactField[] = [
  ['contents', 'Pieces in the set', 'e.g. Wine kurta, ivory trousers and cream dupatta'],
  ['fit', 'Cut and measurements'],
  ['border', 'Edging or trim'],
  ['drape', 'Weight and fall'],
  ['opacity', 'Sheerness and lining'],
];
const object: FactField[] = [
  ['finish', 'Surface and finish', 'e.g. Hand-painted ceramic with a glossy glaze'],
  ['dimensions', 'Dimensions'],
  ['contents', 'What is included'],
];
const reference: FactField = ['designReference', 'Design reference', 'e.g. A dotted motif drawn from Bandhani of Gujarat and Rajasthan'];

function fieldsFor(categoryName: string, categoryPath: string, name: string) {
  const category = [categoryName, categoryPath].join(' ').trim().toLowerCase();
  const context = category || name.toLowerCase();
  if (/\b(sarees?|saris?)\b/.test(context)) {
    return [...basic, ...saree, reference];
  }
  if (/\b(suits?|kurtas?|salwar|anarkali|kameez|palazzos?)\b/.test(context)) {
    return [...basic, ...suit, reference];
  }
  return [...basic, ...object, reference];
}

export function currentPieceFacts(facts: Facts, categoryName: string, categoryPath: string, name: string): Facts {
  return Object.fromEntries(fieldsFor(categoryName, categoryPath, name)
    .filter(([key]) => facts[key]?.trim())
    .map(([key]) => [key, facts[key].trim()]));
}

type Props = {
  form: Form;
  categoryName: string;
  categoryPath: string;
  image?: string;
  price?: number;
  onChange: (patch: Partial<CopyFields> & {pieceFacts?: Facts}) => void;
};

export function ProductNarrativePanel({form, categoryName, categoryPath, image, price, onChange}: Props) {
  const fields = fieldsFor(categoryName, categoryPath, form.name);
  const pieceFacts = currentPieceFacts(form.pieceFacts, categoryName, categoryPath, form.name);
  const evidence = readNarrativeEvidence({...form, ...pieceFacts, pieceFacts, categoryName, categoryPath});
  const draft = buildProductNarrative(evidence);
  const title = ((form.keepTitle || narrativeTitleIsFinal(form.name)) && form.name.trim()) || draft.name;
  const alias = form.shortName.trim() || draft.shortName;
  const caption = form.poeticLine.trim() || draft.poeticLine;
  const description = form.description.trim() || draft.description;
  const wordingKept = form.keepTitle && form.name.trim()===title && form.poeticLine.trim()===caption && form.description.trim()===description;
  const hasBrief = Boolean(form.name.trim() || form.description.trim() || Object.keys(pieceFacts).length || form.material?.trim() || form.craft?.trim());

  return <section className={styles.panel} aria-label="Storefront narrative">
    <h2>What makes this piece recognisable?</h2>
    <p className={styles.intro}>Enter the details you can confirm. Neejee uses them to draft the shop title, card caption and product description when you save.</p>
    <div className={styles.fields}>
      {fields.map(([key, label, example]) => <label key={key} className={key==='designReference' ? styles.wide : undefined}>
        {label}
        <input value={form.pieceFacts[key] || ''} maxLength={400} placeholder={example} onChange={event => onChange({pieceFacts:{...form.pieceFacts,[key]:event.target.value}})}/>
        {key==='designReference' && <small>Record the tradition that influenced the design. Enter the place of manufacture in the origin field.</small>}
      </label>)}
    </div>

    <div className={styles.preview}>
      <header><h3>Storefront preview</h3></header>
      {hasBrief && title ? <>
        <div className={styles.card}>
          {image && <img src={image} alt="Selected product photograph"/>}
          <div>
            <div className={styles.ticket}>
              {alias && alias.toLowerCase()!==title.toLowerCase() && <span>{alias}</span>}
              {Number(price ?? form.sellingPrice)>0 && <strong>{formatINR(price ?? form.sellingPrice)}</strong>}
            </div>
            <h4>{title}</h4>
            {caption && <p>{caption}</p>}
          </div>
        </div>
        {description && <div className={styles.story}><span>On the product page</span><p>{description}</p></div>}
        <button className={styles.keep} type="button" disabled={wordingKept} onClick={() => onChange({name:title, shortName:alias || '', poeticLine:caption, description, keepTitle:true})}>{wordingKept ? 'Exact wording selected' : 'Use this exact wording'}</button>
      </> : <p className={styles.empty}>Enter the working name or a confirmed detail to see the draft.</p>}
    </div>

    <details className={styles.manual}>
      <summary>Edit the wording yourself</summary>
      <div className={styles.fields}>
        <label className={styles.check}><input type="checkbox" checked={form.keepTitle} onChange={event=>onChange({keepTitle:event.target.checked})}/>Keep the working name as the exact shop title</label>
        <label className={styles.wide}>Short name for the piece<input value={form.shortName} onChange={event=>onChange({shortName:event.target.value})} placeholder="e.g. Neel"/></label>
        <label className={styles.wide}>Card caption<input value={form.poeticLine} onChange={event=>onChange({poeticLine:event.target.value})} placeholder="One detail a shopper can see at a glance"/></label>
        <label className={styles.wide}>Product description<textarea value={form.description} rows={3} onChange={event=>onChange({description:event.target.value})} placeholder="Describe the cloth, cut, finish or how the piece looks in use."/></label>
      </div>
    </details>
  </section>;
}
