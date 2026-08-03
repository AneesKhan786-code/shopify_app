// ── Product SEO Auditor — SEO Analysis Engine ─────────────────────────────────
// Server-only module. Never imported from client code.
//
// Scoring model: starts at 100 and deducts points per issue.
// Each check is independent — a missing field does not also trigger
// a length check for that same field.

import type {
  ScannedProduct,
  AnalyzedProduct,
  SEOIssue,
  IssueSeverity,
} from "../types/products";

// ── Thresholds ────────────────────────────────────────────────────────────────

const SEO_TITLE_MIN_LEN = 30;
const SEO_TITLE_MAX_LEN = 70;
const SEO_DESC_MIN_LEN = 70;
const SEO_DESC_MAX_LEN = 160;
const PRODUCT_DESC_MIN_LEN = 50;
const PRODUCT_TITLE_MIN_LEN = 10;

// ── Score deductions per issue type ──────────────────────────────────────────

const DEDUCTIONS = {
  SEO_TITLE_MISSING: 20,
  SEO_TITLE_TOO_SHORT: 10,
  SEO_TITLE_TOO_LONG: 5,
  SEO_DESC_MISSING: 20,
  SEO_DESC_TOO_SHORT: 10,
  SEO_DESC_TOO_LONG: 5,
  PRODUCT_DESC_MISSING: 15,
  PRODUCT_DESC_TOO_SHORT: 8,
  PRODUCT_TITLE_TOO_SHORT: 15,
  NO_IMAGES: 10,
  MISSING_ALT_TEXT: 10,
} as const;

// ── Helper ────────────────────────────────────────────────────────────────────

function mkIssue(
  field: string,
  message: string,
  severity: IssueSeverity,
  recommendation: string
): SEOIssue {
  return { field, message, severity, recommendation };
}

function severityWeight(s: IssueSeverity): number {
  return s === "high" ? 3 : s === "medium" ? 2 : 1;
}

// ── Per-product analyzer ──────────────────────────────────────────────────────

/**
 * Analyzes a single ScannedProduct and returns an AnalyzedProduct with
 * SEO score (0–100), sorted issues list, and the top (highest-severity) issue.
 */
