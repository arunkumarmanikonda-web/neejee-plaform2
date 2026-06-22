// NEEJEE Database Seed Script
// Run: npm run seed
// Requires: DATABASE_URL set, prisma db push done first
//
// This populates the DB with 12 products, 6 artisans, 10 categories, 3 stories,
// and a demo admin (admin@neejee.com / admin123) and customer (demo@neejee.com / neejee123).

import { PrismaClient } from '@prisma/client';
import { products, categories, artisans, stories } from '../lib/data';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌿 Seeding NEEJEE database...\n');

  // ============ ADMIN USERS ============
  const adminHash = await bcrypt.hash('admin123', 12);
  const customerHash = await bcrypt.hash('neejee123', 12);

  await prisma.user.upsert({
    where: { email: 'admin@neejee.com' },
    update: {},
    create: { email: 'admin@neejee.com', name: 'Nidhi Chauhan', passwordHash: adminHash, role: 'SUPER_ADMIN' },
  });
  await prisma.user.upsert({
    where: { email: 'demo@neejee.com' },
    update: {},
    create: { email: 'demo@neejee.com', name: 'Aanya M.', passwordHash: customerHash, role: 'CUSTOMER' },
  });
  console.log('✓ Users seeded (admin@neejee.com / admin123, demo@neejee.com / neejee123)');

  // ============ CATEGORIES ============
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        slug: cat.slug, name: cat.name,
        description: cat.description, image: cat.image,
      },
    });
  }
  console.log(`✓ ${categories.length} categories seeded`);

  // ============ SELLERS / ARTISANS (as Seller records) ============
  for (const a of artisans) {
    await prisma.seller.upsert({
      where: { email: `${a.slug}@artisan.neejee.com` },
      update: {},
      create: {
        businessName: a.name,
        contactName: a.name,
        email: `${a.slug}@artisan.neejee.com`,
        phone: '+919999999999',
        region: a.region,
        craft: a.craft,
        cluster: a.cluster,
        kycStatus: 'APPROVED',
        qualityScore: 4.8,
        commissionPct: 18,
        isNeejeeSelect: true,
      },
    });
  }
  console.log(`✓ ${artisans.length} artisan sellers seeded`);

  // ============ PRODUCTS ============
  for (const p of products) {
    const category = await prisma.category.findUnique({ where: { slug: p.categorySlug } });
    if (!category) continue;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug, sku: p.sku, name: p.name,
        poeticLine: p.poeticLine, description: p.description, story: p.story,
        craft: p.craft, region: p.region, state: p.state, artisanName: p.artisanName,
        categoryId: category.id, material: p.material, technique: p.technique, occasion: p.occasion,
        mrp: p.mrp, sellingPrice: p.sellingPrice,
        images: p.images, badges: p.badges,
        status: 'ACTIVE',
        aiTryOnEligible: p.aiTryOnEligible,
        aiRoomEligible: p.aiRoomEligible || false,
        careInstructions: p.careInstructions,
        sustainabilityNote: p.sustainabilityNote,
        variants: { create: [{ sku: p.sku + '-V1', inventory: p.inventory, sellingPrice: p.sellingPrice }] },
      },
    });
  }
  console.log(`✓ ${products.length} products seeded`);

  // ============ CMS PAGES ============
  await prisma.cmsPage.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about', title: 'About · Why we exist', template: 'editorial',
      sections: [{ type: 'hero', heading: 'Why we exist.' }],
      status: 'PUBLISHED', publishedAt: new Date(),
    },
  });
  console.log('✓ CMS pages seeded');

  // ============ COUPONS ============
  await prisma.coupon.upsert({
    where: { code: 'WELCOME10' },
    update: {},
    create: { code: 'WELCOME10', type: 'PERCENT', value: 10, minCart: 250000, maxUses: 1000 },
  });
  await prisma.coupon.upsert({
    where: { code: 'FOUNDER' },
    update: {},
    create: { code: 'FOUNDER', type: 'FLAT', value: 50000, minCart: 500000, maxUses: 500 },
  });
  console.log('✓ Coupons seeded');

  console.log('\n🎉 Seed complete!\n');
  console.log('Sign in at /login with:');
  console.log('  Admin    → admin@neejee.com / admin123');
  console.log('  Customer → demo@neejee.com / neejee123\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
