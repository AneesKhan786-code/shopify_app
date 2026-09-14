// ── Product SEO Auditor — Product Detail Audit Page ──────────────────────────
// Route: /app/product/:id  (id = numeric Shopify product ID)
// Loader fetches product by GID, runs SEO analysis, and generates
// rich recommendations. Actions are read-only — no Shopify writes yet.

import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { fetchProductById } from "../lib/products.server";
import { analyzeProduct } from "../lib/seo-analyzer.server";
import {
  generateRecommendations,
  suggestSeoTitle,
  suggestMetaDescription,
  suggestProductDescription,
} from "../lib/recommendations.server";
import {
  ScoreRing,
  getScoreColor,
  getScoreLabel,
} from "../components/ScoreRing";
import stylesheet from "../styles/product-detail.css?url";
import type { IssueSeverity } from "../types/products";

// ── Route meta ────────────────────────────────────────────────────────────────

export const links = () => [{ rel: "stylesheet", href: stylesheet }];

// ── Server loader ─────────────────────────────────────────────────────────────

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const numericId = params.id;
  if (!numericId || !/^\d+$/.test(numericId)) {
    throw new Response("Invalid product ID", { status: 400 });
  }

  const gid = `gid://shopify/Product/${numericId}`;
  const product = await fetchProductById(admin, gid);

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  const analyzed = analyzeProduct(product);
  const recommendations = generateRecommendations(analyzed);

  return {
    product: analyzed,
    recommendations,
    // Pre-generated suggestions — deterministic, no external APIs
    suggestedSeoTitle: suggestSeoTitle(product),
    suggestedMetaDescription: suggestMetaDescription(product),
    suggestedProductDescription: suggestProductDescription(product),
  };
};

// ── Client helpers ────────────────────────────────────────────────────────────

function getSuggestionButtonLabel(field: string): string {
  if (field === "seo_title") return "✨ Generate SEO Title";
  if (field === "seo_description") return "✨ Generate Meta Description";
  if (field === "description") return "✨ Improve Description";
  return "View Suggestion";
}

function getSuggestionBoxLabel(field: string): string {
  if (field === "seo_title") return "Suggested SEO Title";
  if (field === "seo_description") return "Suggested Meta Description";
  if (field === "description") return "Suggested Product Description";
  return "Suggestion";
}

const FIELDS_WITH_SUGGESTIONS = new Set(["seo_title", "seo_description", "description"]);

// ── Sub-components ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <span className={`sev-badge sev-badge--${severity}`}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── Page component ────────────────────────────────────────────────────────────

