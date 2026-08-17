import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

/**
 * Next.js keeps this singleton alive across hot reloads in development. When a
 * Prisma model is added and the client is regenerated, that cached instance is
 * still the old class and does not expose the new model delegate. Reuse the
 * singleton only when it contains every delegate from the current generated
 * client; otherwise create a fresh instance without requiring a dev restart.
 */
function hasCurrentModelDelegates(client: PrismaClient) {
  const delegates = client as unknown as Record<string, unknown>;

  return Object.values(Prisma.ModelName).every((modelName) => {
    const delegateName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
    return delegateName in delegates;
  });
}

const cachedPrisma = globalForPrisma.prisma;

export const prisma =
  cachedPrisma && hasCurrentModelDelegates(cachedPrisma) ? cachedPrisma : createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
