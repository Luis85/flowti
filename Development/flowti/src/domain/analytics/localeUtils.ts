/**
 * Locale-aware number parsing utilities.
 *
 * Provides 5 locale presets (en-US, de-DE, en-GB, nl-NL, fr-FR)
 * and an auto-detect heuristic for CSV number values.
 */

import type { LocaleId, NumberDisplayFormat, NumberFormat, SourceLocale } from "./types";

// ── Locale presets ──────────────────────────────────────

export const LOCALE_PRESETS: Record<Exclude<LocaleId, "auto">, SourceLocale> = {
	"en-US": {
		id: "en-US",
		label: "English (US)",
		numberFormat: { decimalSeparator: ".", thousandsSeparator: "," },
		dateFormat: "MM/DD/YYYY",
	},
	"de-DE": {
		id: "de-DE",
		label: "German (DE)",
		numberFormat: { decimalSeparator: ",", thousandsSeparator: "." },
		dateFormat: "DD.MM.YYYY",
	},
	"en-GB": {
		id: "en-GB",
		label: "English (UK)",
		numberFormat: { decimalSeparator: ".", thousandsSeparator: "," },
		dateFormat: "DD/MM/YYYY",
	},
	"nl-NL": {
		id: "nl-NL",
		label: "Dutch (NL)",
		numberFormat: { decimalSeparator: ",", thousandsSeparator: "." },
		dateFormat: "DD/MM/YYYY",
	},
	"fr-FR": {
		id: "fr-FR",
		label: "French (FR)",
		numberFormat: { decimalSeparator: ",", thousandsSeparator: " " },
		dateFormat: "DD/MM/YYYY",
	},
};

/**
 * Resolve a locale ID to its number format.
 * For "auto", falls back to en-US (caller should use detectLocale first).
 */
export function resolveNumberFormat(localeId: LocaleId | undefined): NumberFormat {
	if (!localeId || localeId === "auto") return LOCALE_PRESETS["en-US"].numberFormat;
	return LOCALE_PRESETS[localeId].numberFormat;
}

// ── Number parsing ──────────────────────────────────────

/**
 * Parse a raw string value as a number using the given locale's format.
 *
 * - Strips thousands separators
 * - Normalizes decimal separator to "."
 * - Returns null for empty, non-numeric, or unparseable values
 */
export function parseNumber(raw: string, localeId: LocaleId | undefined): number | null {
	if (!raw || raw.trim() === "") return null;

	const fmt = resolveNumberFormat(localeId);
	let cleaned = raw.trim();

	// Strip currency symbols and whitespace-like chars (non-breaking space, etc.)
	cleaned = cleaned.replace(/[€$£¥₹]/g, "");

	// Strip thousands separators
	if (fmt.thousandsSeparator === " ") {
		// French: thin space (U+202F) and regular space
		cleaned = cleaned.replace(/[\s\u00A0\u202F]/g, "");
	} else {
		cleaned = cleaned.replace(new RegExp(`\\${fmt.thousandsSeparator}`, "g"), "");
	}

	// Normalize decimal separator
	if (fmt.decimalSeparator !== ".") {
		cleaned = cleaned.replace(fmt.decimalSeparator, ".");
	}

	const num = Number(cleaned);
	if (isNaN(num)) return null;
	return num;
}

// ── Auto-detect heuristic ───────────────────────────────

/**
 * Detect the most likely locale from a sample of numeric string values.
 *
 * Heuristic: scan for the last occurrence of "," or "." in each value.
 * If the last separator has digits after it:
 * - 3 digits after → likely thousands separator
 * - 1-2 digits after → likely decimal separator
 *
 * Returns the best-guess locale ID.
 */
export function detectNumberLocale(samples: string[]): LocaleId {
	let dotDecimalCount = 0;
	let commaDecimalCount = 0;
	let spaceThousandsCount = 0;

	for (const raw of samples) {
		const s = raw.trim();
		if (!s) continue;

		// Check for French-style space thousands separator
		if (/\d[\s\u00A0\u202F]\d{3}/.test(s)) {
			spaceThousandsCount++;
		}

		// Find last comma and last dot positions
		const lastComma = s.lastIndexOf(",");
		const lastDot = s.lastIndexOf(".");

		if (lastComma === -1 && lastDot === -1) continue;

		if (lastComma > lastDot) {
			// Comma is the last separator
			const afterComma = s.substring(lastComma + 1);
			if (/^\d{1,2}$/.test(afterComma)) commaDecimalCount++;
		} else if (lastDot > lastComma) {
			// Dot is the last separator
			const afterDot = s.substring(lastDot + 1);
			if (/^\d{1,2}$/.test(afterDot)) dotDecimalCount++;
		}
	}

	if (spaceThousandsCount > 0 && commaDecimalCount >= dotDecimalCount) return "fr-FR";
	if (commaDecimalCount > dotDecimalCount) return "de-DE";
	return "en-US";
}

// ── Display formatting ─────────────────────────────────

/**
 * Format a number for display with optional currency/percent styling.
 *
 * - "currency": prepends symbol (defaults to "$"), uses locale grouping
 * - "percent": multiplies by 100, appends "%"
 * - "plain": standard locale grouping (default)
 *
 * When no explicit format is given but a detected currency symbol exists,
 * auto-applies currency formatting.
 */
export function formatDisplayNumber(
	value: number,
	format?: NumberDisplayFormat,
	detectedSymbol?: string,
): string {
	const style = format?.style ?? (detectedSymbol ? "currency" : "plain");
	const symbol = format?.symbol ?? detectedSymbol ?? "$";
	const decimals = format?.decimals;

	if (style === "currency") {
		const formatted =
			decimals !== undefined
				? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
				: value.toLocaleString();
		return `${symbol}${formatted}`;
	}
	if (style === "percent") {
		return `${(value * 100).toFixed(decimals ?? 1)}%`;
	}
	return decimals !== undefined
		? value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
		: value.toLocaleString();
}