export default function ProductDetailPage() {
  const shopify = useAppBridge();
  const {
    product,
    recommendations,
    suggestedSeoTitle,
    suggestedMetaDescription,
    suggestedProductDescription,
  } = useLoaderData<typeof loader>();

  // Track which suggestion boxes are open (keyed by recommendation index)
  const [openSuggestions, setOpenSuggestions] = useState<Record<number, boolean>>({});

  function toggleSuggestion(idx: number) {
    setOpenSuggestions((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  function getSuggestionText(field: string): string {
    if (field === "seo_title") return suggestedSeoTitle;
    if (field === "seo_description") return suggestedMetaDescription;
    if (field === "description") return suggestedProductDescription;
    return "";
  }

  function handleCopy(text: string, label: string): void {
    void navigator.clipboard
      .writeText(text)
      .then(() => {
        shopify.toast.show(`${label} copied to clipboard`, { duration: 2000 });
      })
      .catch(() => {
        shopify.toast.show("Copy failed — please select and copy manually.", {
          isError: true,
          duration: 3000,
        });
      });
  }

  const scoreColor = getScoreColor(product.seoScore);

  return (
    <s-page heading="SEO Audit Report">

      {/* ── Product overview card ── */}
      <s-section>
        <div className="detail-page">

          <div className="back-nav">
            <s-link href="/app">← Back to Dashboard</s-link>
          </div>

          <div className="overview-card">
            <div className="overview-main">
              <h1 className="overview-product-title">{product.title}</h1>

              <div className="overview-meta">
                <span className="handle-chip">/{product.handle}</span>
                <span
                  className={`status-chip status-chip--${product.status.toLowerCase()}`}
                >
                  {product.status}
                </span>
              </div>

              <div className="overview-stats">
                <span>
                  {product.images.length} image
                  {product.images.length !== 1 ? "s" : ""}
                </span>
                <span className="dot-sep">·</span>
                <span>
                  {product.issues.length} issue
                  {product.issues.length !== 1 ? "s" : ""} detected
                </span>
                <span className="dot-sep">·</span>
                <span>
                  Score:{" "}
                  <strong style={{ color: scoreColor }}>
                    {product.seoScore}/100
                  </strong>
                </span>
              </div>
            </div>

            <div className="overview-score-block">
              <ScoreRing score={product.seoScore} size={80} />
              <div className="score-grade" style={{ color: scoreColor }}>
                {getScoreLabel(product.seoScore)}
              </div>
            </div>
          </div>

        </div>
      </s-section>

      {/* ── SEO Issues + Recommendations ── */}
      <s-section
        heading={
          recommendations.length === 0
            ? "SEO Status"
            : `SEO Issues (${recommendations.length} found)`
        }
      >
        <div className="issues-wrapper">

          {recommendations.length === 0 ? (
            /* ── No issues — success state ── */
            <div className="success-banner">
              <div className="success-icon">✅</div>
              <div>
                <strong className="success-title">All SEO checks passed!</strong>
                <p className="success-body">
                  This product has excellent SEO metadata. Keep it up!
                </p>
              </div>
            </div>
          ) : (
            recommendations.map((rec, idx) => {
              const isOpen = openSuggestions[idx] === true;
              const hasSuggestion = FIELDS_WITH_SUGGESTIONS.has(rec.field);
              const suggestionText = hasSuggestion
                ? getSuggestionText(rec.field)
                : "";

              return (
                <div
                  key={`${rec.field}-${idx}`}
                  className={`issue-card issue-card--${rec.severity}`}
                >
                  {/* Card header */}
                  <div className="issue-card-head">
                    <SeverityBadge severity={rec.severity} />
                    <span className="issue-card-title">{rec.message}</span>
                  </div>

                  {/* Card body */}
                  <div className="issue-card-body">

                    <div className="issue-field-group">
                      <div className="field-label">Why this matters</div>
                      <p className="field-text">{rec.explanation}</p>
                    </div>

                    <div className="issue-field-group">
                      <div className="field-label">Quick fix</div>
                      <p className="field-text">{rec.shortFix}</p>
                    </div>

                    {hasSuggestion && suggestionText && (
                      <div className="issue-action">
                        <s-button
                          variant="secondary"
                          onClick={() => toggleSuggestion(idx)}
                        >
                          {isOpen
                            ? "Hide Suggestion"
                            : getSuggestionButtonLabel(rec.field)}
                        </s-button>

                        {isOpen && (
                          <div className="suggestion-box">
                            <div className="suggestion-head">
                              <span className="suggestion-title">
                                {getSuggestionBoxLabel(rec.field)}:
                              </span>
                              <span className="suggestion-chars">
                                {suggestionText.length} characters
                              </span>
                            </div>

                            <div className="suggestion-text">
                              {suggestionText}
                            </div>

                            <div className="suggestion-foot">
                              <s-button
                                variant="tertiary"
                                onClick={() =>
                                  handleCopy(
                                    suggestionText,
                                    getSuggestionBoxLabel(rec.field)
                                  )
                                }
                              >
                                📋 Copy to Clipboard
                              </s-button>
                              <span className="suggestion-note">
                                Review and personalize before applying to your store
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              );
            })
          )}

        </div>
      </s-section>

      {/* ── Optimization Opportunities ── */}
      <s-section heading="Optimization Opportunities">
        <div className="opportunities">
          <p className="opps-intro">
            Beyond fixing detected issues, these best practices maximize your product's
            organic search performance:
          </p>
          <ul className="opps-list">
            <li>Use specific, search-intent language that matches how customers actually search</li>
            <li>Include your primary keyword in both the product title and the SEO title</li>
            <li>Add multiple high-quality images (minimum 800×800 px) from different angles</li>
            <li>Write benefits-focused descriptions, not just a list of features</li>
            <li>Keep the meta description under 155 characters to prevent search-result truncation</li>
            <li>Ensure the product URL handle is clean and contains your primary keyword</li>
          </ul>
        </div>
      </s-section>

    </s-page>
  );
}

// ── Shopify error boundary (required — do not remove) ─────────────────────────

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

// ── Shopify response headers (required — do not remove) ───────────────────────

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
