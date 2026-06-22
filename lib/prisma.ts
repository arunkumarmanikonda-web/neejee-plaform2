// Prisma client singleton — prevents creating multiple connections in dev hot-reload
// Designed to fail GRACEFULLY at build time (when DATABASE_URL may not be available)
// and only actually connect when an API route uses it.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    // Disable strict checks at construction; let the API routes handle missing DB
    errorFormat: 'minimal',
  });
}

// Use a Proxy so we only actually instantiate Prisma on first real use.
// This way `import { prisma }` at the top of a route file never crashes the build.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!globalForPrisma.prisma) {
      try {
        globalForPrisma.prisma = createPrismaClient();
      } catch (e) {
        // If DATABASE_URL is missing or Prisma client not generated, return a stub
        // so callers can catch the error and fall back to mock data.
        console.warn('[prisma] Failed to initialise client:', (e as Error).message);
        throw e;
      }
    }
    const client = globalForPrisma.prisma as any;
    return client[prop];
  },
});
