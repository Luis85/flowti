import { describe, expect, it } from "vitest";
import { parseDate, bucketDate, resolveDateFormat, computeDateRange, isDateInRange, getISOWeekNumber, resolveDateRangeFilter, findFirstDateColumn } from "../../../src/domain/analytics/dateUtils";
import type { ColumnTypeHint, ParsedDate } from "../../../src/domain/analytics/types";

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

		it("strips ISO datetime T separator (2026-01-15T10:30:00)", () => {
			expect(parseDate("2026-01-15T10:30:00", "en-US")).toEqual({ year: 2026, month: 1, day: 15 });
		});

		it("strips space-separated time (2026-01-15 00:00:00)", () => {
			expect(parseDate("2026-01-15 00:00:00", "en-US")).toEqual({ year: 2026, month: 1, day: 15 });
		});

		it("strips time with timezone (2026-01-15T10:30:00Z)", () => {
			expect(parseDate("2026-01-15T10:30:00Z", "en-US")).toEqual({ year: 2026, month: 1, day: 15 });
		});

		it("strips time from slash-separated dates (01/15/2026 12:00)", () => {
			expect(parseDate("01/15/2026 12:00", "en-US")).toEqual({ year: 2026, month: 1, day: 15 });
		});

		it("strips time from dot-separated dates (15.01.2026 08:30)", () => {
			expect(parseDate("15.01.2026 08:30", "de-DE")).toEqual({ year: 2026, month: 1, day: 15 });
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

		it("day bucket: '2026-02-15'", () => {
			expect(bucketDate(date, "day")).toBe("2026-02-15");
		});

		it("day bucket pads single-digit day and month", () => {
			expect(bucketDate({ year: 2026, month: 1, day: 3 }, "day")).toBe("2026-01-03");
		});

		it("week bucket: ISO week number", () => {
			// 2026-02-15 is a Sunday — ISO week 7
			expect(bucketDate(date, "week")).toBe("2026-W07");
		});

		it("week bucket: first week of year", () => {
			expect(bucketDate({ year: 2026, month: 1, day: 1 }, "week")).toBe("2026-W01");
		});
	});

	describe("getISOWeekNumber", () => {
		it("returns week 1 for January 1, 2026", () => {
			expect(getISOWeekNumber({ year: 2026, month: 1, day: 1 })).toBe(1);
		});

		it("returns week 53 for Dec 31, 2020 (53-week year)", () => {
			expect(getISOWeekNumber({ year: 2020, month: 12, day: 31 })).toBe(53);
		});
	});

	describe("computeDateRange", () => {
		const now = new Date(2026, 1, 15); // Feb 15, 2026 (month is 0-indexed)

		it("last-7-days: Feb 9 to Feb 15", () => {
			const r = computeDateRange("last-7-days", now);
			expect(r.start).toEqual({ year: 2026, month: 2, day: 9 });
			expect(r.end).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("last-30-days: Jan 17 to Feb 15", () => {
			const r = computeDateRange("last-30-days", now);
			expect(r.start).toEqual({ year: 2026, month: 1, day: 17 });
			expect(r.end).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("last-90-days: Nov 18 to Feb 15", () => {
			const r = computeDateRange("last-90-days", now);
			expect(r.start).toEqual({ year: 2025, month: 11, day: 18 });
			expect(r.end).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("this-week: Mon Feb 9 to Sun Feb 15", () => {
			const r = computeDateRange("this-week", now);
			expect(r.start).toEqual({ year: 2026, month: 2, day: 9 });
			expect(r.end).toEqual({ year: 2026, month: 2, day: 15 });
		});

		it("last-week: Mon Feb 2 to Sun Feb 8", () => {
			const r = computeDateRange("last-week", now);
			expect(r.start).toEqual({ year: 2026, month: 2, day: 2 });
			expect(r.end).toEqual({ year: 2026, month: 2, day: 8 });
		});

		it("this-month: Feb 1 to Feb 28", () => {
			const r = computeDateRange("this-month", now);
			expect(r.start).toEqual({ year: 2026, month: 2, day: 1 });
			expect(r.end).toEqual({ year: 2026, month: 2, day: 28 });
		});

		it("last-month: Jan 1 to Jan 31", () => {
			const r = computeDateRange("last-month", now);
			expect(r.start).toEqual({ year: 2026, month: 1, day: 1 });
			expect(r.end).toEqual({ year: 2026, month: 1, day: 31 });
		});

		it("this-quarter: Jan 1 to Mar 31", () => {
			const r = computeDateRange("this-quarter", now);
			expect(r.start).toEqual({ year: 2026, month: 1, day: 1 });
			expect(r.end).toEqual({ year: 2026, month: 3, day: 31 });
		});

		it("last-quarter: Q4 2025 — Oct 1 to Dec 31", () => {
			const r = computeDateRange("last-quarter", now);
			expect(r.start).toEqual({ year: 2025, month: 10, day: 1 });
			expect(r.end).toEqual({ year: 2025, month: 12, day: 31 });
		});

		it("this-year: Jan 1 to Dec 31", () => {
			const r = computeDateRange("this-year", now);
			expect(r.start).toEqual({ year: 2026, month: 1, day: 1 });
			expect(r.end).toEqual({ year: 2026, month: 12, day: 31 });
		});

		it("last-year: 2025", () => {
			const r = computeDateRange("last-year", now);
			expect(r.start).toEqual({ year: 2025, month: 1, day: 1 });
			expect(r.end).toEqual({ year: 2025, month: 12, day: 31 });
		});

		it("last-month wraps year boundary (Jan → Dec)", () => {
			const jan = new Date(2026, 0, 15);
			const r = computeDateRange("last-month", jan);
			expect(r.start).toEqual({ year: 2025, month: 12, day: 1 });
			expect(r.end).toEqual({ year: 2025, month: 12, day: 31 });
		});

		it("last-quarter wraps year boundary (Q1 → Q4)", () => {
			const jan = new Date(2026, 0, 15);
			const r = computeDateRange("last-quarter", jan);
			expect(r.start).toEqual({ year: 2025, month: 10, day: 1 });
			expect(r.end).toEqual({ year: 2025, month: 12, day: 31 });
		});
	});

	describe("isDateInRange", () => {
		const start: ParsedDate = { year: 2026, month: 1, day: 1 };
		const end: ParsedDate = { year: 2026, month: 1, day: 31 };

		it("date within range returns true", () => {
			expect(isDateInRange({ year: 2026, month: 1, day: 15 }, start, end)).toBe(true);
		});

		it("date on start boundary returns true", () => {
			expect(isDateInRange(start, start, end)).toBe(true);
		});

		it("date on end boundary returns true", () => {
			expect(isDateInRange(end, start, end)).toBe(true);
		});

		it("date before range returns false", () => {
			expect(isDateInRange({ year: 2025, month: 12, day: 31 }, start, end)).toBe(false);
		});

		it("date after range returns false", () => {
			expect(isDateInRange({ year: 2026, month: 2, day: 1 }, start, end)).toBe(false);
		});
	});

	describe("resolveDateRangeFilter", () => {
		const hints: ColumnTypeHint[] = [
			{ column: "date", type: "date" },
			{ column: "amount", type: "number" },
		];

		it("auto-detects date column from hints", () => {
			const result = resolveDateRangeFilter(
				{ column: "", preset: "this-month" },
				hints,
			);
			expect(result).not.toBeNull();
			expect(result!.column).toBe("date");
		});

		it("uses explicit column when provided", () => {
			const result = resolveDateRangeFilter(
				{ column: "order_date", preset: "this-month" },
				[{ column: "order_date", type: "date" }],
			);
			expect(result!.column).toBe("order_date");
		});

		it("returns null when no date columns found", () => {
			const result = resolveDateRangeFilter(
				{ column: "", preset: "this-month" },
				[{ column: "amount", type: "number" }],
			);
			expect(result).toBeNull();
		});

		it("resolves custom range from startDate/endDate", () => {
			const result = resolveDateRangeFilter(
				{ column: "date", preset: "custom", startDate: "2026-01-01", endDate: "2026-01-31" },
				hints,
			);
			expect(result!.start).toEqual({ year: 2026, month: 1, day: 1 });
			expect(result!.end).toEqual({ year: 2026, month: 1, day: 31 });
		});

		it("falls back to today for custom without explicit dates", () => {
			const result = resolveDateRangeFilter(
				{ column: "date", preset: "custom" },
				hints,
			);
			// Without explicit startDate/endDate, computeDateRange("custom") returns today
			expect(result).not.toBeNull();
			expect(result!.column).toBe("date");
		});

		it("passes through explicit column even when not in hints (engine validates)", () => {
			// UI selected "snapshot_date" — resolver trusts it, engine checks source headers
			const result = resolveDateRangeFilter(
				{ column: "snapshot_date", preset: "this-month" },
				[{ column: "order_date", type: "date" }, { column: "amount", type: "number" }],
			);
			expect(result).not.toBeNull();
			expect(result!.column).toBe("snapshot_date");
		});
	});

	describe("findFirstDateColumn", () => {
		it("returns first date column", () => {
			expect(findFirstDateColumn([
				{ column: "name", type: "string" },
				{ column: "date", type: "date" },
				{ column: "amount", type: "number" },
			])).toBe("date");
		});

		it("returns null when no date columns", () => {
			expect(findFirstDateColumn([
				{ column: "name", type: "string" },
			])).toBeNull();
		});
	});
});
