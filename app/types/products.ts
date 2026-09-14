// ── Product SEO Auditor — Shared TypeScript Types ─────────────────────────────

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
  images: ProductImage[];
  seo: ProductSeoFields;
}

// ── SEO analysis types ────────────────────────────────────────────────────────

export type IssueSeverity = "high" | "medium" | "low";

export interface SEOIssue {
  field: string;
  message: string;
  severity: IssueSeverity;
  recommendation: string;
}

export interface AnalyzedProduct extends ScannedProduct {
  seoScore: number;
  issues: SEOIssue[];
  topIssue: SEOIssue | null;
}

// ── Recommendation types ──────────────────────────────────────────────────────

export interface Recommendation {
  field: string;
  message: string;
  severity: IssueSeverity;
  shortFix: string;
  explanation: string;
  stepByStepFix: string;
  /** Pre-generated suggested value (seo_title / seo_description / description). */
  suggestion?: string;
  /** Current value of the field in Shopify (null = not set). */
  currentValue?: string | null;
}

// ── Aggregate analysis types ──────────────────────────────────────────────────

export interface TopProblem {
  field: string;
  label: string;
  count: number;
  percentage: number;
}

// ── Database scan history ─────────────────────────────────────────────────────

/** Serialized Prisma ScanHistory record (dates as ISO strings for JSON transport). */
export interface DbScanRecord {
  id: string;
  shop: string;
  averageSeoScore: number;
  productsScanned: number;
  totalIssues: number;
  highSeverityIssues: number;
  createdAt: string; // ISO 8601
}

// ── Session-only scan history (deprecated — replaced by DbScanRecord) ─────────
/** @deprecated Use DbScanRecord instead. Kept for type compatibility during transition. */
export interface ScanHistoryEntry {
  id: string;
  scannedAt: string;
  totalCount: number;
  averageSeoScore: number;
  totalIssues: number;
  highSeverityIssues: number;
}

// ── Mutation result types ─────────────────────────────────────────────────────

export interface MutationResult {
  ok: boolean;
  error?: string;
}

export interface BulkFixResult {
  field: string;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: string[];
}

// ── Action return types (discriminated union) ─────────────────────────────────

export interface ScanSuccess {
  ok: true;
  products: AnalyzedProduct[];
  totalCount: number;
  averageSeoScore: number;
  totalIssues: number;
  highSeverityIssues: number;
  topProblems: TopProblem[];
  scannedAt: string;
}

export interface ScanError {
  ok: false;
  error: string;
}

export type ScanActionResult = ScanSuccess | ScanError;
