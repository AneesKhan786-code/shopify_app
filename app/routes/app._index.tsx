import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { fetchAllProducts } from "../lib/products.server";
import { analyzeProducts } from "../lib/seo-analyzer.server";
import stylesheet from "../styles/dashboard.css?url";
import type { AnalyzedProduct, IssueSeverity } from "../types/products";

// ── Route meta ────────────────────────────────────────────────────────────────

export const links = () => [{ rel: "stylesheet", href: stylesheet }];

// ── Server loader (authentication guard — do not remove) ──────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

// ── Server action — triggered by Scan Products button ────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  try {
    const rawProducts = await fetchAllProducts(admin);
    const { analyzed, averageSeoScore, totalIssues } =
      analyzeProducts(rawProducts);
    return {
      ok: true as const,
      products: analyzed,
      totalCount: analyzed.length,
      averageSeoScore,
      totalIssues,
      scannedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during the scan.",
    };
  }
};

// ── Score helpers ─────────────────────────────────────────────────────────────

const RING_RADIUS = 27;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function getScoreColor(score: number): string {
  if (score >= 90) return "#1a7f5a"; // Excellent — green
  if (score >= 75) return "#2563eb"; // Good — blue
  if (score >= 50) return "#d97706"; // Fair — amber
  return "#b91c1c";                  // Poor — red
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

function getScoreChipClass(score: number): string {
  if (score >= 90) return "score-chip score-chip--excellent";
  if (score >= 75) return "score-chip score-chip--good";
  if (score >= 50) return "score-chip score-chip--fair";
  return "score-chip score-chip--poor";
}

// ── Utility ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreChip({ score }: { score: number }) {
  return <span className={getScoreChipClass(score)}>{score}</span>;
}

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <span className={`badge badge--sev-${severity}`}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── Dashboard page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();

  const isScanning = fetcher.state !== "idle";
  const scanData = fetcher.data;

  // Type-narrowed derived state
  const hasResults = scanData?.ok === true;
  const products: AnalyzedProduct[] = hasResults ? scanData.products : [];
  const totalCount: number = hasResults ? scanData.totalCount : 0;
  const averageSeoScore: number = hasResults ? scanData.averageSeoScore : 0;
  const totalIssues: number = hasResults ? scanData.totalIssues : 0;
  const scannedAt: string | null = hasResults ? scanData.scannedAt : null;

  // Dynamic ring values
  const ringColor = hasResults ? getScoreColor(averageSeoScore) : "#d1d5db";
  const ringFilled = hasResults
    ? RING_CIRCUMFERENCE * (averageSeoScore / 100)
    : 0;

  // Surface scan errors via toast
  const errorMessage = scanData?.ok === false ? scanData.error : null;
  useEffect(() => {
    if (errorMessage) {
      shopify.toast.show(`Scan failed: ${errorMessage}`, {
        isError: true,
        duration: 6000,
      });
    }
  }, [errorMessage, shopify]);

  function handleScan() {
    fetcher.submit({}, { method: "POST" });
  }

  return (
    <s-page heading="Product SEO Auditor">

      {/* ── Stat cards + CTA ── */}
      <s-section>
        <div className="dashboard">

          <div className="header">
            <p className="subtitle">
              Analyze and improve your Shopify product SEO performance
            </p>
          </div>

          {/* ── Three stat cards ── */}
          <div className="cards">

            {/* Card 1 — SEO Health Score */}
            <div
              className="card card--score"
              style={hasResults
                ? { borderTopColor: getScoreColor(averageSeoScore) }
                : undefined}
            >
              <span className="card-label">📊 SEO Health Score</span>
              <div className="score-row">
                <div className="score-ring">
                  <svg
                    viewBox="0 0 68 68"
                    width="68"
                    height="68"
                    aria-hidden="true"
                  >
                    {/* Background track */}
                    <circle
                      cx="34" cy="34" r={RING_RADIUS}
                      fill="none" stroke="#e1e3e5" strokeWidth="7"
                    />
                    {/* Filled arc */}
                    <circle
                      cx="34" cy="34" r={RING_RADIUS}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${ringFilled} ${RING_CIRCUMFERENCE}`}
                    />
                  </svg>
                  <span
                    className="score-ring-label"
                    style={{ color: ringColor }}
                    aria-label={
                      hasResults
                        ? `${averageSeoScore} percent`
                        : "No data yet"
                    }
                  >
                    {hasResults ? `${averageSeoScore}%` : "—"}
                  </span>
                </div>

                <div className="score-detail">
                  <span
                    className="score-value"
                    style={{ color: hasResults ? getScoreColor(averageSeoScore) : "#c9cccf" }}
                  >
                    {hasResults ? `${averageSeoScore}%` : "—"}
                  </span>
                  <span
                    className="score-badge"
                    style={
                      hasResults
                        ? {
                            color: getScoreColor(averageSeoScore),
                            background: hasResults && averageSeoScore >= 90
                              ? "#e3f5ed"
                              : hasResults && averageSeoScore >= 75
                                ? "#eff6ff"
                                : hasResults && averageSeoScore >= 50
                                  ? "#fffbeb"
                                  : "#fef2f2",
                          }
                        : undefined
                    }
                  >
                    {hasResults
                      ? `${getScoreLabel(averageSeoScore)} ✓`
                      : "Run a scan"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2 — Products Scanned */}
            <div className={`card${hasResults ? " card--active" : ""}`}>
              <span className="card-label">📦 Products Scanned</span>
              <span
                className={`stat-value${hasResults ? " stat-value--active" : ""}`}
              >
                {isScanning ? "…" : totalCount}
              </span>
              <span className="stat-sub">
                {isScanning
                  ? "Fetching all products…"
                  : hasResults
                    ? `Last scanned ${formatDateTime(scannedAt!)}`
                    : "No scans completed yet"}
              </span>
            </div>

            {/* Card 3 — Issues Found */}
            <div
              className={`card${hasResults && totalIssues > 0 ? " card--issues" : ""}`}
            >
              <span className="card-label">⚠️ Issues Found</span>
              <span
                className={`stat-value${hasResults && totalIssues > 0 ? " stat-value--issues" : ""}`}
              >
                {isScanning ? "…" : totalIssues}
              </span>
              <span className="stat-sub">
                {isScanning
                  ? "Analyzing SEO data…"
                  : hasResults && totalIssues > 0
                    ? `Across ${totalCount} product${totalCount !== 1 ? "s" : ""}`
                    : hasResults
                      ? "All products look great!"
                      : "Start your first SEO audit"}
              </span>
            </div>

          </div>

          {/* ── Primary CTA ── */}
          <div className="actions">
            <s-button
              variant="primary"
              onClick={handleScan}
              {...(isScanning ? { loading: true } : {})}
            >
              {isScanning ? "Analyzing…" : "🔍 Scan Products"}
            </s-button>
            <span className="action-hint">
              {isScanning
                ? "Fetching and analyzing all products…"
                : hasResults
                  ? `${totalCount} product${totalCount !== 1 ? "s" : ""} analyzed — click to re-scan`
                  : "Fetches and scores all products in your store"}
            </span>
          </div>

        </div>
      </s-section>

      {/* ── SEO Audit Results table ── */}
      {hasResults && products.length > 0 && (
        <s-section heading="SEO Audit Results">
          <div className="scan-results">

            <div className="scan-summary">
              <span>
                <strong>{products.length}</strong>{" "}
                product{products.length !== 1 ? "s" : ""} analyzed on{" "}
                <strong>{formatDateTime(scannedAt!)}</strong>
                {" · "}
                Average score:{" "}
                <strong style={{ color: getScoreColor(averageSeoScore) }}>
                  {averageSeoScore}%
                </strong>
                {" · "}
                Total issues: <strong>{totalIssues}</strong>
              </span>
              <span className="scan-summary-hint">
                Bulk fixes and recommendations coming in the next phase
              </span>
            </div>

            <div className="table-wrapper">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SEO Score</th>
                    <th>Issues</th>
                    <th>Severity</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>

                      {/* Product title + handle */}
                      <td>
                        <div className="product-cell">
                          <span
                            className="product-title"
                            title={product.title}
                          >
                            {product.title}
                          </span>
                          <span className="product-handle">
                            /{product.handle}
                          </span>
                        </div>
                      </td>

                      {/* SEO score chip */}
                      <td>
                        <ScoreChip score={product.seoScore} />
                      </td>

                      {/* Issue count */}
                      <td>
                        <span
                          className={
                            product.issues.length === 0
                              ? "issue-count issue-count--none"
                              : "issue-count"
                          }
                        >
                          {product.issues.length === 0
                            ? "✓ None"
                            : product.issues.length}
                        </span>
                      </td>

                      {/* Worst severity */}
                      <td>
                        {product.topIssue ? (
                          <SeverityBadge
                            severity={product.topIssue.severity}
                          />
                        ) : (
                          <span className="badge badge--ok">✓ None</span>
                        )}
                      </td>

                      {/* Top recommendation */}
                      <td>
                        <span
                          className="recommendation-text"
                          title={product.topIssue?.recommendation}
                        >
                          {product.topIssue?.recommendation ??
                            "All SEO checks passed"}
                        </span>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </s-section>
      )}

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
