// ── Product SEO Auditor — Recommendation Engine ───────────────────────────────
// Server-only module. Never imported by client code.
//
// Takes AnalyzedProduct results from the SEO analyzer and enriches each
// issue with: explanation, step-by-step fix, and a deterministic suggestion.

import type {
  AnalyzedProduct,
  ScannedProduct,
  SEOIssue,
  Recommendation,
  TopProblem,
} from "../types/products";

// ── Display labels for each issue field ───────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  seo_title: "SEO Title",
  seo_description: "SEO Meta Description",
  description: "Product Description",
  title: "Product Title",
  images: "Product Images",
  alt_text: "Image Alt Text",
};

// ── Why each issue matters (shown in product detail page) ─────────────────────

const EXPLANATIONS: Record<string, string> = {
  seo_title:
    "The SEO title (meta title) is displayed in Google search results and browser tabs. " +
    "It's the single most influential on-page SEO signal for a product page. " +
    "Search engines use it to understand what the page is about and decide when to rank it. " +
    "An optimized, keyword-rich title can substantially increase organic impressions and clicks.",

  seo_description:
    "The meta description appears as the preview snippet below your page title in search results. " +
    "While it doesn't directly affect keyword rankings, a compelling description increases " +
    "click-through rate (CTR) — a quality signal that indirectly boosts SEO performance. " +
    "A well-written meta description can generate more traffic without needing higher rankings.",

  description:
    "Product descriptions give search engines rich text to index. " +
    "A detailed, keyword-relevant description helps your product appear in long-tail searches " +
    "that buyers use when they're close to a purchase decision. " +
    "Longer, informative descriptions also reduce bounce rates and improve conversions.",

  title:
    "The product title is one of the primary signals search engines use to understand relevance. " +
    "A short or generic title misses keyword opportunities and appears less trustworthy to customers. " +
    "Descriptive, specific titles also improve click-through rates from search results and social sharing.",

  images:
    "Product images are indexed by Google and can appear in Google Image Search, " +
    "providing an additional organic traffic channel. " +
    "High-quality images with alt text also improve accessibility (WCAG compliance) " +
    "and are essential for good conversion rates — products without images sell significantly less.",

  alt_text:
    "Image alt text is read by search engine crawlers and screen readers. " +
    "Google uses alt text to understand and index images for Image Search results, " +
    "which can drive additional visitors to your store. " +
    "Alt text is also required for WCAG accessibility compliance and is a ranking signal in image search.",
};

// ── Step-by-step Shopify Admin fix instructions ───────────────────────────────

const STEP_BY_STEP: Record<string, string> = {
  seo_title:
    "1. Open Shopify Admin → Products\n" +
    "2. Click on your product to open it\n" +
    "3. Scroll down to 'Search engine listing'\n" +
    "4. Click 'Edit' to expand the SEO fields\n" +
    "5. Enter your optimized SEO title (aim for 50–60 characters)\n" +
    "6. Place your primary keyword near the beginning of the title\n" +
    "7. Click 'Save' in the top-right corner",

  seo_description:
    "1. Open Shopify Admin → Products\n" +
    "2. Click on your product to open it\n" +
    "3. Scroll down to 'Search engine listing'\n" +
    "4. Click 'Edit' to expand the SEO fields\n" +
    "5. Write a compelling meta description (120–155 characters)\n" +
    "6. Include your main product benefit and a call to action\n" +
    "7. Click 'Save' in the top-right corner",

  description:
    "1. Open Shopify Admin → Products\n" +
    "2. Click on your product to open it\n" +
    "3. Click into the Description rich-text field\n" +
    "4. Write a detailed description covering:\n" +
    "   • Key features and specifications\n" +
    "   • Materials, dimensions, or technical details\n" +
    "   • Customer benefits and use cases\n" +
    "5. Aim for at least 100–200 words for best SEO impact\n" +
    "6. Click 'Save' when finished",

  title:
    "1. Open Shopify Admin → Products\n" +
    "2. Click on your product to open it\n" +
    "3. Update the Title field at the top of the page\n" +
    "4. Make it descriptive and keyword-rich (aim for 30–70 characters)\n" +
    "5. Include the main product type and a key feature or benefit\n" +
    "6. Click 'Save' in the top-right corner",

  images:
    "1. Open Shopify Admin → Products\n" +
    "2. Click on your product to open it\n" +
    "3. In the Media section, click 'Add media'\n" +
    "4. Upload high-quality product photos (800×800px minimum recommended)\n" +
    "5. After uploading, click on each image in the Media section\n" +
    "6. Add descriptive alt text in the 'Alt text' field\n" +
    "7. Click 'Save' when finished",

  alt_text:
    "1. Open Shopify Admin → Products\n" +
    "2. Click on your product to open it\n" +
    "3. In the Media section, click on each product image\n" +
    "4. Find the 'Alt text' field in the panel that appears\n" +
    "5. Enter descriptive text (e.g. 'Blue wireless headphones with noise cancellation')\n" +
    "6. Include relevant keywords naturally — do not keyword-stuff\n" +
    "7. Repeat for every image, then click 'Save'",
};

