// ── Product SEO Auditor — Scan History Server Functions ───────────────────────
// Server-only module. The `.server.ts` suffix ensures this file is never
// bundled into client-side JavaScript by React Router / Vite.
//
// All queries include a `where: { shop }` clause — this is the multi-tenant
// isolation boundary. Every caller must pass the authenticated shop domain
// obtained from `session.shop` (i.e. never from user-supplied input).

import { Prisma } from "@prisma/client";
import type { TopProblem } from "../types/products";
import prisma from "../db.server";

// ── Write ─────────────────────────────────────────────────────────────────────

interface SaveScanParams {
  shop: string;
  averageSeoScore: number;
  productsScanned: number;
  totalIssues: number;
  highSeverityIssues: number;
  topProblems: TopProblem[];
}

/**
 * Persists a completed SEO scan to the database.
 *
 * Called from the dashboard action after `analyzeProducts()` completes.
 * The caller wraps this in a try/catch so a DB write failure never
 * invalidates the scan result shown to the merchant.
 */
export async function saveScanHistory(params: SaveScanParams): Promise<void> {
  await prisma.scanHistory.create({
    data: {
      shop: params.shop,
      averageSeoScore: params.averageSeoScore,
      productsScanned: params.productsScanned,
      totalIssues: params.totalIssues,
      highSeverityIssues: params.highSeverityIssues,
      // Prisma's Json column requires InputJsonValue. The TopProblem[] interface
      // is a plain serializable object so this cast is safe.
      topProblems: params.topProblems as unknown as Prisma.InputJsonValue,
    },
  });
}

// ── Read ──────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent scans for a given shop, newest first.
 *
 * Intentionally does NOT select `topProblems` — the history sidebar only
 * needs summary counts. Keeping the payload small is important when a store
 * has accumulated many scans.
 *
 * @param shop  - Shopify store domain, e.g. "example.myshopify.com"
 * @param limit - Maximum records to return. Default: 5.
 */
export async function getRecentScans(shop: string, limit = 5) {
  return prisma.scanHistory.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      shop: true,
      averageSeoScore: true,
      productsScanned: true,
      totalIssues: true,
      highSeverityIssues: true,
      createdAt: true,
    },
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Deletes all scan history records for a shop.
 *
 * Called by the `app/uninstalled` webhook handler to clean up merchant data.
 * Safe to call even if no records exist — Prisma deleteMany is idempotent.
 */
export async function deleteShopScanHistory(shop: string): Promise<void> {
  await prisma.scanHistory.deleteMany({ where: { shop } });
}
