// Mock data layer — used while DB is not connected.
// Swap to Prisma queries (lib/prisma.ts) once DATABASE_URL is set and migrations run.

export type Product = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  poeticLine: string;
  description: string;
  story?: string;
  craft: string;
  region: string;
  state?: string;
  artisanName: string;
  artisanBio?: string;
  categorySlug: string;
  material: string;
  technique?: string;
  occasion: string;
  mrp: number;          // in paise
  sellingPrice: number; // in paise
  images: string[];
  badges: string[];
  aiTryOnEligible: boolean;
  aiRoomEligible?: boolean;
  inventory: number;
  weight?: number;      // grams
  careInstructions?: string;
  sustainabilityNote?: string;
};

export type Category = {
  slug: string;
  name: string;
  parentSlug?: string;
  image?: string;
  description: string;
  poeticLine?: string;
};

export type Artisan = {
  slug: string;
  name: string;
  craft: string;
  region: string;
  cluster?: string;
  story: string;
  yearsOfPractice: number;
  image?: string;
  productIds: string[];
};

export type Story = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  image: string;
  category: 'CRAFT' | 'FOUNDER' | 'JOURNAL';
  publishedAt: string;
};

// Curated Unsplash images — free, royalty-free, India-craft themed
// All URLs use Unsplash CDN directly for max reliability
const IMG = {
  saree_banarasi:   'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80&fm=jpg',
  saree_chanderi:   'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=900&q=80&fm=jpg',
  saree_kanjeevaram:'https://images.unsplash.com/photo-1610030469668-8e4a7b1b6b87?w=900&q=80&fm=jpg',
  saree_red:        'https://images.unsplash.com/photo-1594761051556-eef173e6e7be?w=900&q=80&fm=jpg',
  jewellery_silver: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=900&q=80&fm=jpg',
  jewellery_gold:   'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?w=900&q=80&fm=jpg',
  jewellery_jhumka: 'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?w=900&q=80&fm=jpg',
  attar_bottle:     'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=900&q=80&fm=jpg',
  attar_rose:       'https://images.unsplash.com/photo-1541643600914-78b084683601?w=900&q=80&fm=jpg',
  stoneware:        'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=900&q=80&fm=jpg',
  pottery:          'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=900&q=80&fm=jpg',
  dupatta_pink:     'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=900&q=80&fm=jpg',
  ajrakh:           'https://images.unsplash.com/photo-1612722432474-b971cdcea546?w=900&q=80&fm=jpg',
  sandook:          'https://images.unsplash.com/photo-1581338834647-b0fb40704e21?w=900&q=80&fm=jpg',
  pashmina:         'https://images.unsplash.com/photo-1601244005535-a48d21d951ac?w=900&q=80&fm=jpg',
  hero_woman:       'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1600&q=80&fm=jpg',
  craft_loom:       'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&q=80&fm=jpg',
  brand_hero:       'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=1600&q=80&fm=jpg',
  ai_mirror:        'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=1200&q=80&fm=jpg',
  ai_space:         'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=1200&q=80&fm=jpg',
};

// ============ CATEGORIES ============
export const categories: Category[] = [
  { slug: 'women', name: 'Women', description: 'For her — sarees, kurtas, dupattas, festive wear.', poeticLine: 'A second skin, found.' },
  { slug: 'sarees', name: 'Sarees', parentSlug: 'women', description: 'Hand-woven across India.', poeticLine: 'Six yards. Of time, of skill, of memory.', image: IMG.saree_banarasi },
  { slug: 'kurtas', name: 'Kurtas & Sets', parentSlug: 'women', description: 'Everyday rare moments.', poeticLine: 'Quiet luxury, daily worn.', image: IMG.saree_chanderi },
  { slug: 'dupattas', name: 'Dupattas & Stoles', parentSlug: 'women', description: 'A second skin.', poeticLine: 'From a grandmother\'s chest. Now in yours.', image: IMG.dupatta_pink },
  { slug: 'men', name: 'Men', description: 'For him — kurtas, Nehru jackets, shawls.', poeticLine: 'Worn well. Worn long.', image: IMG.pashmina },
  { slug: 'jewellery', name: 'Jewellery', description: 'Wears like memory.', poeticLine: 'Heirloom-ready. Personally worn.', image: IMG.jewellery_silver },
  { slug: 'home', name: 'Home & Objects', description: 'Personally placed.', poeticLine: 'Holds rice, oil, attention.', image: IMG.stoneware },
  { slug: 'fragrance', name: 'Fragrance', description: 'A private language.', poeticLine: 'Kept on the skin. Read by the closest.', image: IMG.attar_bottle },
  { slug: 'handlooms', name: 'Handlooms', description: 'India\'s finest weaves.', poeticLine: 'Counted by the loom. Held by the hand.', image: IMG.saree_kanjeevaram },
  { slug: 'gifting', name: 'Gifting', description: 'Personally chosen.', poeticLine: 'A Sandook. A note. A finding.', image: IMG.sandook },
];