export function analyzeProduct(product: ScannedProduct): AnalyzedProduct {
  const issues: SEOIssue[] = [];
  let score = 100;

  // ── 1. SEO Title ────────────────────────────────────────────────────────────
  const seoTitle = product.seo.title?.trim() ?? "";
  if (seoTitle === "") {
    issues.push(
      mkIssue(
        "seo_title",
        "SEO title is missing",
        "high",
        `Add a unique SEO title between ${SEO_TITLE_MIN_LEN}–${SEO_TITLE_MAX_LEN} characters.`
      )
    );
    score -= DEDUCTIONS.SEO_TITLE_MISSING;
  } else if (seoTitle.length < SEO_TITLE_MIN_LEN) {
    issues.push(
      mkIssue(
        "seo_title",
        `SEO title too short (${seoTitle.length} chars)`,
        "medium",
        `Expand the SEO title to at least ${SEO_TITLE_MIN_LEN} characters for better keyword coverage.`
      )
    );
    score -= DEDUCTIONS.SEO_TITLE_TOO_SHORT;
  } else if (seoTitle.length > SEO_TITLE_MAX_LEN) {
    issues.push(
      mkIssue(
        "seo_title",
        `SEO title too long (${seoTitle.length} chars)`,
        "low",
        `Shorten the SEO title to under ${SEO_TITLE_MAX_LEN} characters to prevent search-engine truncation.`
      )
    );
    score -= DEDUCTIONS.SEO_TITLE_TOO_LONG;
  }

  // ── 2. SEO Description ──────────────────────────────────────────────────────
  const seoDesc = product.seo.description?.trim() ?? "";
  if (seoDesc === "") {
    issues.push(
      mkIssue(
        "seo_description",
        "SEO meta description is missing",
        "high",
        `Add a meta description between ${SEO_DESC_MIN_LEN}–${SEO_DESC_MAX_LEN} characters to improve click-through rate.`
      )
    );
    score -= DEDUCTIONS.SEO_DESC_MISSING;
  } else if (seoDesc.length < SEO_DESC_MIN_LEN) {
    issues.push(
      mkIssue(
        "seo_description",
        `SEO description too short (${seoDesc.length} chars)`,
        "medium",
        `Write at least ${SEO_DESC_MIN_LEN} characters in the meta description for meaningful search snippets.`
      )
    );
    score -= DEDUCTIONS.SEO_DESC_TOO_SHORT;
  } else if (seoDesc.length > SEO_DESC_MAX_LEN) {
    issues.push(
      mkIssue(
        "seo_description",
        `SEO description too long (${seoDesc.length} chars)`,
        "low",
        `Trim the meta description to under ${SEO_DESC_MAX_LEN} characters to avoid search-engine truncation.`
      )
    );
    score -= DEDUCTIONS.SEO_DESC_TOO_LONG;
  }

  // ── 3. Product Description ──────────────────────────────────────────────────
  const desc = product.description?.trim() ?? "";
  if (desc === "") {
    issues.push(
      mkIssue(
        "description",
        "Product description is missing",
        "high",
        "Add a detailed product description to improve SEO signals and customer conversions."
      )
    );
    score -= DEDUCTIONS.PRODUCT_DESC_MISSING;
  } else if (desc.length < PRODUCT_DESC_MIN_LEN) {
    issues.push(
      mkIssue(
        "description",
        `Product description too short (${desc.length} chars)`,
        "medium",
        `Write at least ${PRODUCT_DESC_MIN_LEN} characters to give search engines and customers enough context.`
      )
    );
    score -= DEDUCTIONS.PRODUCT_DESC_TOO_SHORT;
  }

  // ── 4. Product Title ────────────────────────────────────────────────────────
  const titleLen = product.title?.trim().length ?? 0;
  if (titleLen < PRODUCT_TITLE_MIN_LEN) {
    issues.push(
      mkIssue(
        "title",
        `Product title too short (${titleLen} chars)`,
        "high",
        `Use a descriptive product title with at least ${PRODUCT_TITLE_MIN_LEN} characters to communicate value clearly.`
      )
    );
    score -= DEDUCTIONS.PRODUCT_TITLE_TOO_SHORT;
  }

  // ── 5. Image Alt Text ───────────────────────────────────────────────────────
  if (product.images.length === 0) {
    issues.push(
      mkIssue(
        "images",
        "Product has no images",
        "medium",
        "Add at least one product image with descriptive alt text for visual SEO and accessibility."
      )
    );
    score -= DEDUCTIONS.NO_IMAGES;
  } else {
    const missingAlt = product.images.filter(
      (img) => !img.altText || img.altText.trim() === ""
    );
    if (missingAlt.length > 0) {
      issues.push(
        mkIssue(
          "alt_text",
          `${missingAlt.length} image${missingAlt.length > 1 ? "s" : ""} missing alt text`,
          "medium",
          "Add descriptive alt text to all product images to improve accessibility and image-search ranking."
        )
      );
      score -= DEDUCTIONS.MISSING_ALT_TEXT;
    }
  }

  // ── Finalise ────────────────────────────────────────────────────────────────

  // Sort issues high → medium → low
  const sorted = [...issues].sort(
    (a, b) => severityWeight(b.severity) - severityWeight(a.severity)
  );

  const topIssue = sorted[0] ?? null;

  return {
    ...product,
    seoScore: Math.max(0, Math.min(100, score)),
    issues: sorted,
    topIssue,
  };
}

// ── Batch analyzer ────────────────────────────────────────────────────────────

/**
 * Analyzes all products and returns the enriched list plus aggregate metrics.
 */
export function analyzeProducts(products: ScannedProduct[]): {
  analyzed: AnalyzedProduct[];
  averageSeoScore: number;
  totalIssues: number;
} {
  if (products.length === 0) {
    return { analyzed: [], averageSeoScore: 0, totalIssues: 0 };
  }

  const analyzed = products.map(analyzeProduct);
  const totalScore = analyzed.reduce((sum, p) => sum + p.seoScore, 0);
  const averageSeoScore = Math.round(totalScore / analyzed.length);
  const totalIssues = analyzed.reduce((sum, p) => sum + p.issues.length, 0);

  return { analyzed, averageSeoScore, totalIssues };
}
