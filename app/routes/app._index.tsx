// ── Product SEO Auditor — Main Dashboard ─────────────────────────────────────

import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useRouteError } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { fetchAllProducts } from "../lib/products.server";
import { analyzeProducts } from "../lib/seo-analyzer.server";
import { computeTopProblems } from "../lib/recommendations.server";
import {
  ScoreRing,
  getScoreColor,
  getScoreLabel,
  getScoreChipClass,
} from "../components/ScoreRing";
import stylesheet from "../styles/dashboard.css?url";
import type { AnalyzedProduct, DbScanRecord } from "../types/products";
import { saveScanHistory, getRecentScans } from "../lib/scan-history.server";

// ── Route meta ────────────────────────────────────────────────────────────────

export const links = () => [{ rel: "stylesheet", href: stylesheet }];

// ── Server loader ─────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  let activePlan = "free";

  try {
    const { hasActivePayment, appSubscriptions } = await billing.check({
      plans: ["basic", "pro", "enterprise"],
      isTest: true,
    });
    if (hasActivePayment && appSubscriptions.length > 0) {
      activePlan = appSubscriptions[0].name;
    }
  } catch (err) {
    console.error("[Dashboard Loader] Failed to check billing status:", err);
  }

  try {
    const rows = await getRecentScans(session.shop);
    const scanHistory: DbScanRecord[] = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
    return { scanHistory, activePlan };
  } catch (err) {
    console.error("[Dashboard Loader] Failed to load scan history:", err);
    return { scanHistory: [] as DbScanRecord[], activePlan: "free" };
  }
};

