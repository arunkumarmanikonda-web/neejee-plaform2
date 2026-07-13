import type { PremiumCatalogueEngineOutput } from './contracts';

type ProductLike = PremiumCatalogueEngineOutput['products'][number];

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function lower(value: string): string {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}

function sentenceList(parts: Array<string | null | undefined>): string {
  const items: string[] = parts.map((part: string | null | undefined) => text(part)).filter(Boolean);

  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;

  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function extract(product: ProductLike | null | undefined) {
  const p = (product || {}) as any;

  return {
    name: text(p?.identity?.name || p?.name, 'Signature Object'),
    shortName: text(p?.identity?.shortName || p?.shortName),
    poeticLine: text(p?.identity?.poeticLine || p?.poeticLine),
    description: text(p?.identity?.description || p?.description),
    craft: text(p?.craft),
    region: text(p?.region || p?.state || p?.sellerProfile?.region),
    material: text(p?.material),
    technique: text(p?.technique),
    story: text(p?.story),
    storyBlock: text(p?.catalogue?.storyBlock || p?.catalogueStoryBlock),
    sustainabilityNote: text(p?.sustainabilityNote),
    careInstructions: text(p?.careInstructions),
    artisanName: text(p?.artisanName),
    sellerName: text(p?.sellerProfile?.businessName || p?.seller?.businessName),
    categoryPath: text(p?.hierarchy?.path || p?.category?.path),
    stockLabel: text(p?.stock?.label),
    inventory: Number.isFinite(p?.stock?.totalInventory) ? p.stock.totalInventory : null,
  };
}

export function formatInr(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Price on request';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function getPrimaryImage(product: ProductLike | null | undefined): string | null {
  const p = (product || {}) as any;

  return (
    p?.media?.preferredImage ||
    p?.media?.approvedPrimaryImage ||
    p?.media?.primaryImage ||
    p?.cataloguePreferredImage ||
    (Array.isArray(p?.media?.approvedGallery) ? p.media.approvedGallery[0] : null) ||
    (Array.isArray(p?.media?.gallery) ? p.media.gallery[0] : null) ||
    (Array.isArray(p?.images) ? p.images[0] : null) ||
    null
  );
}

export function getGalleryImages(product: ProductLike | null | undefined, limit = 4): string[] {
  const p = (product || {}) as any;

  const items: string[] = [
    ...(Array.isArray(p?.media?.approvedGallery) ? p.media.approvedGallery : []),
    ...(Array.isArray(p?.media?.gallery) ? p.media.gallery : []),
    ...(Array.isArray(p?.images) ? p.images : []),
  ].filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0);

  const primary = getPrimaryImage(product);
  const unique: string[] = Array.from(new Set(items));

  return unique.filter((item: string) => item !== primary).slice(0, limit);
}

export function getBadgeLabels(product: ProductLike | null | undefined): string[] {
  const p = (product || {}) as any;
  const raw: any[] = Array.isArray(p?.badges) ? p.badges : [];

  const normalized: string[] = raw
    .map((badge: any): string => text(badge?.label || badge?.slug || badge))
    .filter((badge: string): boolean => Boolean(badge));

  return normalized
    .map((badge: string): string =>
      badge
        .replace(/[_-]+/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char: string) => char.toUpperCase())
    )
    .slice(0, 6);
}

export function buildNeejeeInsight(product: ProductLike | null | undefined): string {
  const { craft, region, material, technique } = extract(product);

  if (craft && region && material) {
    return `Quiet luxury is not a style trick. It is what happens when ${lower(material)} and ${lower(craft)} from ${region} are allowed to keep their dignity instead of being polished into sameness.`;
  }

  if (craft && technique) {
    return `What makes an object persuasive is not ornament alone, but the confidence of ${lower(craft)} shaped through ${lower(technique)} and left legible to the eye.`;
  }

  return 'The most lasting rooms are rarely the loudest ones. They are the ones where craft is felt before it is named.';
}

export function buildProductNarrative(product: ProductLike | null | undefined): string {
  const info = extract(product);

  if (info.storyBlock) return info.storyBlock;
  if (info.story && info.poeticLine) return `${info.poeticLine} ${info.story}`;
  if (info.story) return info.story;
  if (info.description) return info.description;

  const craftMaterial = sentenceList([
    info.material ? lower(info.material) : '',
    info.craft ? lower(info.craft) : '',
    info.technique ? lower(info.technique) : '',
  ]);

  if (craftMaterial) {
    return `${info.name} brings together ${craftMaterial} in a way that feels composed rather than excessive, allowing the object to set atmosphere before it asks for attention.`;
  }

  return `${info.name} is curated for homes that prefer emotional depth to spectacle and permanence to trend.`;
}

export function buildProductMetaNarrative(product: ProductLike | null | undefined): string {
  const info = extract(product);
  const place = sentenceList([info.region, info.artisanName]);

  if (place && info.sellerName) {
    return `Presented through Neejee with close attention to provenance, this object carries a chain of care that extends from ${place} to ${info.sellerName}.`;
  }

  if (info.categoryPath) {
    return `Within ${info.categoryPath.replace(/\//g, ' / ')}, this piece was selected for its ability to anchor the category with calm authority.`;
  }

  return 'Every detail here is arranged to support consideration: provenance first, pricing second, and spectacle last.';
}