// ── Suggestion generators ─────────────────────────────────────────────────────

/** Strip basic HTML tags and collapse whitespace. */
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Generates a suggested SEO title from the product title.
 * Stays within the 30–70 character optimal range.
 */
export function suggestSeoTitle(product: ScannedProduct): string {
  const title = product.title.trim();
  const suffixes = [" | Shop Online", " - Buy Now", " | Free Shipping"];

  // Try adding a suffix while staying in range
  for (const suffix of suffixes) {
    const candidate = `${title}${suffix}`;
    if (candidate.length >= 30 && candidate.length <= 70) return candidate;
  }

  // Title alone is already in range
  if (title.length >= 30 && title.length <= 70) return title;

  // Too long — truncate
  if (title.length > 70) return `${title.substring(0, 67)}…`;

  // Too short even with suffix — use best attempt
  return `${title} | Shop Online`.substring(0, 70);
}

/**
 * Generates a suggested meta description.
 * Uses the product description if available, otherwise falls back to a template.
 */
export function suggestMetaDescription(product: ScannedProduct): string {
  const clean = stripHtml(product.description).trim();

  if (clean.length >= 70 && clean.length <= 155) return clean;
  if (clean.length > 155) return `${clean.substring(0, 152)}…`;

  // Description too short or empty — template
  const title = product.title.trim();
  const tpl =
    `Shop ${title} at our store. Premium quality with competitive prices ` +
    `and fast shipping. 100% satisfaction guaranteed. Order yours today.`;

  return tpl.length <= 155 ? tpl : `${tpl.substring(0, 152)}…`;
}

/**
 * Generates a suggested product description using a benefits-focused template.
 */
export function suggestProductDescription(product: ScannedProduct): string {
  const title = product.title.trim();
  return (
    `${title} is designed with quality and performance in mind. ` +
    `Whether you're buying for yourself or as a gift, you'll appreciate the attention ` +
    `to detail and craftsmanship that goes into every unit. ` +
    `Key features include reliable build quality, thoughtful design, and outstanding value for money. ` +
    `Order today and enjoy fast delivery, easy returns, and dedicated customer support. ` +
    `Join thousands of satisfied customers who trust us for their everyday needs.`
  );
}

// ── Core enrichment function ──────────────────────────────────────────────────

/** Converts one SEOIssue into a Recommendation with rich context. */
function enrichIssue(issue: SEOIssue, product: ScannedProduct): Recommendation {
  const explanation =
    EXPLANATIONS[issue.field] ??
    "This issue may reduce the visibility of your product in search engine results.";

  const stepByStepFix = STEP_BY_STEP[issue.field] ?? issue.recommendation;

  let suggestion: string | undefined;
  let currentValue: string | null | undefined;

  if (issue.field === "seo_title") {
    suggestion = suggestSeoTitle(product);
    currentValue = product.seo.title;
  } else if (issue.field === "seo_description") {
    suggestion = suggestMetaDescription(product);
    currentValue = product.seo.description;
  } else if (issue.field === "description") {
    suggestion = suggestProductDescription(product);
    currentValue = product.description.trim() || null;
  }

  return {
    field: issue.field,
    message: issue.message,
    severity: issue.severity,
    shortFix: issue.recommendation,
    explanation,
    stepByStepFix,
    suggestion,
    currentValue,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generates a rich Recommendation for every SEO issue found in an analyzed product.
 * Each recommendation includes explanation, step-by-step fix, and where applicable
 * a pre-generated suggested value the merchant can copy.
 */
export function generateRecommendations(
  analyzed: AnalyzedProduct
): Recommendation[] {
  return analyzed.issues.map((issue) => enrichIssue(issue, analyzed));
}

/**
 * Aggregates the most common issue fields across all analyzed products.
 * Each field is counted at most once per product (no double-counting).
 * Returns up to 6 entries sorted by frequency (most common first).
 */
export function computeTopProblems(
  products: AnalyzedProduct[]
): TopProblem[] {
  if (products.length === 0) return [];

  const fieldCounts = new Map<string, number>();

  for (const product of products) {
    const seenFields = new Set<string>();
    for (const issue of product.issues) {
      if (!seenFields.has(issue.field)) {
        seenFields.add(issue.field);
        fieldCounts.set(issue.field, (fieldCounts.get(issue.field) ?? 0) + 1);
      }
    }
  }

  return Array.from(fieldCounts.entries())
    .map(([field, count]) => ({
      field,
      label: FIELD_LABELS[field] ?? field,
      count,
      percentage: Math.round((count / products.length) * 100),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}
