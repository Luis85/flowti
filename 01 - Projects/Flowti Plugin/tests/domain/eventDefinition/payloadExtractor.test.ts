import { describe, it, expect } from "vitest";
import { extractPayload } from "../../../src/domain/eventDefinition/payloadExtractor";
import type { PayloadMapping } from "../../../src/domain/eventDefinition/types";

describe("payloadExtractor", () => {
	describe("path source", () => {
		it("should extract named groups from path regex", () => {
			const mappings: PayloadMapping[] = [
				{ field: "year", source: "path", expression: "report-(?<year>\\d{4})" },
			];
			const result = extractPayload(mappings, { path: "Reports/report-2026.csv" });
			expect(result.year).toBe("2026");
		});

		it("should extract first capture group when no named groups", () => {
			const mappings: PayloadMapping[] = [
				{ field: "date", source: "path", expression: "report-(\\d{4}-\\d{2})" },
			];
			const result = extractPayload(mappings, { path: "Reports/report-2026-01.csv" });
			expect(result.date).toBe("2026-01");
		});

		it("should return undefined for non-matching regex", () => {
			const mappings: PayloadMapping[] = [
				{ field: "year", source: "path", expression: "report-(?<year>\\d{4})" },
			];
			const result = extractPayload(mappings, { path: "Other/data.csv" });
			expect(result.year).toBeUndefined();
		});

		it("should return undefined when path is missing", () => {
			const mappings: PayloadMapping[] = [
				{ field: "year", source: "path", expression: "(?<year>\\d{4})" },
			];
			const result = extractPayload(mappings, { source: "user" });
			expect(result.year).toBeUndefined();
		});

		it("should handle invalid regex gracefully", () => {
			const mappings: PayloadMapping[] = [
				{ field: "bad", source: "path", expression: "[invalid" },
			];
			const result = extractPayload(mappings, { path: "test.md" });
			expect(result.bad).toBeUndefined();
		});
	});

	describe("metadata source", () => {
		it("should extract a metadata field by key", () => {
			const mappings: PayloadMapping[] = [
				{ field: "fileSource", source: "metadata", expression: "source" },
			];
			const result = extractPayload(mappings, { path: "test.md", source: "sync" });
			expect(result.fileSource).toBe("sync");
		});

		it("should return undefined for missing metadata key", () => {
			const mappings: PayloadMapping[] = [
				{ field: "missing", source: "metadata", expression: "nonexistent" },
			];
			const result = extractPayload(mappings, { path: "test.md" });
			expect(result.missing).toBeUndefined();
		});
	});

	describe("derived source", () => {
		it("should derive basename from path (without extension)", () => {
			const mappings: PayloadMapping[] = [
				{ field: "name", source: "derived", expression: "basename" },
			];
			const result = extractPayload(mappings, { path: "Reports/daily/report-2026.csv" });
			expect(result.name).toBe("report-2026");
		});

		it("should derive extension from path", () => {
			const mappings: PayloadMapping[] = [
				{ field: "ext", source: "derived", expression: "extension" },
			];
			const result = extractPayload(mappings, { path: "Reports/report.csv" });
			expect(result.ext).toBe("csv");
		});

		it("should derive dirname from path", () => {
			const mappings: PayloadMapping[] = [
				{ field: "dir", source: "derived", expression: "dirname" },
			];
			const result = extractPayload(mappings, { path: "Reports/daily/report.csv" });
			expect(result.dir).toBe("Reports/daily");
		});

		it("should derive 'now' as ISO timestamp", () => {
			const mappings: PayloadMapping[] = [
				{ field: "timestamp", source: "derived", expression: "now" },
			];
			const result = extractPayload(mappings, { path: "test.md" });
			expect(typeof result.timestamp).toBe("string");
			// Should be a valid ISO date
			expect(new Date(result.timestamp as string).toISOString()).toBe(result.timestamp);
		});

		it("should return undefined for unknown derived expression", () => {
			const mappings: PayloadMapping[] = [
				{ field: "unknown", source: "derived", expression: "foobar" },
			];
			const result = extractPayload(mappings, { path: "test.md" });
			expect(result.unknown).toBeUndefined();
		});

		it("should handle missing path for derived expressions", () => {
			const mappings: PayloadMapping[] = [
				{ field: "name", source: "derived", expression: "basename" },
				{ field: "ext", source: "derived", expression: "extension" },
				{ field: "dir", source: "derived", expression: "dirname" },
			];
			const result = extractPayload(mappings, { source: "user" });
			expect(result.name).toBeUndefined();
			expect(result.ext).toBeUndefined();
			expect(result.dir).toBeUndefined();
		});
	});

	describe("multiple mappings", () => {
		it("should extract multiple fields from different sources", () => {
			const mappings: PayloadMapping[] = [
				{ field: "year", source: "path", expression: "(?<year>\\d{4})" },
				{ field: "fileSource", source: "metadata", expression: "source" },
				{ field: "ext", source: "derived", expression: "extension" },
				{ field: "name", source: "derived", expression: "basename" },
			];
			const result = extractPayload(mappings, {
				path: "Reports/report-2026.csv",
				source: "sync",
			});
			expect(result).toEqual({
				year: "2026",
				fileSource: "sync",
				ext: "csv",
				name: "report-2026",
			});
		});

		it("should return empty object for empty mappings", () => {
			const result = extractPayload([], { path: "test.md" });
			expect(result).toEqual({});
		});
	});
});
