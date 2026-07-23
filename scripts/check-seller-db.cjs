const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const sellerCount = await prisma.seller.count();
  const sample = await prisma.seller.findMany({
    take: 5,
    select: {
      id: true,
      email: true,
      businessName: true,
      contactName: true,
    },
    orderBy: { id: 'asc' },
  });

  console.log(JSON.stringify({ sellerCount, sample }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });