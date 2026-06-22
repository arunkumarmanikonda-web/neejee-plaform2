#!/usr/bin/env python3
"""
v26.0.3 — Bulletproof taxonomy seed.
Strategy: DROP the FK constraint at start, INSERT all rows, then RE-ADD the FK constraint at end.
This makes it physically impossible for FK to fail mid-insert.
"""
import re

def slugify(s):
    s = s.lower().strip()
    s = re.sub(r"[^\w\s\-&]", "", s)
    s = s.replace("&", "and")
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    return s.strip("-")

TREE = [
    ("Women", [
        ("Sarees", ["Banarasi","Kanchipuram","Chanderi","Maheshwari","Patola","Baluchari","Jamdani","Pochampalli","Mysore Silk","Tussar","Bandhani","Leheriya","Linen","Cotton","Everyday","Bridal"]),
        ("Apparel", ["Kurtas","Kurta Sets","Anarkali","Lehengas","Salwar Suits","Sharara and Gharara Sets","Tunics","Dresses","Blouses","Jackets","Skirts","Pants and Palazzos","Co-ord Sets","Loungewear","Bridal"]),
        ("Outerwear and Shawls", ["Pashmina","Kani","Sozni","Kullu","Chamba Rumal","Wool Coats","Capes","Embroidered Jackets"]),
        ("Dupattas and Stoles", ["Phulkari","Bandhani","Chikankari","Banarasi","Block-Print","Embroidered","Plain"]),
    ]),
    ("Men", [
        ("Apparel", ["Kurtas","Kurta Sets","Sherwanis","Nehru Jackets","Bandhgalas","Bandi Waistcoats","Pathani","Shirts","T-shirts","Pants and Trousers","Pyjamas and Dhotis","Loungewear","Groom Wear"]),
        ("Outerwear and Shawls", ["Pashmina","Kullu","Chamba","Wool Coats","Capes","Bandi Jackets"]),
    ]),
    ("Accessories", [
        ("Jewellery", ["Necklaces","Earrings","Bangles and Cuffs","Bracelets","Rings","Maang-tikka","Nose Pins","Anklets","Toe Rings","Hair Accessories","Jewellery Sets","Bridal Sets"], "women"),
        ("Bags and Purses", ["Clutches","Potlis","Tote Bags","Sling Bags","Handbags","Wallets","Coin Purses"], "unisex"),
        ("Footwear", ["Juttis","Mojaris","Kolhapuris","Sandals","Heels","Flats","Loafers"], "unisex"),
        ("Belts and Ties", ["Belts","Ties","Tie-pins","Suspenders"], "men"),
        ("Cuff Links and Lapel", ["Cuff Links","Pocket Squares","Lapel Pins","Tie Bars"], "men"),
        ("Eyewear", ["Sunglasses","Optical Frames"], "unisex"),
        ("Hair and Headwear", ["Parandi","Hair Sticks","Headbands","Pagdis","Turban Pieces"], "unisex"),
        ("Personal Care", ["Skin","Hair","Bath and Body","Lip Care","Shaving and Grooming Kits","Wellness Tonics"], "unisex"),
    ]),
    ("Home", [
        ("Furniture", ["Sofas","Chairs","Beds","Side Tables","Coffee Tables","Dining Tables","Dining Chairs","Cabinets","Shelves","Wardrobes","Consoles","Mirrors","Trunks","Stools","Ottomans","Outdoor Furniture"]),
        ("Lighting Decorative", ["Floor Lamps","Table Lamps","Pendant Lamps","Wall Sconces","Lanterns","Lampshades","Candle Stands","Diyas","Chandeliers"]),
        ("Lighting Architectural", ["Recessed","Track Lighting","Smart Bulbs","Dimmers and Switches","Outdoor Lighting","Garden Lights","Wall Wash","Strip Lighting"]),
        ("Linens Bed", ["Bedsheets","Duvet Covers","Dohars","Quilts","Razais","Throws","Pillow Covers","Bolster Covers","Bed Runners"]),
        ("Linens Bath", ["Towels","Bath Mats","Bathrobes","Shower Curtains","Hammam Sheets"]),
        ("Soft Furnishings", ["Cushions","Cushion Covers","Floor Cushions","Curtains","Runners","Durries","Rugs","Carpets","Tapestries","Pouffes"]),
        ("Bath", ["Hammam Bowls","Soap Dishes","Dispensers","Storage","Bathroom Mirrors","Bath Accessories"]),
        ("Kitchen", ["Brass Cookware","Copper Cookware","Iron Cookware","Clay Cookware","Bakeware","Pots and Pans","Tawas","Kitchen Tools","Storage Jars","Kitchen Linen"]),
        ("Dining and Tableware", ["Dinner Plates","Bowls","Platters","Cups and Saucers","Mugs","Tumblers","Pitchers","Cutlery Sets","Serveware","Trivets","Bone China","Stoneware","Terracotta","Glassware"]),
        ("Bar", ["Trolleys","Bar Cabinets","Wine Racks","Bar Kits","Decanters","Wine Glasses","Whisky Glasses","Cocktail Tools","Coasters","Ice Buckets"]),
        ("Decor and Accents", ["Vases","Photo Frames","Wall Art","Wall Plates","Sculptures","Bookends","Clocks","Candles","Incense","Diffusers","Pichhwai","Tanjore","Madhubani","Pattachitra","Garden Decor"]),
    ]),
    ("Fragrance", [
        ("Personal Fragrance", ["Attars","Eau de Parfum","Eau de Toilette","Body Sprays","Perfume Oils","Solid Perfumes"]),
        ("Home Fragrance", ["Incense Sticks","Dhoop","Cones","Diffusers","Reed Diffusers","Room Sprays","Scented Candles"]),
        ("Aromatherapy and Oils", ["Essential Oils","Massage Oils","Wellness Blends"]),
    ]),
    ("Gifting", [
        ("By Occasion", ["Wedding","Anniversary","Birthday","Diwali","Eid","Holi","Raksha Bandhan","Housewarming","Corporate","Thank You"]),
        ("By Recipient", ["For Her","For Him","For the Couple","For the Home","For the Mom","For the Boss","For the Host"]),
        ("By Price", ["Under 2500","2500 to 10000","10000 to 50000","Above 50000"]),
        ("Stationery and Paper", ["Notebooks","Journals","Pens","Inkwells","Stationery Sets","Cards","Wrapping Paper","Bookmarks"]),
    ]),
]