// ============ ARTISANS ============
export const artisans: Artisan[] = [
  { slug: 'mohammed-salim', name: 'Mohammed Salim', craft: 'Banarasi Silk', region: 'Varanasi · UP', cluster: 'Madanpura', story: 'Third-generation weaver. Works on a single pit-loom passed down from his grandfather. Each saree takes 14–28 days.', yearsOfPractice: 32, productIds: ['p1'] },
  { slug: 'anand-maru', name: 'Anand Maru', craft: 'Chanderi', region: 'Chanderi · MP', cluster: 'Pranpur', story: 'Weaves silk-cotton blends. Trained by his mother — one of the few women master weavers of Chanderi.', yearsOfPractice: 22, productIds: ['p2'] },
  { slug: 'karim-khan', name: 'Karim Khan', craft: 'Oxidised Silver', region: 'Jaipur · Rajasthan', cluster: 'Tripolia Bazaar', story: 'Specialises in tribal-inspired silver. Apprentice since age 11.', yearsOfPractice: 28, productIds: ['p3'] },
  { slug: 'mohan-lal', name: 'Mohan Lal Attarwale', craft: 'Attar · Deg-Bhapka', region: 'Kannauj · UP', story: 'Family has distilled attars for six generations. Mitti Attar requires copper deg, bamboo chonga, fresh monsoon clay.', yearsOfPractice: 41, productIds: ['p4'] },
  { slug: 'bishan-lal', name: 'Bishan Lal', craft: 'Khurja Stoneware', region: 'Khurja · UP', story: 'Wheel-thrown black stoneware. Fires every Thursday in a wood kiln.', yearsOfPractice: 35, productIds: ['p5'] },
  { slug: 'sukhwinder-kaur', name: 'Sukhwinder Kaur', craft: 'Phulkari Embroidery', region: 'Patiala · Punjab', story: 'Embroiders Phulkari the way her mother taught her — counted thread, no graph paper.', yearsOfPractice: 26, productIds: ['p6'] },
];

