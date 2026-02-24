/**
 * Data freshness utilities for dashboard tiles.
 *
 * Provides relative time formatting and freshness level classification.
 */

/** Freshness level for visual color coding. */
export type FreshnessLevel = "fresh" | "aging" | "stale";

/** Freshness thresholds in milliseconds. */
const FRESH_THRESHOLD_MS = 15 * 60 * 1000;  // 15 minutes
const STALE_THRESHOLD_MS = 60 * 60 * 1000;  // 1 hour

/**
 * Format a timestamp as relative time from now.
 * Returns "just now", "N min ago", "N hr ago", or "N days ago".
 */
export function formatRelativeTime(timestamp: number, now?: number): string {
	const current = now ?? Date.now();
	const diffMs = current - timestamp;

	if (diffMs < 60_000) return "just now";

	const minutes = Math.floor(diffMs / 60_000);
	if (minutes < 60) return `${minutes} min ago`;

	const hours = Math.floor(diffMs / 3_600_000);
	if (hours < 24) return `${hours} hr ago`;

	const days = Math.floor(diffMs / 86_400_000);
	return `${days} day${days > 1 ? "s" : ""} ago`;
}

/**
 * Classify a timestamp's freshness level.
 * - fresh: < 15 minutes old
 * - aging: 15 minutes – 1 hour
 * - stale: > 1 hour
 */
export function getFreshnessLevel(timestamp: number, now?: number): FreshnessLevel {
	const current = now ?? Date.now();
	const diffMs = current - timestamp;

	if (diffMs < FRESH_THRESHOLD_MS) return "fresh";
	if (diffMs < STALE_THRESHOLD_MS) return "aging";
	return "stale";
}

/**
 * Get a CSS color variable for a freshness level.
 */
export function getFreshnessColor(level: FreshnessLevel): string {
	switch (level) {
		case "fresh": return "var(--text-success, #4caf50)";
		case "aging": return "var(--text-warning, #ff9800)";
		case "stale": return "var(--text-error, #f44336)";
	}
}

/**
 * Compute a freshness summary for a set of timestamps.
 * Returns "All tiles fresh", "N stale tiles", or "Not yet refreshed".
 */
export function computeFreshnessSummary(
	timestamps: Array<number | undefined>,
	now?: number,
): string {
	if (timestamps.length === 0) return "";

	const current = now ?? Date.now();
	const defined = timestamps.filter((t): t is number => t !== undefined);

	if (defined.length === 0) return "Not yet refreshed";

	const staleCount = defined.filter((t) => getFreshnessLevel(t, current) === "stale").length;
	const agingCount = defined.filter((t) => getFreshnessLevel(t, current) === "aging").length;

	if (staleCount === 0 && agingCount === 0) return "All tiles fresh";
	if (staleCount > 0) return `${staleCount} stale tile${staleCount > 1 ? "s" : ""}`;
	return `${agingCount} aging tile${agingCount > 1 ? "s" : ""}`;
}
