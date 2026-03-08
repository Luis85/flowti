import { describe, it, expect } from "vitest";
import { n, d } from "../../../src/domain/reports/cli/summary-formatters.js";

describe("n() — number formatter", () => {
	it("formats zero", () => {
		expect(n(0)).toBe("0");
	});

	it("formats small numbers without grouping", () => {
		expect(n(42)).toBe("42");
		expect(n(999)).toBe("999");
	});

	it("formats large numbers with locale grouping", () => {
		const result = n(1234567);
		// Locale-dependent, but should contain digit grouping
		expect(result).toMatch(/1.*234.*567/);
		expect(result.length).toBeGreaterThan(7); // at least one separator
	});

	it("formats negative numbers", () => {
		const result = n(-1234);
		expect(result).toContain("1");
		expect(result).toContain("234");
	});

	it("formats decimals", () => {
		const result = n(3.14);
		expect(result).toContain("3");
		expect(result).toContain("14");
	});
});

describe("d() — date formatter", () => {
	it("formats a date with year, month, day, and time", () => {
		const date = new Date("2026-03-08T14:23:05Z");
		const result = d(date);

		expect(result).toContain("2026");
		expect(result).toMatch(/[Mm]ar|03|ärz/); // locale-dependent month
		expect(result).toMatch(/14|02|15/); // hour (depends on timezone)
	});

	it("returns a non-empty string", () => {
		expect(d(new Date())).toBeTruthy();
	});
});
