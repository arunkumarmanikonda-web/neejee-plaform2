const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const idOrSlug = process.argv[2];
  if (!idOrSlug) throw new Error('Pass project id or slug');

  const rows = await prisma.cmsPage.findMany({
    where: {
      OR: [{ id: idOrSlug }, { slug: idOrSlug }],
    },
    select: {
      id: true,
      slug: true,
      title: true,
      pageType: true,
      template: true,
      status: true,
      updatedAt: true,
    },
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });