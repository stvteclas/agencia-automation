import { PrismaClient } from "@prisma/client";

// Mismo patrón singleton que turnos-app, para no agotar conexiones de
// Postgres con cada hot-reload en desarrollo.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
