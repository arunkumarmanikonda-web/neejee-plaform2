// Pre-built CMS page templates — scaffolded section arrays ready to drop into a new page.
// Each template is a starter; editors customise content. Images left blank for editor to upload.
import { defaultData, type Section, type SectionType } from './cms-sections';

function s(type: SectionType, dataOverrides: Record<string, any> = {}): Section {
  return {
    id: `s_${type}_${Math.random().toString(36).slice(2, 9)}`,
    type,
    data: { ...defaultData(type), ...dataOverrides },
  };
}

export interface CmsTemplate {
  key: string;
  name: string;
  description: string;
  preview: string;  // emoji or icon for the picker
  seoTitle?: string;
  seoDesc?: string;
  sections: () => Section[];
}

export const CMS_TEMPLATES: CmsTemplate[] = [
  {
    key: 'blank',
    name: 'Blank Page',
    description: 'Start from scratch.',
    preview: '∅',
    sections: () => [],
  },
  {
    key: 'about',
    name: 'About Us',
    description: 'Founder story, values, mission, atelier invitation.',
    preview: '✎',
    seoTitle: 'About NEEJEE · Found. Personal.',
    seoDesc: 'India\'s finest craft, personally chosen by founder Nidhi. Hand-woven sarees, fair-trade, founder-verified.',
    sections: () => [
      s('hero', { eyebrow: 'OUR STORY', title: 'Found. Personal.', subtitle: 'Why NEEJEE began.', dark: true, ctaText: 'OUR CRAFT', ctaUrl: '#craft' }),
      s('founderNote', { name: 'Nidhi', title: 'Founder, NEEJEE', body: 'A short note about what made me start this. The artisan, the place, the moment.' }),
      s('quote', { text: 'A piece you can pass down. Not buy again.', attribution: '— NEEJEE' }),
      s('splitSection', { title: 'The hands behind every weave', body: 'Stories of artisans, named and known. Fair-trade paid before the customer, never after.', imagePosition: 'left', ctaText: 'MEET THE ARTISANS', ctaUrl: '/sellers' }),
      s('featureGrid', { title: 'What we stand for' }),
      s('cta', { eyebrow: 'COME SEE US', title: 'Visit our Mumbai atelier', body: 'By appointment, with chai.', ctaText: 'BOOK A VISIT', ctaUrl: 'mailto:hello@neejee.com' }),
    ],
  },
  {
    key: 'journal',
    name: 'Journal Post',
    description: 'A single editorial entry with hero, excerpt, body, and related products.',
    preview: '✍',
    sections: () => [
      s('journalEntry', { title: 'The weave that survived a flood', author: 'Nidhi', excerpt: 'A short sensory opening.', body: 'The full journal text. Use line breaks for paragraphs.' }),
      s('divider'),
      s('productCarousel', { title: 'Pieces from this story', source: 'founder', limit: 4 }),
      s('cta', { eyebrow: 'MORE STORIES', title: 'Read the NEEJEE journal', body: 'Quiet dispatches from our travels.', ctaText: 'THE JOURNAL', ctaUrl: '/p/journal' }),
    ],
  },
  {
    key: 'collection',
    name: 'Collection Landing',
    description: 'Hero, lookbook, product carousel, testimonial, CTA.',
    preview: '◫',
    seoTitle: 'The NEEJEE Edit — handpicked Indian craft',
    seoDesc: 'A curated edit of hand-woven sarees, oxidised silver, and personal pieces.',
    sections: () => [
      s('hero', { eyebrow: 'THE EDIT', title: 'A collection for the season.', subtitle: 'Personally chosen by Nidhi.', dark: true, ctaText: 'SHOP THE EDIT', ctaUrl: '/products' }),
      s('text', { title: 'About this collection', body: 'A few quiet paragraphs about the why, the makers, and the months it took.', align: 'center' }),
      s('lookbook', { title: 'How to wear it', layout: 'asymmetric' }),
      s('productCarousel', { title: 'The pieces', source: 'founder', limit: 8 }),
      s('testimonial', { text: 'I wore my Banarasi to my mother\'s 60th. She wept. Quiet wins.', author: 'Priya R.', location: 'Bangalore', rating: 5 }),
      s('cta', { eyebrow: 'EXPLORE MORE', title: 'See the full atelier', body: 'Every piece, founder-verified.', ctaText: 'BROWSE ALL', ctaUrl: '/products' }),
    ],
  },
  {
    key: 'sustainability',
    name: 'Sustainability',
    description: 'Values page covering fair trade, slow production, materials, authenticity.',
    preview: '⚖',
    seoTitle: 'Our promise — sustainability at NEEJEE',
    seoDesc: 'Fair-trade pay, slow production, founder-verified authenticity. A quiet promise.',
    sections: () => [
      s('hero', { eyebrow: 'OUR PROMISE', title: 'Slow, fair, real.', subtitle: 'Why everything takes the time it takes.', dark: true, ctaText: 'READ ON', ctaUrl: '#values' }),
      s('text', { title: 'A different pace', body: 'A 100-word essay on why we pay before delivery, why we don\'t scale, why a saree takes 40 days.', align: 'left' }),
      s('featureGrid', { title: 'The four promises', columns: 4, items: [
        { icon: '⚖', title: 'Fair pay', body: 'Artisans paid before the customer.' },
        { icon: '⏳', title: 'Slow craft', body: 'Days, not minutes.' },
        { icon: '✦', title: 'Founder-verified', body: 'Every piece, by hand.' },
        { icon: '◇', title: 'Real materials', body: 'No synthetics, no shortcuts.' },
      ]}),
      s('splitSection', { title: 'The artisans we work with', body: 'Named, known, paid on time. We share their stories — and our profit.', ctaText: 'MEET THE MAKERS', ctaUrl: '/sellers' }),
      s('quote', { text: 'Made well takes time. We do not rush it.', attribution: '— Nidhi' }),
      s('cta', { eyebrow: 'JOIN US', title: 'Subscribe to our journal', body: 'A quiet letter from Mumbai, once a month.', ctaText: 'SUBSCRIBE', ctaUrl: '/account' }),
    ],
  },
  {
    key: 'faq',
    name: 'FAQ',
    description: 'A clean FAQ page with sections for shipping, returns, care, authenticity.',
    preview: '?',
    seoTitle: 'Frequently asked · NEEJEE',
    seoDesc: 'Answers about shipping, returns, care, and authenticity — gently and personally.',
    sections: () => [
      s('hero', { eyebrow: 'GENTLE ANSWERS', title: 'Frequently asked.', subtitle: 'If you don\'t find what you need, write to hello@neejee.com.', dark: false }),
      s('accordion', { title: 'Shipping & delivery' }),
      s('accordion', { title: 'Returns & exchanges', items: [
        { question: 'What is your return window?', answer: '7 days from delivery, unworn, with original tags and the NEEJEE thappa intact.' },
        { question: 'Who pays for return shipping?', answer: 'We do, for defects. The customer covers the return shipping for change-of-mind returns.' },
        { question: 'How long do refunds take?', answer: '5-7 business days after we receive the piece back in our Mumbai atelier.' },
      ]}),
      s('accordion', { title: 'Care & maintenance', items: [
        { question: 'How do I wash handloom?', answer: 'Dry clean only for the first wash. After that, cold hand-wash with a mild detergent.' },
        { question: 'How do I store it?', answer: 'Wrap in muslin, away from sunlight. Refold every six months to prevent permanent creases.' },
        { question: 'What if the colour bleeds?', answer: 'Some natural dyes bleed on first wash. Always wash separately the first time.' },
      ]}),
      s('cta', { eyebrow: 'STILL QUESTIONS', title: 'Write to us personally', body: 'We read every email.', ctaText: 'EMAIL HELLO@NEEJEE.COM', ctaUrl: 'mailto:hello@neejee.com' }),
    ],
  },
  {
    key: 'press',
    name: 'Press & Media',
    description: 'Press mentions, brand assets, contact info.',
    preview: '◇',
    sections: () => [
      s('hero', { eyebrow: 'PRESS', title: 'In the news.', subtitle: 'For media enquiries, write to press@neejee.com.' }),
      s('imageGrid', { columns: 4, items: [{ url: '' }, { url: '' }, { url: '' }, { url: '' }] }),
      s('text', { title: 'Brand assets', body: 'Logo files, founder photos, and product imagery are available on request. Email press@neejee.com.' }),
      s('quote', { text: '"A quiet revolution in Indian craft."', attribution: '— Vogue India' }),
      s('cta', { eyebrow: 'GET IN TOUCH', title: 'Talk to us', body: 'For interviews, samples, or speaking enquiries.', ctaText: 'PRESS@NEEJEE.COM', ctaUrl: 'mailto:press@neejee.com' }),
    ],
  },
];

export function getTemplate(key: string): CmsTemplate | undefined {
  return CMS_TEMPLATES.find(t => t.key === key);
}