// ============ PRODUCTS ============
export const products: Product[] = [
  {
    id: 'p1', slug: 'banarasi-pure-silk-antique-gold', sku: 'NEE-SAR-001',
    name: 'Banarasi Pure Silk Saree',
    poeticLine: 'Woven for fourteen days. For everyday rare moments.',
    description: 'A Banarasi woven on a single pit-loom in Varanasi by Master Weaver Mohammed Salim, using the original kadhwa technique. The antique gold zari sits in muted silk, catching light differently in every fold.',
    story: 'Fourteen days on a pit-loom in Madanpura, Varanasi. Master Salim\'s family has woven silk for three generations.',
    craft: 'Banarasi', region: 'Varanasi', state: 'Uttar Pradesh', artisanName: 'Mohammed Salim',
    artisanBio: '32 years of weaving. Third-generation Banarasi weaver.',
    categorySlug: 'sarees', material: 'Pure Silk', technique: 'Kadhwa hand-loom',
    occasion: 'Festive · Wedding',
    mrp: 3200000, sellingPrice: 2450000,
    images: [IMG.saree_banarasi, IMG.saree_red, IMG.saree_kanjeevaram],
    badges: ['FOUNDER\'S EDIT', 'HANDLOOM VERIFIED'],
    aiTryOnEligible: true, inventory: 3, weight: 680,
    careInstructions: 'Dry-clean only. Store wrapped in muslin. Refold every 3 months.',
    sustainabilityNote: 'Mulberry silk · GI-tagged Varanasi · Fair-trade artisan wage.',
  },
  {
    id: 'p2', slug: 'chanderi-silk-cotton-cream', sku: 'NEE-SAR-002',
    name: 'Chanderi Silk-Cotton Saree',
    poeticLine: 'Cloud-weight. Daylight-coloured.',
    description: 'Chanderi from Madhya Pradesh, woven with silk warp and cotton weft. Featherlight. Wears like a held breath.',
    story: 'Pranpur cluster, Chanderi. The yarn is so fine that the weaver wets his thumb to count it.',
    craft: 'Chanderi', region: 'Chanderi', state: 'Madhya Pradesh', artisanName: 'Anand Maru',
    categorySlug: 'sarees', material: 'Silk-Cotton Blend', technique: 'Handloom',
    occasion: 'Workwear · Festive',
    mrp: 1400000, sellingPrice: 980000,
    images: [IMG.saree_chanderi],
    badges: ['HANDLOOM VERIFIED'],
    aiTryOnEligible: true, inventory: 7, weight: 420,
    careInstructions: 'Gentle hand-wash in cold water. Line-dry in shade.',
  },
  {
    id: 'p3', slug: 'oxidised-silver-jhumkas', sku: 'NEE-JEW-001',
    name: 'Oxidised Silver Jhumkas',
    poeticLine: 'Wears like memory. Pairs with everything you already love.',
    description: 'Hand-finished oxidised silver from Jaipur. Hypoallergenic, intentionally darkened, the patina deepens with time.',
    story: 'Tripolia Bazaar, Jaipur. Karim Khan hammers each bell-dome by hand. The oxidation is the way silver was worn in palaces.',
    craft: 'Silver · Oxidised', region: 'Jaipur', state: 'Rajasthan', artisanName: 'Karim Khan',
    categorySlug: 'jewellery', material: '925 Silver · Oxidised', technique: 'Hand-hammered',
    occasion: 'Everyday · Festive',
    mrp: 480000, sellingPrice: 320000,
    images: [IMG.jewellery_jhumka, IMG.jewellery_silver],
    badges: ['ARTISAN MADE', 'FOUNDER\'S EDIT'],
    aiTryOnEligible: true, inventory: 12, weight: 18,
    careInstructions: 'Wipe with soft cloth. Store away from moisture. Patina is intentional — do not polish.',
  },
  {
    id: 'p4', slug: 'mitti-attar-kannauj', sku: 'NEE-FRA-001',
    name: 'Mitti Attar',
    poeticLine: 'Distilled from the first rain on Kannauj earth.',
    description: 'A private language, kept on the skin. The smell of monsoon meeting earth, captured by the deg-bhapka method. Kannauj, the perfume capital of India.',
    story: 'Mohan Lal\'s family has distilled attars since 1842. Mitti is made only after the first monsoon rain — fresh clay, copper deg, sandalwood base.',
    craft: 'Attar · Deg-Bhapka', region: 'Kannauj', state: 'Uttar Pradesh', artisanName: 'Mohan Lal Attarwale',
    categorySlug: 'fragrance', material: 'Pure Attar · 10ml', technique: 'Deg-bhapka distillation',
    occasion: 'Personal · Ritual',
    mrp: 240000, sellingPrice: 180000,
    images: [IMG.attar_bottle, IMG.attar_rose],
    badges: ['FOUNDER\'S EDIT'],
    aiTryOnEligible: false, inventory: 24, weight: 30,
    careInstructions: 'Store in dark, cool place. No alcohol — pure oil. Lasts 8–12 hours on skin.',
  },
  {
    id: 'p5', slug: 'khurja-stoneware-vase-deep', sku: 'NEE-HOM-001',
    name: 'Khurja Stoneware Vase · Deep',
    poeticLine: 'Holds rice, oil, attention.',
    description: 'Black stoneware fired in Khurja, UP. Each piece slightly different — that is the point.',
    craft: 'Stoneware · Wheel-thrown', region: 'Khurja', state: 'Uttar Pradesh', artisanName: 'Bishan Lal',
    categorySlug: 'home', material: 'Stoneware', technique: 'Wheel-thrown, wood-fired',
    occasion: 'Everyday Home',
    mrp: 280000, sellingPrice: 220000,
    images: [IMG.stoneware, IMG.pottery],
    badges: ['ARTISAN MADE'],
    aiTryOnEligible: false, aiRoomEligible: true, inventory: 8, weight: 1200,
    careInstructions: 'Food-safe. Hand-wash. Microwave safe.',
  },
  {
    id: 'p6', slug: 'phulkari-dupatta-vintage', sku: 'NEE-DUP-001',
    name: 'Phulkari Dupatta · Vintage Pink',
    poeticLine: 'From a grandmother\'s chest. Now in yours.',
    description: 'Hand-embroidered Phulkari from Patiala, in muted vintage pink on khaddar base. Each stitch counted.',
    craft: 'Phulkari · Hand-embroidered', region: 'Patiala', state: 'Punjab', artisanName: 'Sukhwinder Kaur',
    categorySlug: 'dupattas', material: 'Khaddar · Silk thread', technique: 'Counted-thread embroidery',
    occasion: 'Festive · Personal',
    mrp: 950000, sellingPrice: 720000,
    images: [IMG.dupatta_pink, IMG.saree_red],
    badges: ['FOUNDER\'S EDIT', 'HANDLOOM VERIFIED', 'LIMITED DROP'],
    aiTryOnEligible: true, inventory: 2, weight: 280,
  },
  {
    id: 'p7', slug: 'kanjeevaram-temple-border-red', sku: 'NEE-SAR-003',
    name: 'Kanjeevaram Silk · Temple Border',
    poeticLine: 'Red as ritual. Gold as memory.',
    description: 'Pure mulberry silk Kanjeevaram with a traditional temple border. Woven in Kanchipuram on a 60-thread korvai loom.',
    craft: 'Kanjeevaram', region: 'Kanchipuram', state: 'Tamil Nadu', artisanName: 'P. Murugesan',
    categorySlug: 'sarees', material: 'Pure Mulberry Silk', technique: 'Korvai (interlocked border)',
    occasion: 'Wedding · Festive',
    mrp: 4500000, sellingPrice: 3800000,
    images: [IMG.saree_kanjeevaram, IMG.saree_red],
    badges: ['FOUNDER\'S EDIT', 'HANDLOOM VERIFIED', 'GI TAGGED'],
    aiTryOnEligible: true, inventory: 4, weight: 850,
  },
  {
    id: 'p8', slug: 'jaipuri-gold-polki-earrings', sku: 'NEE-JEW-002',
    name: 'Jaipuri Polki Earrings',
    poeticLine: 'Uncut diamonds. Quiet light.',
    description: 'Traditional uncut diamond polki set in 22k gold. Made by the karigars of Johari Bazaar, Jaipur.',
    craft: 'Polki Jadau', region: 'Jaipur', state: 'Rajasthan', artisanName: 'Ramesh Soni',
    categorySlug: 'jewellery', material: '22k Gold · Uncut Diamond', technique: 'Jadau setting',
    occasion: 'Wedding · Heirloom',
    mrp: 18500000, sellingPrice: 16800000,
    images: [IMG.jewellery_gold, IMG.jewellery_silver],
    badges: ['ATELIER PIECE', 'BIS HALLMARK'],
    aiTryOnEligible: true, inventory: 1, weight: 12,
  },
  {
    id: 'p9', slug: 'sandook-gift-trunk-medium', sku: 'NEE-GFT-001',
    name: 'The NEEJEE Sandook · Medium',
    poeticLine: 'A trunk. A finding. A signature.',
    description: 'Hand-finished mango wood Sandook with brass clasp and Phulkari lining. Curated with a saree, a fragrance, and an authenticity card.',
    craft: 'Wood · Brass · Curation', region: 'Saharanpur', state: 'UP', artisanName: 'NEEJEE Atelier',
    categorySlug: 'gifting', material: 'Mango Wood · Brass', technique: 'Hand-finished',
    occasion: 'Gifting · Bridal',
    mrp: 1500000, sellingPrice: 1200000,
    images: [IMG.sandook],
    badges: ['SIGNATURE', 'FOUNDER\'S EDIT'],
    aiTryOnEligible: false, inventory: 15, weight: 2400,
  },
  {
    id: 'p10', slug: 'pashmina-shawl-handspun', sku: 'NEE-MEN-001',
    name: 'Pashmina Shawl · Hand-spun',
    poeticLine: 'Spun on a charkha. Worn for a lifetime.',
    description: 'Pure Ladakhi pashmina, hand-spun and hand-woven in Kashmir. GI-certified. Lighter than air, warmer than wool.',
    craft: 'Pashmina', region: 'Srinagar', state: 'J&K', artisanName: 'Abdul Rashid',
    categorySlug: 'men', material: '100% Pashmina', technique: 'Hand-spun · Hand-woven',
    occasion: 'Winter · Formal',
    mrp: 2800000, sellingPrice: 2200000,
    images: [IMG.pashmina, IMG.saree_chanderi],
    badges: ['GI TAGGED', 'HANDLOOM VERIFIED'],
    aiTryOnEligible: true, inventory: 6, weight: 180,
  },
  {
    id: 'p11', slug: 'rose-gulab-attar', sku: 'NEE-FRA-002',
    name: 'Rose Gulab Attar',
    poeticLine: 'The smell of a Mughal garden at dawn.',
    description: 'Pure rose attar distilled from Kannauj roses. The grand-daughter of attars. 10ml in a hand-blown glass bottle.',
    craft: 'Attar', region: 'Kannauj', state: 'UP', artisanName: 'Mohan Lal Attarwale',
    categorySlug: 'fragrance', material: 'Pure Rose Attar · 10ml', technique: 'Deg-bhapka',
    occasion: 'Festive · Bridal',
    mrp: 380000, sellingPrice: 320000,
    images: [IMG.attar_rose, IMG.attar_bottle],
    badges: ['FOUNDER\'S EDIT'],
    aiTryOnEligible: false, inventory: 18, weight: 28,
  },
  {
    id: 'p12', slug: 'ajrakh-block-print-dupatta', sku: 'NEE-DUP-002',
    name: 'Ajrakh Block-Print Dupatta',
    poeticLine: 'Sixteen steps. Four colours. Endless meaning.',
    description: 'Hand block-printed Ajrakh from Ajrakhpur, Kutch. Natural indigo, madder, harda. Sixteen days, sixteen steps.',
    craft: 'Ajrakh · Block Print', region: 'Ajrakhpur', state: 'Gujarat', artisanName: 'Abdul Razzaq Khatri',
    categorySlug: 'dupattas', material: 'Cotton · Natural Dye', technique: '16-step block print',
    occasion: 'Everyday · Festive',
    mrp: 650000, sellingPrice: 480000,
    images: [IMG.ajrakh, IMG.dupatta_pink],
    badges: ['HANDLOOM VERIFIED', 'NATURAL DYE'],
    aiTryOnEligible: true, inventory: 9, weight: 220,
  },
  {
    id: 'p13', slug: 'paithani-peacock-deep-green', sku: 'NEE-SAR-004',
    name: 'Paithani Silk · Peacock Green',
    poeticLine: 'A peacock\'s feather, woven slow.',
    description: 'Hand-woven Paithani from Yeola, Maharashtra. The signature peacock motif takes 18 days to weave on the pallu alone.',
    craft: 'Paithani', region: 'Yeola', state: 'Maharashtra', artisanName: 'Suresh Bansode',
    categorySlug: 'sarees', material: 'Pure Silk', technique: 'Hand-loom · interlock weave',
    occasion: 'Wedding · Festive',
    mrp: 5800000, sellingPrice: 4900000,
    images: [IMG.saree_kanjeevaram, IMG.saree_red],
    badges: ['ATELIER PIECE', 'GI TAGGED', 'HANDLOOM VERIFIED'],
    aiTryOnEligible: true, inventory: 2, weight: 920,
    careInstructions: 'Professional dry-clean only. Roll in muslin. Air every 2 months.',
    sustainabilityNote: 'GI-tagged Yeola Paithani · 18 days on a single loom.',
  },
  {
    id: 'p14', slug: 'patola-double-ikat-red-blue', sku: 'NEE-SAR-005',
    name: 'Patola Double Ikat · Crimson',
    poeticLine: 'Tied twice. Coloured twice. Worn forever.',
    description: 'Authentic Patan Patola — the rarest weave in India. Both warp and weft dyed before weaving. Only three families still make it.',
    craft: 'Patola · Double Ikat', region: 'Patan', state: 'Gujarat', artisanName: 'Bharat Salvi',
    categorySlug: 'sarees', material: 'Pure Silk · Natural Dye', technique: 'Double-ikat (resist dye)',
    occasion: 'Heirloom · Wedding',
    mrp: 25000000, sellingPrice: 22000000,
    images: [IMG.saree_red, IMG.saree_kanjeevaram],
    badges: ['ATELIER PIECE', 'GI TAGGED', 'LIMITED DROP'],
    aiTryOnEligible: true, inventory: 1, weight: 780,
  },
  {
    id: 'p15', slug: 'kalamkari-block-print-saree', sku: 'NEE-SAR-006',
    name: 'Kalamkari Cotton Saree',
    poeticLine: 'Stories drawn with a pen-of-bamboo.',
    description: 'Hand-painted Kalamkari from Srikalahasti, AP. Vegetable dyes, bamboo pen, mythological narrative borders.',
    craft: 'Kalamkari', region: 'Srikalahasti', state: 'Andhra Pradesh', artisanName: 'M. Jagadeesh',
    categorySlug: 'sarees', material: 'Cotton · Vegetable Dye', technique: 'Hand-painted',
    occasion: 'Workwear · Everyday',
    mrp: 850000, sellingPrice: 620000,
    images: [IMG.saree_chanderi, IMG.dupatta_pink],
    badges: ['HANDLOOM VERIFIED', 'NATURAL DYE'],
    aiTryOnEligible: true, inventory: 5, weight: 380,
  },
  {
    id: 'p16', slug: 'temple-jewellery-jadau-necklace', sku: 'NEE-JEW-003',
    name: 'Temple Jadau Necklace · Gold',
    poeticLine: 'For temples once. For weddings now.',
    description: 'Traditional South Indian temple jewellery — gold-plated silver, uncut stones, antique finish.',
    craft: 'Temple Jewellery · Jadau', region: 'Madurai', state: 'Tamil Nadu', artisanName: 'V. Shankar',
    categorySlug: 'jewellery', material: 'Silver · Gold-plated · Uncut Ruby', technique: 'Jadau setting',
    occasion: 'Bridal · Festive',
    mrp: 12500000, sellingPrice: 10800000,
    images: [IMG.jewellery_gold, IMG.jewellery_jhumka],
    badges: ['ATELIER PIECE', 'BIS HALLMARK'],
    aiTryOnEligible: true, inventory: 2, weight: 85,
  },
  {
    id: 'p17', slug: 'meenakari-bangles-jaipur', sku: 'NEE-JEW-004',
    name: 'Meenakari Bangles · Set of Four',
    poeticLine: 'Enamel that holds the light.',
    description: 'Hand-painted Meenakari enamel on silver, set in deep blue, green, pink and gold. A set of four bangles.',
    craft: 'Meenakari', region: 'Jaipur', state: 'Rajasthan', artisanName: 'Lakshmi Kumawat',
    categorySlug: 'jewellery', material: 'Silver · Enamel', technique: 'Meenakari (fired enamel)',
    occasion: 'Festive · Bridal',
    mrp: 720000, sellingPrice: 580000,
    images: [IMG.jewellery_silver, IMG.jewellery_jhumka],
    badges: ['ARTISAN MADE'],
    aiTryOnEligible: true, inventory: 6, weight: 110,
  },
  {
    id: 'p18', slug: 'sandalwood-chandan-attar', sku: 'NEE-FRA-003',
    name: 'Mysore Sandalwood Attar',
    poeticLine: 'A temple, in ten millilitres.',
    description: 'Pure Mysore sandalwood attar — the rarest base in Indian perfumery. The forest, the temple, and the puja, all in one drop.',
    craft: 'Attar · Sandalwood', region: 'Mysore', state: 'Karnataka', artisanName: 'Devraj Iyengar',
    categorySlug: 'fragrance', material: 'Pure Chandan Attar · 10ml', technique: 'Steam distillation',
    occasion: 'Personal · Ritual',
    mrp: 580000, sellingPrice: 480000,
    images: [IMG.attar_bottle, IMG.attar_rose],
    badges: ['FOUNDER\'S EDIT', 'LIMITED DROP'],
    aiTryOnEligible: false, inventory: 14, weight: 32,
  },
  {
    id: 'p19', slug: 'sambhal-bone-china-tea-set', sku: 'NEE-HOM-002',
    name: 'Sambhal Bone-China Tea Set',
    poeticLine: 'For chai that needs to slow down.',
    description: 'Hand-painted bone-china from Sambhal, UP. Six cups, six saucers, one teapot. Indigo on cream.',
    craft: 'Bone-china · Hand-painted', region: 'Sambhal', state: 'Uttar Pradesh', artisanName: 'Anjali Mathur',
    categorySlug: 'home', material: 'Bone China', technique: 'Hand-painted under-glaze',
    occasion: 'Everyday Home',
    mrp: 980000, sellingPrice: 780000,
    images: [IMG.stoneware, IMG.pottery],
    badges: ['ARTISAN MADE'],
    aiTryOnEligible: false, aiRoomEligible: true, inventory: 4, weight: 2100,
  },
  {
    id: 'p20', slug: 'cane-bamboo-tray-tripura', sku: 'NEE-HOM-003',
    name: 'Cane & Bamboo Serving Tray',
    poeticLine: 'Woven by hand. Steady, like attention.',
    description: 'Cane and bamboo serving tray, hand-woven in Tripura. Holds chai, mithai, and a quiet afternoon.',
    craft: 'Cane Weaving', region: 'Agartala', state: 'Tripura', artisanName: 'Dipak Debnath',
    categorySlug: 'home', material: 'Cane · Bamboo', technique: 'Hand-woven',
    occasion: 'Everyday Home',
    mrp: 320000, sellingPrice: 240000,
    images: [IMG.stoneware, IMG.pottery],
    badges: ['ARTISAN MADE', 'SUSTAINABLE'],
    aiTryOnEligible: false, aiRoomEligible: true, inventory: 11, weight: 540,
  },
  {
    id: 'p21', slug: 'kashmiri-pashmina-shawl-ivory', sku: 'NEE-MEN-002',
    name: 'Kashmiri Pashmina · Ivory',
    poeticLine: 'A whisper, woven by hand.',
    description: 'Pure ivory pashmina with subtle tilla embroidery on the borders. Light enough to pass through a ring.',
    craft: 'Pashmina · Tilla', region: 'Srinagar', state: 'J&K', artisanName: 'Mehmood Wani',
    categorySlug: 'men', material: '100% Pashmina · Tilla thread', technique: 'Hand-spun · Hand-embroidered',
    occasion: 'Winter · Formal',
    mrp: 3500000, sellingPrice: 2900000,
    images: [IMG.pashmina, IMG.saree_chanderi],
    badges: ['GI TAGGED', 'FOUNDER\'S EDIT'],
    aiTryOnEligible: true, inventory: 4, weight: 200,
  },
  {
    id: 'p22', slug: 'lucknowi-chikankari-kurta-white', sku: 'NEE-WMN-001',
    name: 'Lucknowi Chikankari Kurta',
    poeticLine: 'White on white. Quiet as a courtyard.',
    description: 'Hand-embroidered Chikankari kurta from Lucknow. Six different stitches across one garment. Each takes weeks.',
    craft: 'Chikankari', region: 'Lucknow', state: 'Uttar Pradesh', artisanName: 'Salma Begum',
    categorySlug: 'kurtas', material: 'Cotton Mul · Cotton Thread', technique: 'Six-stitch hand embroidery',
    occasion: 'Workwear · Festive',
    mrp: 980000, sellingPrice: 720000,
    images: [IMG.saree_chanderi, IMG.dupatta_pink],
    badges: ['FOUNDER\'S EDIT', 'HANDLOOM VERIFIED'],
    aiTryOnEligible: true, inventory: 8, weight: 280,
  },
  {
    id: 'p23', slug: 'nehru-jacket-khadi-charcoal', sku: 'NEE-MEN-003',
    name: 'Khadi Nehru Jacket · Charcoal',
    poeticLine: 'The uniform of quiet authority.',
    description: 'Hand-spun, hand-woven khadi Nehru jacket in deep charcoal. Bone buttons. Worn well, worn long.',
    craft: 'Khadi', region: 'Wardha', state: 'Maharashtra', artisanName: 'Khadi Gram Udyog',
    categorySlug: 'men', material: '100% Khadi Cotton', technique: 'Hand-spun · Hand-woven',
    occasion: 'Formal · Festive',
    mrp: 580000, sellingPrice: 420000,
    images: [IMG.pashmina, IMG.sandook],
    badges: ['HANDLOOM VERIFIED', 'GI TAGGED'],
    aiTryOnEligible: true, inventory: 10, weight: 380,
  },
  {
    id: 'p24', slug: 'sandook-gift-trunk-grand', sku: 'NEE-GFT-002',
    name: 'The NEEJEE Sandook · Grand',
    poeticLine: 'A wedding. A homecoming. A finding.',
    description: 'The Grand Sandook — large mango wood trunk, Phulkari lining, brass hardware. Curated with Banarasi saree, jewellery, attar, and a hand-written note.',
    craft: 'Wood · Brass · Atelier Curation', region: 'Saharanpur', state: 'UP', artisanName: 'NEEJEE Atelier',
    categorySlug: 'gifting', material: 'Mango Wood · Brass · Phulkari', technique: 'Atelier-finished',
    occasion: 'Wedding · Bridal Trousseau',
    mrp: 6500000, sellingPrice: 5800000,
    images: [IMG.sandook, IMG.saree_red],
    badges: ['SIGNATURE', 'LIMITED DROP'],
    aiTryOnEligible: false, inventory: 3, weight: 4800,
  },
];