export function buildFounderPreNote(
  engineOutput: PremiumCatalogueEngineOutput,
  founderName = 'Nidhi Chauhan'
): string {
  const product = engineOutput.heroProduct || engineOutput.products[0] || null;
  const info = extract(product);
  const title = text(engineOutput.brief.title, 'Neejee');

  const opening = `${title} was never imagined as a fast catalogue. I wanted it to feel like a slower room — one in which material, craft, and memory have enough space to speak before commerce does.`;
  const middle = info.name
    ? `${info.name} holds that intention clearly. It is the kind of object that changes a room without theatrics, allowing beauty to arrive through proportion, tactility, and restraint.`
    : 'The pieces gathered here were chosen because they alter the emotional temperature of a room without asking to dominate it.';
  const closing =
    info.craft || info.material || info.region
      ? `What moves me most is the way ${sentenceList([
          info.craft ? lower(info.craft) : '',
          info.material ? lower(info.material) : '',
          info.region ? `from ${info.region}` : '',
        ])} can carry both stillness and presence at once.`
      : 'What moves me most is work that feels patient enough to stay meaningful for years.';

  return `${opening} ${middle} ${closing}`;
}

export function buildFounderPreQuote(
  engineOutput: PremiumCatalogueEngineOutput,
  founderName = 'Nidhi Chauhan'
): string {
  const info = extract(engineOutput.heroProduct || engineOutput.products[0] || null);

  if (info.region && info.craft) {
    return `I want every Neejee catalogue to feel like an intimate conversation where ${lower(info.craft)} from ${info.region} is given the dignity of stillness. — ${founderName}`;
  }

  return `I want every Neejee catalogue to feel less like a sales document and more like a quiet encounter with beauty. — ${founderName}`;
}

export function buildFounderEndingNote(
  engineOutput: PremiumCatalogueEngineOutput,
  founderName = 'Nidhi Chauhan'
): string {
  const product = engineOutput.heroProduct || engineOutput.products[0] || null;
  const info = extract(product);
  const count = engineOutput.products.length;

  const first = `This catalogue brings together ${count} curated ${count === 1 ? 'object' : 'objects'} that remind me luxury is ultimately a practice of discernment: what we choose to keep close, what we choose to honour, and what we choose not to rush.`;
  const second = info.name
    ? `${info.name} stands here not as an isolated product, but as evidence that thoughtful making can still shape how a room feels, remembers, and receives the people within it.`
    : 'Each object here stands not in isolation, but as part of a larger promise to return craft to context.';
  const third = info.sustainabilityNote
    ? info.sustainabilityNote
    : 'May Neejee continue to privilege care, material honesty, and the quiet confidence of work made well.';

  return `${first} ${second} ${third}`;
}

export function buildFounderEndingQuote(
  engineOutput: PremiumCatalogueEngineOutput,
  founderName = 'Nidhi Chauhan'
): string {
  const info = extract(engineOutput.heroProduct || engineOutput.products[0] || null);

  if (info.name) {
    return `${info.name} reminds me that true luxury is not louder detail — it is devotion made visible. — ${founderName}`;
  }

  return `True luxury, to me, is devotion made visible. — ${founderName}`;
}

export function buildFounderSignature(founderName = 'Nidhi Chauhan'): string {
  return `${founderName} · Founder, Neejee`;
}

export function buildSectionIntro(title: string, productCount: number): string {
  if (/hero/i.test(title)) {
    return 'The lead selection establishes the emotional register of the catalogue: calm, tactile, and deeply considered.';
  }

  if (/story|narrative/i.test(title)) {
    return 'This section slows the pace, giving space to provenance, craft, and the atmosphere that surrounds the object.';
  }

  if (/featured|picks|spotlight/i.test(title)) {
    return `A concise edit of ${productCount} highlighted ${productCount === 1 ? 'piece' : 'pieces'} selected for design gravity and visual composure.`;
  }

  if (/grid|continuum|drop|discover/i.test(title)) {
    return `A wider field of ${productCount} supporting ${productCount === 1 ? 'object' : 'objects'} for broader merchandising and discovery.`;
  }

  return `A curated section featuring ${productCount} ${productCount === 1 ? 'product' : 'products'} from the live catalogue engine.`;
}

export function buildContentsLabels(engineOutput: PremiumCatalogueEngineOutput): string[] {
  const labels: string[] = ['Cover', 'Founder Pre-Note', 'Table of Contents'];
  const hero = engineOutput.heroProduct || engineOutput.products[0] || null;

  if (hero) {
    labels.push(`Signature Spread · ${extract(hero).name}`);
  }

  engineOutput.products.forEach((product: ProductLike, index: number) => {
    const name = extract(product).name;
    labels.push(`Product ${String(index + 1).padStart(2, '0')} · ${name}`);
  });

  labels.push('Founder Closing Note');

  return labels;
}
