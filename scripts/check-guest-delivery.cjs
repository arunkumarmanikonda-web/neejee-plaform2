// Read-only release preflight. Run against the release target after the SQL migration.
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const rows = await db.$queryRaw`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Address' AND column_name = 'userId'
  `;
  if (rows[0]?.is_nullable !== 'YES') throw new Error('Apply 20261127010000_guest_order_shipping_addresses before deploying guest checkout.');
  console.log('Guest order delivery address schema is ready.');
})().catch(() => {
  console.error('Guest delivery preflight failed. Verify database connectivity and migration 20261127010000_guest_order_shipping_addresses.');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