// ============ STORIES / JOURNAL ============
export const stories: Story[] = [
  {
    slug: 'why-we-built-neejee',
    title: 'Why we built NEEJEE',
    excerpt: 'I searched for years for the things I knew existed in India, and found nothing good enough online. So I built it.',
    body: 'India has the world\'s most beautiful craft, and the world\'s worst way of selling it...',
    image: IMG.brand_hero,
    category: 'FOUNDER', publishedAt: '2026-01-15',
  },
  {
    slug: 'fourteen-days-on-a-loom',
    title: 'Fourteen days on a loom in Varanasi',
    excerpt: 'A morning with Master Mohammed Salim and the pit-loom that has been in his family for three generations.',
    body: 'It is 6:15 am in Madanpura...',
    image: IMG.saree_banarasi,
    category: 'CRAFT', publishedAt: '2026-02-08',
  },
  {
    slug: 'how-to-store-a-banarasi',
    title: 'How to store a Banarasi (so it outlives you)',
    excerpt: 'Muslin, neem leaves, and three minutes every quarter. A practical guide from the women who have done it for centuries.',
    body: 'The wrong way to store a Banarasi is in a plastic bag in a cupboard...',
    image: IMG.saree_red,
    category: 'JOURNAL', publishedAt: '2026-02-22',
  },
];

