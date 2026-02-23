/**
 * Locale-aware date parsing and time bucketing utilities.
 */

import type { DateFormatPattern, LocaleId, ParsedDate, TimeBucketPeriod } from "./types";
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
 * - MM/DD/YYYY (en-US)
 * - DD/MM/YYYY (en-GB, nl-NL, fr-FR)
 * - DD.MM.YYYY (de-DE)
 * - YYYY-MM-DD (ISO — detected automatically)
 */
export function parseDate(raw: string, localeId: LocaleId | undefined): ParsedDate | null {
	if (!raw || raw.trim() === "") return null;
	const s = raw.trim();

	// Always try ISO first (unambiguous)
	const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
	if (isoMatch) {
		return makeDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
	}

	const format = resolveDateFormat(localeId);

	// DD.MM.YYYY (German style)
	const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
	if (dotMatch) {
		return makeDate(Number(dotMatch[3]), Number(dotMatch[2]), Number(dotMatch[1]));
	}

	// Slash-based formats: MM/DD/YYYY or DD/MM/YYYY
	const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (slashMatch) {
		const a = Number(slashMatch[1]);
		const b = Number(slashMatch[2]);
		const year = Number(slashMatch[3]);

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

	return null;
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
