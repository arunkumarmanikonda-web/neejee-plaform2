const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@neejee.local';
  const password = 'Admin@12345';
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: 'Local Admin',
      passwordHash,
      role: 'ADMIN',
      emailVerified: new Date(),
      primaryAuthMethod: 'password',
    },
    create: {
      email,
      name: 'Local Admin',
      passwordHash,
      role: 'ADMIN',
      emailVerified: new Date(),
      primaryAuthMethod: 'password',
    },
    select: {
      id: true,
      email: true,
      role: true,
      name: true,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    email,
    password,
    role: user.role,
    id: user.id
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
