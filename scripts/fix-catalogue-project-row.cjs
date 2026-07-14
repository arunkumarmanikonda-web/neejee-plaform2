const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error('Pass project id');

  const row = await prisma.cmsPage.update({
    where: { id },
    data: {
      pageType: 'catalogue',
      template: 'catalogue_builder',
    },
    select: {
      id: true,
      slug: true,
      title: true,
      pageType: true,
      template: true,
      status: true,
    },
  });

  console.log(JSON.stringify(row, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });