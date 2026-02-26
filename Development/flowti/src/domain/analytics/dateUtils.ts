/**
 * Locale-aware date parsing and time bucketing utilities.
 */

import type { ColumnTypeHint, DateFormatPattern, DateRangeFilter, DateRangePreset, LocaleId, ParsedDate, QueryDateRangeFilter, TimeBucketPeriod } from "./types";
import { LOCALE_PRESETS } from "./localeUtils";

// ── Date format resolution ──────────────────────────────

/** Resolve a locale ID to its date format pattern. */
export function resolveDateFormat(localeId: LocaleId | undefined): DateFormatPattern {
	if (!localeId || localeId === "auto") return "auto";
	return LOCALE_PRESETS[localeId].dateFormat;
}

// ── Date parsing ────────────────────────────────────────

/**
 * Parse a raw date string using the given locale's date format.
 * Returns null for empty or unparseable values.
 *
 * Supported formats:
 * - MM/DD/YYYY or MM/DD/YY (en-US)
 * - DD/MM/YYYY or DD/MM/YY (en-GB, nl-NL, fr-FR)
 * - DD.MM.YYYY or DD.MM.YY (de-DE)
 * - YYYY-MM-DD (ISO — detected automatically)
 *
 * Two-digit years are expanded: 00–99 → 2000–2099.
 */
export function parseDate(raw: string, localeId: LocaleId | undefined): ParsedDate | null {
	if (!raw || raw.trim() === "") return null;
	let s = raw.trim();

	// Strip trailing time portion (e.g., "2026-01-15T10:30:00" or "01/15/2026 12:00")
	const timeMatch = s.match(/^(.+?)[T ]\d{1,2}:\d{2}/);
	if (timeMatch) s = timeMatch[1].trim();

	// Always try ISO first (unambiguous)
	const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (isoMatch) {
		return makeDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
	}

	const format = resolveDateFormat(localeId);

	// DD.MM.YYYY or DD.MM.YY (German style)
	const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
	if (dotMatch) {
		return makeDate(expandYear(Number(dotMatch[3])), Number(dotMatch[2]), Number(dotMatch[1]));
	}

	// Slash-based formats: MM/DD/YYYY or DD/MM/YYYY (also 2-digit year)
	const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
	if (slashMatch) {
		const a = Number(slashMatch[1]);
		const b = Number(slashMatch[2]);
		const year = expandYear(Number(slashMatch[3]));

		if (format === "MM/DD/YYYY") {
			return makeDate(year, a, b);
		}
		// DD/MM/YYYY (GB, NL, FR) or auto
		if (format === "DD/MM/YYYY" || format === "DD.MM.YYYY") {
			return makeDate(year, b, a);
		}
		// Auto: if first number > 12, it must be a day → DD/MM
		if (format === "auto") {
			if (a > 12) return makeDate(year, b, a);
			if (b > 12) return makeDate(year, a, b);
			// Ambiguous — default to MM/DD (US-biased for auto)
			return makeDate(year, a, b);
		}
	}

	// Dash-separated non-ISO: DD-MM-YYYY or DD-MM-YY
	const dashMatch = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
	if (dashMatch) {
		const a = Number(dashMatch[1]);
		const b = Number(dashMatch[2]);
		const year = expandYear(Number(dashMatch[3]));

		if (format === "MM/DD/YYYY") {
			return makeDate(year, a, b);
		}
		if (format === "DD/MM/YYYY" || format === "DD.MM.YYYY") {
			return makeDate(year, b, a);
		}
		if (format === "auto") {
			if (a > 12) return makeDate(year, b, a);
			if (b > 12) return makeDate(year, a, b);
			return makeDate(year, a, b);
		}
	}

	return null;
}

/** Expand a 2-digit year to 4-digit (00–99 → 2000–2099). */
function expandYear(year: number): number {
	return year < 100 ? 2000 + year : year;
}

/** Validate and construct a ParsedDate. */
function makeDate(year: number, month: number, day: number): ParsedDate | null {
	if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1) return null;
	return { year, month, day };
}

// ── Time bucketing ──────────────────────────────────────

/**
 * Bucket a parsed date into a string label by the given period.
 *
 * - month: "2026-02"
 * - quarter: "2026-Q1"
 * - year: "2026"
 */
export function bucketDate(date: ParsedDate, period: TimeBucketPeriod): string {
	switch (period) {
		case "day":
			return `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
		case "week": {
			const weekNum = getISOWeekNumber(date);
			return `${date.year}-W${String(weekNum).padStart(2, "0")}`;
		}
		case "month":
			return `${date.year}-${String(date.month).padStart(2, "0")}`;
		case "quarter": {
			const q = Math.ceil(date.month / 3);
			return `${date.year}-Q${q}`;
		}
		case "year":
			return String(date.year);
	}
}

/** Get ISO week number (1–53) for a parsed date. */
export function getISOWeekNumber(date: ParsedDate): number {
	const d = new Date(date.year, date.month - 1, date.day);
	d.setHours(0, 0, 0, 0);
	// Thursday in current week decides the year
	d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
	const jan4 = new Date(d.getFullYear(), 0, 4);
	return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
}

// ── Date range presets ──────────────────────────────────

/** Human-readable labels for date range presets. */
export const DATE_RANGE_PRESET_LABELS: Record<DateRangePreset, string> = {
	"last-7-days": "Last 7 days",
	"last-30-days": "Last 30 days",
	"last-90-days": "Last 90 days",
	"this-week": "This week",
	"last-week": "Last week",
	"this-month": "This month",
	"last-month": "Last month",
	"this-quarter": "This quarter",
	"last-quarter": "Last quarter",
	"this-year": "This year",
	"last-year": "Last year",
	"custom": "Custom range",
};

/**
 * Compute an inclusive { start, end } date range for a preset.
 * Accepts an optional `now` parameter for testability.
 */
export function computeDateRange(
	preset: DateRangePreset,
	now: Date = new Date(),
): { start: ParsedDate; end: ParsedDate } {
	const today: ParsedDate = {
		year: now.getFullYear(),
		month: now.getMonth() + 1,
		day: now.getDate(),
	};

	switch (preset) {
		case "last-7-days":
			return { start: addDays(today, -6), end: today };
		case "last-30-days":
			return { start: addDays(today, -29), end: today };
		case "last-90-days":
			return { start: addDays(today, -89), end: today };
		case "this-week": {
			const dow = now.getDay(); // 0=Sun
			const mondayOffset = dow === 0 ? -6 : 1 - dow;
			return { start: addDays(today, mondayOffset), end: addDays(today, mondayOffset + 6) };
		}
		case "last-week": {
			const dow = now.getDay();
			const mondayOffset = dow === 0 ? -6 : 1 - dow;
			return { start: addDays(today, mondayOffset - 7), end: addDays(today, mondayOffset - 1) };
		}
		case "this-month":
			return {
				start: { year: today.year, month: today.month, day: 1 },
				end: { year: today.year, month: today.month, day: daysInMonth(today.year, today.month) },
			};
		case "last-month": {
			const prev = today.month === 1
				? { year: today.year - 1, month: 12 }
				: { year: today.year, month: today.month - 1 };
			return {
				start: { ...prev, day: 1 },
				end: { ...prev, day: daysInMonth(prev.year, prev.month) },
			};
		}
		case "this-quarter": {
			const q = Math.ceil(today.month / 3);
			const startMonth = (q - 1) * 3 + 1;
			const endMonth = startMonth + 2;
			return {
				start: { year: today.year, month: startMonth, day: 1 },
				end: { year: today.year, month: endMonth, day: daysInMonth(today.year, endMonth) },
			};
		}
		case "last-quarter": {
			let q = Math.ceil(today.month / 3) - 1;
			let yr = today.year;
			if (q === 0) { q = 4; yr--; }
			const startMonth = (q - 1) * 3 + 1;
			const endMonth = startMonth + 2;
			return {
				start: { year: yr, month: startMonth, day: 1 },
				end: { year: yr, month: endMonth, day: daysInMonth(yr, endMonth) },
			};
		}
		case "this-year":
			return {
				start: { year: today.year, month: 1, day: 1 },
				end: { year: today.year, month: 12, day: 31 },
			};
		case "last-year":
			return {
				start: { year: today.year - 1, month: 1, day: 1 },
				end: { year: today.year - 1, month: 12, day: 31 },
			};
		case "custom":
			// Custom uses explicit startDate/endDate, return today as fallback
			return { start: today, end: today };
	}
}

/** Check whether a parsed date falls within an inclusive [start, end] range. */
export function isDateInRange(date: ParsedDate, start: ParsedDate, end: ParsedDate): boolean {
	const d = dateToNumber(date);
	return d >= dateToNumber(start) && d <= dateToNumber(end);
}

/** Convert a ParsedDate to a comparable YYYYMMDD integer. */
function dateToNumber(d: ParsedDate): number {
	return d.year * 10000 + d.month * 100 + d.day;
}

/** Add days to a ParsedDate (handles month/year overflow via Date). */
function addDays(d: ParsedDate, days: number): ParsedDate {
	const date = new Date(d.year, d.month - 1, d.day + days);
	return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
}

/** Get the number of days in a given month. */
function daysInMonth(year: number, month: number): number {
	return new Date(year, month, 0).getDate();
}

// ── Date range resolution ───────────────────────────────

/**
 * Resolve a UI-level DateRangeFilter into an engine-level QueryDateRangeFilter.
 *
 * - Auto-detects the date column from column type hints if `filter.column` is empty.
 * - Resolves preset to actual dates, or uses custom startDate/endDate.
 * - Returns null if no date column can be found.
 */
export function resolveDateRangeFilter(
	filter: DateRangeFilter,
	columnTypeHints: ColumnTypeHint[],
): QueryDateRangeFilter | null {
	// Determine column — explicit or auto-detect first date column
	const column = filter.column || findFirstDateColumn(columnTypeHints);
	if (!column) return null;

	let start: ParsedDate;
	let end: ParsedDate;

	if (filter.preset === "custom" && filter.startDate && filter.endDate) {
		const s = parseDate(filter.startDate, undefined);
		const e = parseDate(filter.endDate, undefined);
		if (!s || !e) return null;
		start = s;
		end = e;
	} else {
		const range = computeDateRange(filter.preset);
		start = range.start;
		end = range.end;
	}

	return { column, start, end };
}

/** Find the first column with type "date" in the hints. */
export function findFirstDateColumn(hints: ColumnTypeHint[]): string | null {
	for (const h of hints) {
		if (h.type === "date") return h.column;
	}
	return null;
}
