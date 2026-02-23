import { describe, expect, it } from "vitest";
import {
	LOCALE_PRESETS,
	parseNumber,
	detectNumberLocale,
	resolveNumberFormat,
} from "../../../src/domain/analytics/localeUtils";

describe("localeUtils", () => {
	describe("LOCALE_PRESETS", () => {
		it("defines 5 locale presets", () => {
			expect(Object.keys(LOCALE_PRESETS)).toHaveLength(5);
		});

		it("en-US uses dot decimal and comma thousands", () => {
			const us = LOCALE_PRESETS["en-US"];
			expect(us.numberFormat.decimalSeparator).toBe(".");
			expect(us.numberFormat.thousandsSeparator).toBe(",");
		});

		it("de-DE uses comma decimal and dot thousands", () => {
			const de = LOCALE_PRESETS["de-DE"];
			expect(de.numberFormat.decimalSeparator).toBe(",");
			expect(de.numberFormat.thousandsSeparator).toBe(".");
		});

		it("fr-FR uses comma decimal and space thousands", () => {
			const fr = LOCALE_PRESETS["fr-FR"];
			expect(fr.numberFormat.decimalSeparator).toBe(",");
			expect(fr.numberFormat.thousandsSeparator).toBe(" ");
		});
	});

	describe("resolveNumberFormat", () => {
		it("returns en-US format for undefined locale", () => {
			const fmt = resolveNumberFormat(undefined);
			expect(fmt.decimalSeparator).toBe(".");
		});

		it("returns en-US format for auto locale", () => {
			const fmt = resolveNumberFormat("auto");
			expect(fmt.decimalSeparator).toBe(".");
		});

		it("returns correct format for de-DE", () => {
			const fmt = resolveNumberFormat("de-DE");
			expect(fmt.decimalSeparator).toBe(",");
		});
	});

	describe("parseNumber", () => {
		// US format
		it("parses US integer: '1,234' → 1234", () => {
			expect(parseNumber("1,234", "en-US")).toBe(1234);
		});

		it("parses US decimal: '1,234.56' → 1234.56", () => {
			expect(parseNumber("1,234.56", "en-US")).toBe(1234.56);
		});

		it("parses US large number: '1,234,567.89' → 1234567.89", () => {
			expect(parseNumber("1,234,567.89", "en-US")).toBe(1234567.89);
		});

		// EU format (de-DE)
		it("parses EU decimal: '1.234,56' → 1234.56", () => {
			expect(parseNumber("1.234,56", "de-DE")).toBe(1234.56);
		});

		it("parses EU integer: '1.234' → 1234", () => {
			expect(parseNumber("1.234", "de-DE")).toBe(1234);
		});

		it("parses EU large number: '1.234.567,89' → 1234567.89", () => {
			expect(parseNumber("1.234.567,89", "de-DE")).toBe(1234567.89);
		});

		// FR format
		it("parses FR decimal: '1 234,56' → 1234.56", () => {
			expect(parseNumber("1 234,56", "fr-FR")).toBe(1234.56);
		});

		it("parses FR large number: '1 234 567,89' → 1234567.89", () => {
			expect(parseNumber("1 234 567,89", "fr-FR")).toBe(1234567.89);
		});

		// Plain numbers
		it("parses plain integer: '42' → 42", () => {
			expect(parseNumber("42", "en-US")).toBe(42);
		});

		it("parses plain decimal: '3.14' → 3.14", () => {
			expect(parseNumber("3.14", "en-US")).toBe(3.14);
		});

		it("parses negative: '-1,234.56' → -1234.56", () => {
			expect(parseNumber("-1,234.56", "en-US")).toBe(-1234.56);
		});

		// Edge cases
		it("returns null for empty string", () => {
			expect(parseNumber("", "en-US")).toBeNull();
		});

		it("returns null for whitespace", () => {
			expect(parseNumber("  ", "en-US")).toBeNull();
		});

		it("returns null for non-numeric: 'abc'", () => {
			expect(parseNumber("abc", "en-US")).toBeNull();
		});

		it("strips currency symbols: '$1,234.56' → 1234.56", () => {
			expect(parseNumber("$1,234.56", "en-US")).toBe(1234.56);
		});

		it("strips euro symbol: '€1.234,56' → 1234.56", () => {
			expect(parseNumber("€1.234,56", "de-DE")).toBe(1234.56);
		});

		it("uses en-US as default for undefined locale", () => {
			expect(parseNumber("1,234.56", undefined)).toBe(1234.56);
		});

		it("handles zero: '0' → 0", () => {
			expect(parseNumber("0", "en-US")).toBe(0);
		});
	});

	describe("detectNumberLocale", () => {
		it("detects en-US from US-formatted numbers", () => {
			const samples = ["1,234.56", "2,345.67", "10.50"];
			expect(detectNumberLocale(samples)).toBe("en-US");
		});

		it("detects de-DE from EU-formatted numbers", () => {
			const samples = ["1.234,56", "2.345,67", "10,50"];
			expect(detectNumberLocale(samples)).toBe("de-DE");
		});

		it("detects fr-FR from space-thousands numbers", () => {
			const samples = ["1 234,56", "2 345,67"];
			expect(detectNumberLocale(samples)).toBe("fr-FR");
		});

		it("defaults to en-US for plain integers", () => {
			const samples = ["100", "200", "300"];
			expect(detectNumberLocale(samples)).toBe("en-US");
		});

		it("handles empty sample array", () => {
			expect(detectNumberLocale([])).toBe("en-US");
		});
	});
});
