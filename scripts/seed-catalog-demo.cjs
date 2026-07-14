const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'catalogue-demo' },
    update: {
      name: 'Catalogue Demo',
    },
    create: {
      slug: 'catalogue-demo',
      name: 'Catalogue Demo',
    },
    select: {
      id: true,
      slug: true,
      name: true,
    },
  });

  const product = await prisma.product.upsert({
    where: { slug: 'catalogue-demo-product' },
    update: {
      sku: 'CAT-DEMO-001',
      name: 'Catalogue Demo Product',
      categoryId: category.id,
      mrp: 129900,
      sellingPrice: 99900,
      salePrice: 99900,
      status: 'ACTIVE',
      images: [
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80'
      ],
      catalogueExclude: false,
      catalogueFeatured: true,
      cataloguePinHero: true,
      shortName: 'Demo Product',
      description: 'Demo export product for the local catalogue builder.',
      poeticLine: 'A quiet premium demo for export validation.',
      story: 'This product exists purely to validate the catalogue export pipeline in local development.',
      craft: 'Hand-finished',
      region: 'India',
      material: 'Brass',
      technique: 'Cast and polished',
      occasion: 'Gifting',
    },
    create: {
      slug: 'catalogue-demo-product',
      sku: 'CAT-DEMO-001',
      name: 'Catalogue Demo Product',
      categoryId: category.id,
      mrp: 129900,
      sellingPrice: 99900,
      salePrice: 99900,
      status: 'ACTIVE',
      images: [
        'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80'
      ],
      catalogueExclude: false,
      catalogueFeatured: true,
      cataloguePinHero: true,
      shortName: 'Demo Product',
      description: 'Demo export product for the local catalogue builder.',
      poeticLine: 'A quiet premium demo for export validation.',
      story: 'This product exists purely to validate the catalogue export pipeline in local development.',
      craft: 'Hand-finished',
      region: 'India',
      material: 'Brass',
      technique: 'Cast and polished',
      occasion: 'Gifting',
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      name: true,
      status: true,
      categoryId: true,
    },
  });

  console.log(JSON.stringify({ category, product }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