// ── Server action ─────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session, billing } = await authenticate.admin(request);
  try {
    // Determine active subscription limits
    let activePlan = "free";
    try {
      const { hasActivePayment, appSubscriptions } = await billing.check({
        plans: ["basic", "pro", "enterprise"],
        isTest: true,
      });
      if (hasActivePayment && appSubscriptions.length > 0) {
        activePlan = appSubscriptions[0].name;
      }
    } catch (err) {
      console.error("[Dashboard Action] Failed to check billing status:", err);
    }

    let limit: number | undefined;
    if (activePlan === "free") {
      limit = 10;
    } else if (activePlan === "basic") {
      limit = 100;
    }

    const rawProducts = await fetchAllProducts(admin, limit);
    const { analyzed, averageSeoScore, totalIssues } =
      analyzeProducts(rawProducts);

    const highSeverityIssues = analyzed.reduce(
      (sum, p) => sum + p.issues.filter((i) => i.severity === "high").length,
      0
    );
    const topProblems = computeTopProblems(analyzed);

    try {
      await saveScanHistory({
        shop: session.shop,
        averageSeoScore,
        productsScanned: analyzed.length,
        totalIssues,
        highSeverityIssues,
        topProblems,
      });
    } catch (dbErr) {
      console.error("[Dashboard Action] Failed to persist scan history:", dbErr);
    }

    return {
      ok: true as const,
      products: analyzed,
      totalCount: analyzed.length,
      averageSeoScore,
      totalIssues,
      highSeverityIssues,
      topProblems,
      scannedAt: new Date().toISOString(),
      activePlan,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr} hr ago`;
}

function extractProductId(gid: string): string {
  return gid.split("/").at(-1) ?? "";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreChip({ score }: { score: number }) {
  return <span className={getScoreChipClass(score)}>{score}</span>;
}

function SeverityBadge({ severity }: { severity: "high" | "medium" | "low" }) {
  return (
    <span className={`badge badge--sev-${severity}`}>
      {severity.toUpperCase()}
    </span>
  );
}

// ── Dashboard component ───────────────────────────────────────────────────────

export default function DashboardPage() {
  const shopify = useAppBridge();
  const fetcher = useFetcher<typeof action>();
  const { scanHistory, activePlan } = useLoaderData<typeof loader>();

  const isScanning = fetcher.state !== "idle";
  const scanData = fetcher.data;

  const hasResults = scanData?.ok === true;
  const products: AnalyzedProduct[] = hasResults ? scanData.products : [];
  const totalCount: number = hasResults ? scanData.totalCount : 0;
  const averageSeoScore: number = hasResults ? scanData.averageSeoScore : 0;
  const totalIssues: number = hasResults ? scanData.totalIssues : 0;
  const highSeverityIssues: number = hasResults ? scanData.highSeverityIssues : 0;
  const topProblems = hasResults ? scanData.topProblems : [];
  const scannedAt: string | null = hasResults ? scanData.scannedAt : null;

  const errorMessage = scanData?.ok === false ? scanData.error : null;
  useEffect(() => {
    if (errorMessage && shopify?.toast) {
      shopify.toast.show(`Scan failed: ${errorMessage}`, {
        isError: true,
        duration: 6000,
      });
    }
  }, [errorMessage, shopify]);

  function handleScan() {
    fetcher.submit({}, { method: "POST" });
  }

  const scoreColor = hasResults ? getScoreColor(averageSeoScore) : "#d1d5db";

  return (
    <div className="app-page">

      {/* Plan Banner */}
      {activePlan === "free" && (
        <div className="plan-banner plan-banner--free">
          <span>💡 You are on the <strong>Free Plan</strong> (10 products scan limit).</span>
          <a href="/app/pricing" className="plan-banner-link">Upgrade to scan more products &rarr;</a>
        </div>
      )}
      {activePlan === "basic" && (
        <div className="plan-banner plan-banner--basic">
          <span>💡 You are on the <strong>Basic Plan</strong> (100 products scan limit).</span>
          <a href="/app/pricing" className="plan-banner-link">Upgrade to Pro for unlimited scans &rarr;</a>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">🔍 Product SEO Auditor</h1>
        <p className="page-subtitle">Analyze and improve your Shopify product SEO performance</p>
      </div>

      {/* Section 1: Store SEO Overview */}
      <div className="app-section">
        <h2 className="section-heading">Store SEO Overview</h2>
        <div className="dashboard">

          {/* Four stat cards */}
          <div className="cards">

            {/* Card 1 — Overall SEO Health Score */}
            <div className="card card--score" style={{ borderTopColor: scoreColor }}>
              <span className="card-label">📊 SEO Health Score</span>
              <div className="score-row">
                <ScoreRing score={averageSeoScore} size={64} empty={!hasResults} />
                <div className="score-detail">
                  <span className="score-value" style={{ color: hasResults ? scoreColor : "#c9cccf" }}>
                    {hasResults ? `${averageSeoScore}%` : "—"}
                  </span>
                  <span className="score-badge" style={hasResults ? { color: scoreColor } : undefined}>
                    {hasResults ? getScoreLabel(averageSeoScore) : "Run a scan"}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2 — Products Scanned */}
            <div className={`card${hasResults ? " card--active" : ""}`}>
              <span className="card-label">📦 Products Scanned</span>
              <span className={`stat-value${hasResults ? " stat-value--active" : ""}`}>
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

            {/* Card 3 — Total Issues */}
            <div className={`card${hasResults && totalIssues > 0 ? " card--warn" : ""}`}>
              <span className="card-label">⚠️ Total Issues</span>
              <span className={`stat-value${hasResults && totalIssues > 0 ? " stat-value--warn" : hasResults ? " stat-value--ok" : ""}`}>
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

            {/* Card 4 — High Severity Issues */}
            <div className={`card${hasResults && highSeverityIssues > 0 ? " card--danger" : ""}`}>
              <span className="card-label">🚨 High Severity</span>
              <span className={`stat-value${hasResults && highSeverityIssues > 0 ? " stat-value--danger" : hasResults ? " stat-value--ok" : ""}`}>
                {isScanning ? "…" : highSeverityIssues}
              </span>
              <span className="stat-sub">
                {isScanning
                  ? "Checking severity levels…"
                  : hasResults && highSeverityIssues > 0
                    ? "Require immediate attention"
                    : hasResults
                      ? "No critical issues ✓"
                      : "Start a scan to check"}
              </span>
            </div>

          </div>

          {/* CTA */}
          <div className="actions">
            <button
              className={`scan-btn${isScanning ? " scan-btn--loading" : ""}`}
              onClick={handleScan}
              disabled={isScanning}
            >
              {isScanning ? "⏳ Analyzing…" : "🔍 Scan Products"}
            </button>
            <span className="action-hint">
              {isScanning
                ? "Fetching and analyzing all products — this may take a moment"
                : hasResults
                  ? `${totalCount} product${totalCount !== 1 ? "s" : ""} analyzed · click to re-scan`
                  : "Fetches and scores all products in your store"}
            </span>
          </div>

        </div>
      </div>

      {/* Section 2: Top SEO Problems (after scan) */}
      {hasResults && topProblems.length > 0 && (
        <div className="app-section">
          <h2 className="section-heading">Top SEO Problems</h2>
          <div className="top-problems">
            <p className="top-problems-intro">
              Issues ranked by the number of products affected — fix the top ones first.
            </p>
            <div className="problems-list">
              {topProblems.map((problem) => (
                <div key={problem.field} className="problem-row">
                  <span className="problem-label">{problem.label}</span>
                  <div className="problem-bar-track" title={`${problem.percentage}%`}>
                    <div className="problem-bar-fill" style={{ width: `${problem.percentage}%` }} />
                  </div>
                  <span className="problem-count">
                    {problem.count} product{problem.count !== 1 ? "s" : ""}
                    <span className="problem-pct"> ({problem.percentage}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Section 3: SEO Audit Results Table */}
      {hasResults && products.length > 0 && (
        <div className="app-section">
          <h2 className="section-heading">SEO Audit Results</h2>
          <div className="scan-results">

            <div className="scan-summary">
              <span>
                <strong>{products.length}</strong>{" "}
                product{products.length !== 1 ? "s" : ""} analyzed ·{" "}
                Average score:{" "}
                <strong style={{ color: getScoreColor(averageSeoScore) }}>{averageSeoScore}%</strong>{" "}
                · Total issues: <strong>{totalIssues}</strong>
                {" · "}High severity: <strong style={{ color: "#b91c1c" }}>{highSeverityIssues}</strong>
              </span>
              <span className="scan-summary-hint">Click a product to view the full SEO report</span>
            </div>

            <div className="table-wrapper">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>SEO Score</th>
                    <th>Issues</th>
                    <th>Severity</th>
                    <th>Top Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="product-cell">
                          <a
                            href={`/app/product/${extractProductId(product.id)}`}
                            className="product-link"
                            title={product.title}
                          >
                            {product.title}
                          </a>
                          <span className="product-handle">/{product.handle}</span>
                        </div>
                      </td>
                      <td><ScoreChip score={product.seoScore} /></td>
                      <td>
                        {product.issues.length === 0 ? (
                          <span className="issue-count issue-count--none">✓ None</span>
                        ) : (
                          <span className="issue-count">{product.issues.length}</span>
                        )}
                      </td>
                      <td>
                        {product.topIssue ? (
                          <SeverityBadge severity={product.topIssue.severity} />
                        ) : (
                          <span className="badge badge--ok">✓ None</span>
                        )}
                      </td>
                      <td>
                        <span className="recommendation-text" title={product.topIssue?.recommendation}>
                          {product.topIssue?.recommendation ?? "All SEO checks passed"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* Section 4: Recent Scans */}
      {scanHistory.length > 0 && (
        <div className="app-section">
          <h2 className="section-heading">Recent Scans</h2>
          <div className="scan-history">
            {scanHistory.map((entry, idx) => (
              <div key={entry.id} className="history-entry">
                <div className="history-left">
                  <span className="history-relative">{formatRelativeTime(entry.createdAt)}</span>
                  <span className="history-absolute">{formatDateTime(entry.createdAt)}</span>
                </div>
                <div className="history-right">
                  <span className="history-stat">{entry.productsScanned} products</span>
                  <span className="history-sep">·</span>
                  <span className="history-stat" style={{ color: getScoreColor(entry.averageSeoScore) }}>
                    {entry.averageSeoScore}% avg
                  </span>
                  <span className="history-sep">·</span>
                  <span className="history-stat">{entry.totalIssues} issues</span>
                  {entry.highSeverityIssues > 0 && (
                    <>
                      <span className="history-sep">·</span>
                      <span className="history-stat" style={{ color: "#b91c1c" }}>
                        {entry.highSeverityIssues} critical
                      </span>
                    </>
                  )}
                  {idx === 0 && <span className="history-current-badge">Latest</span>}
                </div>
              </div>
            ))}
            <p className="history-note">
              Showing the 5 most recent scans. History is stored securely per store.
            </p>
          </div>
        </div>
      )}

    </div>
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
