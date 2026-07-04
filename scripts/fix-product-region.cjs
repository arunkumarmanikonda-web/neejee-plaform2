const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const row = await prisma.product.findFirst({
    where: {
      OR: [
        { id: "cmqeykp200004r155nwdhc5qx" },
        { slug: "Istanbul-Ceramic-Mushroom-Lamp" },
        { sku: "NEE-HOM-LIG-HAN-0001" }
      ]
    },
    select: {
      id: true,
      slug: true,
      sku: true,
      name: true,
      region: true
    }
  });

  console.log("BEFORE:", row);

  if (!row) {
    throw new Error("Product not found");
  }

  if (row.region === "Instanbul") {
    const updated = await prisma.product.update({
      where: { id: row.id },
      data: { region: "Istanbul" },
      select: {
        id: true,
        slug: true,
        sku: true,
        name: true,
        region: true
      }
    });

    console.log("AFTER:", updated);
  } else {
    console.log("No update needed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
