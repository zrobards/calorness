import { PrismaClient } from "@prisma/client";

// In development, Next.js hot-reloads modules on every save. Without this,
// each reload would open a new database connection pool until Postgres
// runs out of connections. We stash one client on globalThis and reuse it.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
