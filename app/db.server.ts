import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// ── Singleton pattern ──────────────────────────────────────────────────────────
// Create exactly ONE PrismaClient instance for the lifetime of the process.
//
// Problem this solves:
//   In development, React Router's hot-module reloading re-evaluates server
//   modules on every file change. Without this guard, each reload creates a
//   new PrismaClient — each with its own connection pool. After a few reloads
//   the database connection limit is exhausted.
//
//   In the OLD pattern (the template default) the production branch was also
//   broken: `global.prismaGlobal` was never assigned in production, so
//   `global.prismaGlobal ?? new PrismaClient()` always returned a fresh client.
//
// Fix:
//   Always create ONE instance (`prisma`), then store it in the global only in
//   development (so HMR reloads pick it up). In production the module is loaded
//   once per process — the `global` trick is unnecessary and intentionally skipped.

const prisma = global.prismaGlobal ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

export default prisma;
