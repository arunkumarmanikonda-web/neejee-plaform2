const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.cmsPage.findMany({
    where: {
      OR: [
        { id: 'cmrjn6oq10002ut9rd2zwwfcl' },
        { slug: 'local-demo-catalogue' }
      ]
    },
    select: {
      id: true,
      slug: true,
      title: true,
      template: true,
      pageType: true,
      status: true,
      sections: true,
      createdAt: true,
      updatedAt: true
    }
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
