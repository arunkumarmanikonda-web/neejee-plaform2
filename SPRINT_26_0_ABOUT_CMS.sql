-- Sprint 26.0 — Seed editable About Page CMS row
-- Idempotent. Safe to re-run.
INSERT INTO "CmsPage" ("id", "slug", "title", "template", "sections", "status", "pageType", "tags", "featured", "createdAt", "updatedAt")
SELECT
  'cms_about_page',
  'about-page',
  'About Page (Why We Exist)',
  'editorial',
  '[
    {"type":"hero","data":{"eyebrow":"ABOUT","title":"Why we exist.","subtitle":"The rarest things in India are rarely the hardest to make. They are simply the hardest to find."}},
    {"type":"quote","data":{"text":"The rarest things in India are rarely the hardest to make. They are simply the hardest to find.","attribution":"Nidhi Chauhan, Founder"}},
    {"type":"text","data":{"body":"NEEJEE began with a question I could not answer for myself: where do I buy the things I know India makes?\n\nIn the north, I knew there was a Banarasi being woven on a pit-loom in Varanasi, a Chikankari shadow-stitch being whispered onto white muslin in Lucknow, a Zardozi being couched in gold next to it. A Phulkari being threaded in vintage pink in Amritsar, a Jutti being stitched in Patiala. A Pashmina being spun from changthangi goat-down in Kashmir, a Kani shawl growing one motif a day on a loom, a Sozni needle following a paisley for three winters.\n\nIn the heart of the country, a Maheshwari being woven on the banks of the Narmada, a Chanderi so light it floats, a Bagh block-print laid out on the river-bed of Madhya Pradesh, a Gond painting in dots and stripes, a Dhokra figure cast in lost-wax in Bastar. In Rajasthan, a Gota Patti border being couched in Jaipur, a Bandhani being tied knot-by-knot in Jodhpur.\n\nIn Gujarat, a Patola being double-ikat-tied in Patan for six months. In Bihar, a Madhubani being drawn by a woman on the wall of her own home. In Bengal, a Baluchari telling Mahabharata stories in weft, a Jamdani as light as breath, a Kantha stitched from old saris.\n\nIn the south, a Kalamkari being hand-drawn with a tamarind-twig pen in Srikalahasti, a Kanchipuram silk being weighted with gold zari, a Pochampalli ikat being tied before it ever touches the loom. In Tamil Nadu, a Thanjavur painting layered in gold leaf, a Swamimalai bronze cast in the lost-wax tradition of the Cholas. In Kerala, an Aranmula Kannadi metal mirror.\n\nIn the northeast, a Muga silk in Assam glowing gold without a single dye, an Eri silk in peace-silk, a Naga shawl on a backstrap loom, a Manipuri Wangkhei Phee, an Apatani textile in Arunachal.\n\nBut every search led me to either a mass-produced copy, or a designer interpretation. Never the thing itself. Never the hands that made it.\n\nSo I started travelling. Three years. Eighteen states. Two hundred and forty artisan clusters. And I found that the rare, the rooted, the personal still exists. It is just quiet.\n\nNEEJEE is the place I built for all of them. Every piece is found, personal, and named. The maker is named. The region is named. The technique is named. We pay our artisans in advance and on time. We never compromise on the thing itself."}},
    {"type":"cta","data":{"ctaText":"Begin Finding","ctaUrl":"/"}}
  ]'::jsonb,
  'PUBLISHED',
  'page',
  ARRAY['about','editorial']::TEXT[],
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "CmsPage" WHERE "slug" = 'about-page');