// Export the image helper for other files
export const NEEJEE_IMG = IMG;

// ============ HELPERS ============
export const formatPrice = (paise: number): string =>
  '₹' + (paise / 100).toLocaleString('en-IN');

export const getProductBySlug = (slug: string): Product | undefined =>
  products.find(p => p.slug === slug);

export const getProductById = (id: string): Product | undefined =>
  products.find(p => p.id === id);

export const getProductsByCategory = (categorySlug: string): Product[] => {
  const sub = categories.filter(c => c.parentSlug === categorySlug).map(c => c.slug);
  return products.filter(p => p.categorySlug === categorySlug || sub.includes(p.categorySlug));
};

export const getFoundersEdit = (): Product[] =>
  products.filter(p => p.badges.includes('FOUNDER\'S EDIT'));

export const getLimitedDrops = (): Product[] =>
  products.filter(p => p.badges.includes('LIMITED DROP'));

export const getRelatedProducts = (product: Product, limit = 4): Product[] =>
  products.filter(p => p.id !== product.id && p.categorySlug === product.categorySlug).slice(0, limit);

export const getArtisanBySlug = (slug: string): Artisan | undefined =>
  artisans.find(a => a.slug === slug);

export const getStoryBySlug = (slug: string): Story | undefined =>
  stories.find(s => s.slug === slug);

export const searchProducts = (query: string): Product[] => {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.craft.toLowerCase().includes(q) ||
    p.region.toLowerCase().includes(q) ||
    p.material.toLowerCase().includes(q) ||
    p.artisanName.toLowerCase().includes(q)
  );
};
