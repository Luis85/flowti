/**
 * summary-formatters.ts — Formatting helpers for the summary report.
 */

/** Format a number with locale grouping, using the OS/runtime default locale. */
export function n(value: number): string {
	return value.toLocaleString();
}

/** Format a date using the OS/runtime default locale. */
export function d(date: Date): string {
	return date.toLocaleString(undefined, {
		year: "numeric", month: "short", day: "numeric",
		hour: "2-digit", minute: "2-digit", second: "2-digit",
	});
}
