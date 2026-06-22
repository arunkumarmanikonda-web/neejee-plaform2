-- Sprint 9.32 — Seed editable Founder Note CMS page
-- Idempotent. Safe to re-run.
INSERT INTO "CmsPage" ("id", "slug", "title", "template", "sections", "status", "pageType", "tags", "featured", "createdAt", "updatedAt")
SELECT
  'cms_home_founder_note',
  'home-founder-note',
  'Homepage Founder Note',
  'single-text',
  '[{"type":"text","data":{"body":"It began with one saree. Woven by Ramji bhai in Varanasi, over fourteen days, on a pit-loom older than him.\n\nAnd then I realised he was one of thousands. The weavers, the potters, the carpenters, the brassworkers, the attar-makers, the dyers, the embroiderers, the hands that have shaped India for centuries, were vanishing into the noise of glass-fronted malls and over-hyped digital platforms.\n\nSo I built one place to find them. One spotlight. One honest price."}}]'::jsonb,
  'PUBLISHED',
  'page',
  ARRAY['homepage','editorial']::TEXT[],
  false,
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "CmsPage" WHERE "slug" = 'home-founder-note');
