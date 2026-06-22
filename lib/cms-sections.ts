// Server-safe CMS section definitions & defaults.
// This module has no React or 'use client' directive and is safe to import
// from API routes and React Server Components.

export const SECTION_TYPES = [
  // Heroes
  { type: 'hero', label: 'Hero Banner', icon: '◆', group: 'Hero' },
  { type: 'videoHero', label: 'Video Hero', icon: '▶', group: 'Hero' },
  // Content
  { type: 'text', label: 'Text Block', icon: '¶', group: 'Content' },
  { type: 'quote', label: 'Pull Quote', icon: '“ ”', group: 'Content' },
  { type: 'founderNote', label: 'Founder Note', icon: '✎', group: 'Content' },
  { type: 'journalEntry', label: 'Journal Entry', icon: '✍', group: 'Content' },
  { type: 'splitSection', label: 'Split Section (image + text)', icon: '◐', group: 'Content' },
  // Media
  { type: 'image', label: 'Image', icon: '▢', group: 'Media' },
  { type: 'imageGrid', label: 'Image Grid (2/3/4 col)', icon: '⊞', group: 'Media' },
  { type: 'lookbook', label: 'Lookbook Spread', icon: '◫', group: 'Media' },
  // Commerce
  { type: 'productCarousel', label: 'Product Carousel', icon: '◀▶', group: 'Commerce' },
  { type: 'featureGrid', label: 'Feature Grid (icons)', icon: '✦', group: 'Commerce' },
  { type: 'testimonial', label: 'Customer Testimonial', icon: '❝', group: 'Commerce' },
  // Interactive
  { type: 'accordion', label: 'Accordion (FAQ)', icon: '☰', group: 'Interactive' },
  { type: 'cta', label: 'Call to Action', icon: '→', group: 'Interactive' },
  // Decorative
  { type: 'marquee', label: 'Marquee (scrolling)', icon: '⇄', group: 'Decorative' },
  { type: 'divider', label: 'Divider', icon: '—', group: 'Decorative' },
] as const;

export type SectionType = typeof SECTION_TYPES[number]['type'];

export interface VisibilityRules {
  startsAt?: string | null;
  endsAt?: string | null;
  showOn?: 'all' | 'desktop' | 'mobile';
  audience?: 'all' | 'guest' | 'signed-in';
}

export interface Section {
  id: string;
  type: SectionType;
  data: Record<string, any>;
  hidden?: boolean;
  visibility?: VisibilityRules;
}

export function isSectionVisibleNow(s: Section, ctx?: { signedIn?: boolean; device?: 'desktop' | 'mobile' }): boolean {
  if (s.hidden) return false;
  const v = s.visibility;
  if (!v) return true;
  const now = Date.now();
  if (v.startsAt && new Date(v.startsAt).getTime() > now) return false;
  if (v.endsAt && new Date(v.endsAt).getTime() < now) return false;
  if (ctx) {
    if (v.showOn === 'desktop' && ctx.device !== 'desktop') return false;
    if (v.showOn === 'mobile' && ctx.device !== 'mobile') return false;
    if (v.audience === 'guest' && ctx.signedIn) return false;
    if (v.audience === 'signed-in' && !ctx.signedIn) return false;
  }
  return true;
}

export function defaultData(type: SectionType): Record<string, any> {
  switch (type) {
    case 'hero':
      return { eyebrow: 'NEW DROP', title: 'A new collection', subtitle: 'Hand-drawn by hand.', image: '', ctaText: 'EXPLORE', ctaUrl: '/products', dark: true };
    case 'videoHero':
      return { videoUrl: '', poster: '', eyebrow: 'WITNESS', title: 'A craft in motion.', subtitle: 'Six hands. Forty days. One sari.', ctaText: 'WATCH', ctaUrl: '#' };
    case 'text':
      return { title: 'Section title', body: 'Write your story here. Use line breaks for paragraphs.', align: 'left' };
    case 'image':
      return { url: '', alt: '', caption: '', aspect: '16:9' };
    case 'imageGrid':
      return { columns: 3, items: [{ url: '', alt: '' }, { url: '', alt: '' }, { url: '', alt: '' }] };
    case 'lookbook':
      return {
        title: 'The Diwali Edit',
        layout: 'asymmetric',
        items: [
          { url: '', caption: 'Worn with a hand-pleated kanjeevaram.' },
          { url: '', caption: 'Layered with oxidised silver.' },
          { url: '', caption: 'A Banarasi for the evening.' },
        ],
      };
    case 'founderNote':
      return { name: 'Nidhi', title: 'Founder, NEEJEE', body: 'A short personal note from the founder.', signature: '' };
    case 'journalEntry':
      return {
        title: 'The weave that survived a flood',
        author: 'Nidhi',
        date: new Date().toISOString().slice(0, 10),
        excerpt: 'A short, sensory opening that invites the reader in.',
        body: 'The full journal text. Use line breaks for paragraphs.',
        heroImage: '',
      };
    case 'splitSection':
      return {
        image: '',
        title: 'The hands behind the weave',
        body: 'A 60-80 word description that sits beside the image. Tactile, specific, named.',
        ctaText: 'MEET THE ARTISAN',
        ctaUrl: '#',
        imagePosition: 'left',
      };
    case 'featureGrid':
      return {
        title: 'Why NEEJEE',
        columns: 3,
        items: [
          { icon: '✦', title: 'Founder-verified', body: 'Every piece hand-inspected by Nidhi before dispatch.' },
          { icon: '⚖', title: 'Fair-trade pay', body: 'Artisans paid before the customer, never after.' },
          { icon: '⏳', title: 'Slow, on purpose', body: 'Made in days, not minutes. Lives in your trunk for years.' },
        ],
      };
    case 'testimonial':
      return {
        text: 'I wore my Banarasi to my mother\'s 60th. She wept. Quiet wins.',
        author: 'Priya R.',
        location: 'Bangalore',
        photo: '',
        rating: 5,
      };
    case 'accordion':
      return {
        title: 'Frequently asked',
        items: [
          { question: 'How long does delivery take?', answer: '5–8 business days within India. Each piece is hand-inspected before dispatch.' },
          { question: 'Are returns accepted?', answer: 'Yes — within 7 days of delivery, unworn, with original tags and the NEEJEE thappa intact.' },
          { question: 'How do I care for handloom?', answer: 'Dry clean only for the first wash. Store wrapped in muslin, away from sunlight.' },
        ],
      };
    case 'productCarousel':
      return { title: "Founder's Edit", source: 'founder', limit: 6 };
    case 'quote':
      return { text: 'A line that lingers.', attribution: '— Anonymous' };
    case 'marquee':
      return { text: 'FOUND PERSONALLY · HANDMADE IN INDIA · FAIR-TRADE · FOUNDER VERIFIED ·', speed: 30 };
    case 'divider':
      return { style: 'madder' };
    case 'cta':
      return { eyebrow: 'INVITATION', title: 'Visit our atelier', body: 'By appointment.', ctaText: 'BOOK', ctaUrl: '/about' };
    default:
      return {};
  }
}
