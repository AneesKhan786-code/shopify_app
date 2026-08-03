// ── Product SEO Auditor — Shared TypeScript Types ─────────────────────────────
// Used by both server modules (lib/*.server.ts) and the client route.

// ── Raw product types (from GraphQL) ─────────────────────────────────────────

export type ProductStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface ProductImage {
  id: string;
  url: string;
  altText: string | null;
}

export interface ProductSeoFields {
  title: string | null;
  description: string | null;
}

export interface ScannedProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  status: ProductStatus;
  /** Only the first image is fetched — sufficient for alt-text audit. */
  images: ProductImage[];
  seo: ProductSeoFields;
}

// ── SEO analysis types ────────────────────────────────────────────────────────

export type IssueSeverity = "high" | "medium" | "low";

export interface SEOIssue {
  /** Which field this issue relates to (e.g. "seo_title", "description"). */
  field: string;
  /** Human-readable description of what is wrong. */
  message: string;
  severity: IssueSeverity;
  /** Actionable fix suggestion shown in the dashboard table. */
  recommendation: string;
}

/**
 * A ScannedProduct enriched with SEO analysis results.
 * Extends the raw product with score, issues list and the single top issue.
 */
export interface AnalyzedProduct extends ScannedProduct {
  /** 0–100 score computed by the SEO analyzer. */
  seoScore: number;
  /** All issues found for this product, sorted high → medium → low. */
  issues: SEOIssue[];
  /** The single highest-severity issue, or null if there are none. */
  topIssue: SEOIssue | null;
}

// ── Action return types (discriminated union) ─────────────────────────────────

export interface ScanSuccess {
  ok: true;
  products: AnalyzedProduct[];
  totalCount: number;
  /** Average SEO score across all scanned products (0–100). */
  averageSeoScore: number;
  /** Sum of all issues across all products. */
  totalIssues: number;
  scannedAt: string; // ISO 8601
}

export interface ScanError {
  ok: false;
  error: string;
}

export type ScanActionResult = ScanSuccess | ScanError;
