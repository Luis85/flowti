import { describe, expect, it } from "vitest";
import { parseDate, bucketDate, resolveDateFormat } from "../../../src/domain/analytics/dateUtils";
import type { ParsedDate } from "../../../src/domain/analytics/types";

describe("dateUtils", () => {
	describe("resolveDateFormat", () => {
		it("returns 'auto' for undefined locale", () => {
			expect(resolveDateFormat(undefined)).toBe("auto");
		});

		it("returns 'auto' for 'auto' locale", () => {
			expect(resolveDateFormat("auto")).toBe("auto");
		});

		it("returns MM/DD/YYYY for en-US", () => {
			expect(resolveDateFormat("en-US")).toBe("MM/DD/YYYY");
		});

		it("returns DD.MM.YYYY for de-DE", () => {
			expect(resolveDateFormat("de-DE")).toBe("DD.MM.YYYY");
		});

		it("returns DD/MM/YYYY for en-GB", () => {
			expect(resolveDateFormat("en-GB")).toBe("DD/MM/YYYY");
		});
	});

	describe("parseDate", () => {
		// ISO format (always detected)
		it("parses ISO: '2026-02-15' → { year: 2026, month: 2, day: 15 }", () => {
			const result = parseDate("2026-02-15", "en-US");
			expect(result).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("parses ISO regardless of locale", () => {
			expect(parseDate("2026-02-15", "de-DE")).toEqual({ year: 2026, month: 2, day: 15 });
			expect(parseDate("2026-02-15", "fr-FR")).toEqual({ year: 2026, month: 2, day: 15 });
		});

		// US format
		it("parses US: '02/15/2026' → month 2, day 15", () => {
			const result = parseDate("02/15/2026", "en-US");
			expect(result).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("parses US: '12/01/2026' → month 12, day 1", () => {
			const result = parseDate("12/01/2026", "en-US");
			expect(result).toEqual({ year: 2026, month: 12, day: 1 });
		});

		// German format
		it("parses DE: '15.02.2026' → month 2, day 15", () => {
			const result = parseDate("15.02.2026", "de-DE");
			expect(result).toEqual({ year: 2026, month: 2, day: 15 });
		});

		// GB format
		it("parses GB: '15/02/2026' → month 2, day 15", () => {
			const result = parseDate("15/02/2026", "en-GB");
			expect(result).toEqual({ year: 2026, month: 2, day: 15 });
		});

		// Auto format
		it("auto: unambiguous day > 12 → DD/MM", () => {
			const result = parseDate("15/02/2026", "auto");
			expect(result).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("auto: unambiguous month > 12 impossible → MM/DD", () => {
			const result = parseDate("02/15/2026", "auto");
			expect(result).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("auto: ambiguous '01/02/2026' defaults to MM/DD", () => {
			const result = parseDate("01/02/2026", "auto");
			expect(result).toEqual({ year: 2026, month: 1, day: 2 });
		});

		// 2-digit year support
		it("parses US 2-digit year: '02/11/26' → month 2, day 11, year 2026", () => {
			const result = parseDate("02/11/26", "en-US");
			expect(result).toEqual({ year: 2026, month: 2, day: 11 });
		});

		it("parses US 2-digit year: '12/25/99' → month 12, day 25, year 2099", () => {
			const result = parseDate("12/25/99", "en-US");
			expect(result).toEqual({ year: 2099, month: 12, day: 25 });
		});

		it("parses DE 2-digit year: '15.02.26' → month 2, day 15, year 2026", () => {
			const result = parseDate("15.02.26", "de-DE");
			expect(result).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("parses GB 2-digit year: '11/02/26' → month 2, day 11, year 2026", () => {
			const result = parseDate("11/02/26", "en-GB");
			expect(result).toEqual({ year: 2026, month: 2, day: 11 });
		});

		it("auto 2-digit year: '02/11/26' defaults to MM/DD", () => {
			const result = parseDate("02/11/26", "auto");
			expect(result).toEqual({ year: 2026, month: 2, day: 11 });
		});

		it("auto 2-digit year unambiguous: '25/11/26' → DD/MM (day > 12)", () => {
			const result = parseDate("25/11/26", "auto");
			expect(result).toEqual({ year: 2026, month: 11, day: 25 });
		});

		it("parses dash-separated 2-digit year: '02-11-26' with en-US", () => {
			const result = parseDate("02-11-26", "en-US");
			expect(result).toEqual({ year: 2026, month: 2, day: 11 });
		});

		// Edge cases
		it("returns null for empty string", () => {
			expect(parseDate("", "en-US")).toBeNull();
		});

		it("returns null for whitespace", () => {
			expect(parseDate("  ", "en-US")).toBeNull();
		});

		it("returns null for non-date: 'hello'", () => {
			expect(parseDate("hello", "en-US")).toBeNull();
		});

		it("returns null for invalid month > 12", () => {
			expect(parseDate("2026-13-01", "en-US")).toBeNull();
		});

		it("returns null for invalid day > 31", () => {
			expect(parseDate("2026-01-32", "en-US")).toBeNull();
		});
	});

	describe("bucketDate", () => {
		const date: ParsedDate = { year: 2026, month: 2, day: 15 };

		it("month bucket: '2026-02'", () => {
			expect(bucketDate(date, "month")).toBe("2026-02");
		});

		it("quarter bucket: '2026-Q1'", () => {
			expect(bucketDate(date, "quarter")).toBe("2026-Q1");
		});

		it("year bucket: '2026'", () => {
			expect(bucketDate(date, "year")).toBe("2026");
		});

		it("Q2 for April", () => {
			expect(bucketDate({ year: 2026, month: 4, day: 1 }, "quarter")).toBe("2026-Q2");
		});

		it("Q3 for July", () => {
			expect(bucketDate({ year: 2026, month: 7, day: 1 }, "quarter")).toBe("2026-Q3");
		});

		it("Q4 for October", () => {
			expect(bucketDate({ year: 2026, month: 10, day: 1 }, "quarter")).toBe("2026-Q4");
		});

		it("pads single-digit month: '2026-01'", () => {
			expect(bucketDate({ year: 2026, month: 1, day: 1 }, "month")).toBe("2026-01");
		});

		it("double-digit month: '2026-12'", () => {
			expect(bucketDate({ year: 2026, month: 12, day: 25 }, "month")).toBe("2026-12");
		});
	});
});
