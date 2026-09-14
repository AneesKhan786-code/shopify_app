// ── Product SEO Auditor — Reusable Score Ring Component ──────────────────────
// Pure client component. Safe to import from any route file.

interface ScoreRingProps {
  score: number;
  /** Outer diameter in px. Default: 68 */
  size?: number;
  /** SVG stroke width. Default: 7 */
  strokeWidth?: number;
  /**
   * When true, renders a neutral gray ring with "—" label.
   * Use this for the pre-scan state.
   */
  empty?: boolean;
}

export function ScoreRing({
  score,
  size = 68,
  strokeWidth = 7,
  empty = false,
}: ScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = empty ? 0 : circumference * Math.min(100, Math.max(0, score)) / 100;
  const color = empty ? "#d1d5db" : getScoreColor(score);
  const fontSize = size > 64 ? 13 : size > 48 ? 11 : 10;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
      }}
    >
      {/* SVG ring */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ display: "block", transform: "rotate(-90deg)" }}
        aria-hidden="true"
      >
        {/* Background track */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#e1e3e5"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>

      {/* Center label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize,
          fontWeight: 700,
          color,
          pointerEvents: "none",
          lineHeight: 1,
        }}
        aria-label={empty ? "No data" : `${score} percent`}
      >
        {empty ? "—" : `${score}%`}
      </div>
    </div>
  );
}

/** Returns the hex color for a given score (exported for reuse). */
export function getScoreColor(score: number): string {
  if (score >= 90) return "#1a7f5a";
  if (score >= 75) return "#2563eb";
  if (score >= 50) return "#d97706";
  return "#b91c1c";
}

/** Returns the grade label for a given score (exported for reuse). */
export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Fair";
  return "Poor";
}

/** Returns the CSS class name suffix for a score chip (exported for reuse). */
export function getScoreChipClass(score: number): string {
  if (score >= 90) return "score-chip score-chip--excellent";
  if (score >= 75) return "score-chip score-chip--good";
  if (score >= 50) return "score-chip score-chip--fair";
  return "score-chip score-chip--poor";
}