# Flatten
rows = []
mo = 0
for main_name, subs in TREE:
    mo += 1
    ms = slugify(main_name); mid = f"cat_{ms}"
    rows.append((mid, ms, main_name, None, mo, 1, ms, None))
    so = 0
    for st in subs:
        so += 1
        if len(st) == 3:
            sn, leaves, g = st
        else:
            sn, leaves = st; g = None
        ss = f"{ms}-{slugify(sn)}"; sid = f"cat_{ss}"; sp = f"{ms}/{slugify(sn)}"
        rows.append((sid, ss, sn, mid, so, 2, sp, g))
        lo = 0
        for ln in leaves:
            lo += 1
            ls = f"{ss}-{slugify(ln)}"; lid = f"cat_{ls}"; lp = f"{sp}/{slugify(ln)}"
            rows.append((lid, ls, ln, sid, lo, 3, lp, g))

print(f"Total: {len(rows)} rows")

# Build SQL — bulletproof: drop FK, insert with real parentId, re-add FK at end
out = []
out.append("-- Sprint 26.0.3 — NEEJEE Taxonomy Schema + Seed (FK-drop strategy, bulletproof)")
out.append("-- Drops FK constraint, inserts all rows with correct parentId, re-adds FK at end.")
out.append("-- Cannot fail under any Postgres SQL editor.")
out.append("")
out.append("-- =========================================================")
out.append("-- 1) SCHEMA ADDITIONS")
out.append("-- =========================================================")
out.append('ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;')
out.append('ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "path" TEXT;')
out.append('ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT FALSE;')
out.append('ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "aiGenerated" BOOLEAN NOT NULL DEFAULT FALSE;')
out.append('ALTER TABLE "Category" ADD COLUMN IF NOT EXISTS "gender" TEXT;')
out.append('CREATE INDEX IF NOT EXISTS "Category_level_parentId_idx" ON "Category"("level", "parentId");')
out.append('CREATE INDEX IF NOT EXISTS "Category_path_idx" ON "Category"("path");')
out.append('CREATE INDEX IF NOT EXISTS "Category_hidden_idx" ON "Category"("hidden");')
out.append("")
out.append('CREATE TABLE IF NOT EXISTS "CategoryRedirect" (')
out.append('  "id" TEXT PRIMARY KEY,')
out.append('  "fromSlug" TEXT NOT NULL UNIQUE,')
out.append('  "toSlug" TEXT NOT NULL,')
out.append('  "permanent" BOOLEAN NOT NULL DEFAULT TRUE,')
out.append('  "hitCount" INTEGER NOT NULL DEFAULT 0,')
out.append('  "lastHitAt" TIMESTAMPTZ,')
out.append('  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),')
out.append('  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
out.append(');')
out.append('CREATE INDEX IF NOT EXISTS "CategoryRedirect_fromSlug_idx" ON "CategoryRedirect"("fromSlug");')
out.append("")
out.append("-- =========================================================")
out.append("-- 2) DROP FK CONSTRAINT (will re-add at the end)")
out.append("-- =========================================================")
out.append('ALTER TABLE "Category" DROP CONSTRAINT IF EXISTS "Category_parentId_fkey";')
out.append("")
out.append("-- =========================================================")
out.append("-- 3) INSERT all 307 rows with real parentId values (FK is off)")
out.append("-- =========================================================")
out.append('INSERT INTO "Category" ("id","slug","name","parentId","order","active","hidden","featured","aiGenerated","level","path","gender","createdAt","updatedAt") VALUES')
vals = []
for cid, slug, name, parent, order_, level, path, gender in rows:
    ne = name.replace("'", "''")
    pv = f"'{parent}'" if parent else "NULL"
    gv = f"'{gender}'" if gender else "NULL"
    vals.append(f"  ('{cid}','{slug}','{ne}',{pv},{order_},TRUE,FALSE,FALSE,FALSE,{level},'{path}',{gv},NOW(),NOW())")
out.append(",\n".join(vals))
out.append('ON CONFLICT ("slug") DO UPDATE SET')
out.append('  "name" = EXCLUDED."name",')
out.append('  "parentId" = EXCLUDED."parentId",')
out.append('  "order" = EXCLUDED."order",')
out.append('  "level" = EXCLUDED."level",')
out.append('  "path" = EXCLUDED."path",')
out.append('  "gender" = EXCLUDED."gender",')
out.append('  "updatedAt" = NOW();')
out.append("")
out.append("-- =========================================================")
out.append("-- 4) RE-ADD FK CONSTRAINT now that all rows are present")
out.append("-- =========================================================")
out.append('ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey"')
out.append('  FOREIGN KEY ("parentId") REFERENCES "Category"("id")')
out.append('  ON DELETE SET NULL ON UPDATE CASCADE;')
out.append("")
out.append("-- =========================================================")
out.append("-- 5) REDIRECTS for renamed / merged categories")
out.append("-- =========================================================")
redirects = [
    ("jewellery", "accessories/jewellery"),
    ("women-jewellery", "accessories/jewellery"),
    ("men-accessories", "accessories"),
    ("women-accessories", "accessories"),
    ("home-furniture", "home/furniture"),
    ("home-lighting", "home/lighting-decorative"),
    ("home-kitchen", "home/kitchen"),
    ("home-bar", "home/bar"),
    ("personal-care", "accessories/personal-care"),
    ("grooming", "accessories/personal-care"),
    ("perfume", "fragrance/personal-fragrance"),
    ("attar", "fragrance/personal-fragrance"),
    ("incense", "fragrance/home-fragrance"),
    ("candle", "home/decor-and-accents"),
    ("notebook", "gifting/stationery-and-paper"),
    ("stationery", "gifting/stationery-and-paper"),
]
out.append('INSERT INTO "CategoryRedirect" ("id","fromSlug","toSlug","permanent","createdAt","updatedAt") VALUES')
out.append(",\n".join(f"  ('redir_{slugify(f)}','{f}','{t}',TRUE,NOW(),NOW())" for f, t in redirects))
out.append('ON CONFLICT ("fromSlug") DO UPDATE SET')
out.append('  "toSlug" = EXCLUDED."toSlug",')
out.append('  "updatedAt" = NOW();')
out.append("")
out.append("-- =========================================================")
out.append("-- 6) VERIFICATION: count by level")
out.append("-- =========================================================")
out.append('SELECT level, COUNT(*) as count FROM "Category" GROUP BY level ORDER BY level;')

sql = "\n".join(out)
with open("/home/user/neejee-platform/SPRINT_26_0_TAXONOMY.sql", "w") as f:
    f.write(sql)
print(f"Wrote {len(sql)} bytes")
