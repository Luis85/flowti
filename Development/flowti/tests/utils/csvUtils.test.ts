import { describe, it, expect } from "vitest";
import {
	splitCsvLine,
	detectDelimiter,
	generateBaseYaml,
	getBaseFilename,
	formatRelativeTime,
	matchMergeKeyColumn,
	syncColumnMappings,
} from "../../src/utils/csvUtils";
import type { ColumnMapping } from "../../src/domain/dataExchange/types";

// ── splitCsvLine ─────────────────────────────────────────

describe("splitCsvLine", () => {
	it("should split a simple comma-delimited line", () => {
		expect(splitCsvLine("a,b,c", ",")).toEqual(["a", "b", "c"]);
	});

	it("should handle quoted fields containing delimiters", () => {
		expect(splitCsvLine('"hello, world",foo,bar', ",")).toEqual(["hello, world", "foo", "bar"]);
	});

	it("should handle tab delimiters", () => {
		expect(splitCsvLine("a\tb\tc", "\t")).toEqual(["a", "b", "c"]);
	});

	it("should trim whitespace from fields", () => {
		expect(splitCsvLine(" a , b , c ", ",")).toEqual(["a", "b", "c"]);
	});

	it("should handle empty fields", () => {
		expect(splitCsvLine("a,,c", ",")).toEqual(["a", "", "c"]);
	});

	it("should handle a single field with no delimiter", () => {
		expect(splitCsvLine("hello", ",")).toEqual(["hello"]);
	});

	it("should handle quoted fields with internal quotes", () => {
		// The lightweight parser strips outer quotes but doesn't unescape doubled quotes
		expect(splitCsvLine('"he said ""hi""",done', ",")).toEqual(["he said hi", "done"]);
	});

	it("should handle semicolon delimiters", () => {
		expect(splitCsvLine("a;b;c", ";")).toEqual(["a", "b", "c"]);
	});
});

// ── detectDelimiter ──────────────────────────────────────

describe("detectDelimiter", () => {
	it("should detect comma delimiter", () => {
		expect(detectDelimiter("name,age,city\nAlice,30,NYC")).toBe(",");
	});

	it("should detect semicolon delimiter", () => {
		expect(detectDelimiter("name;age;city")).toBe(";");
	});

	it("should detect tab delimiter", () => {
		expect(detectDelimiter("name\tage\tcity")).toBe("\t");
	});

	it("should detect pipe delimiter", () => {
		expect(detectDelimiter("name|age|city")).toBe("|");
	});

	it("should default to comma when no delimiters found", () => {
		expect(detectDelimiter("singlevalue")).toBe(",");
	});

	it("should ignore delimiters inside quoted fields", () => {
		// The semicolons are inside quotes, commas are outside
		expect(detectDelimiter('"a;b",c,d')).toBe(",");
	});

	it("should pick the most frequent delimiter", () => {
		expect(detectDelimiter("a,b;c,d,e")).toBe(",");
	});
});

// ── generateBaseYaml ─────────────────────────────────────

describe("generateBaseYaml", () => {
	it("should generate YAML with filters and columns", () => {
		const mappings: ColumnMapping[] = [
			{ csvColumn: "name", frontmatterKey: "name", included: true },
			{ csvColumn: "age", frontmatterKey: "age", included: true },
		];
		const result = generateBaseYaml("data/people", mappings);
		expect(result).toContain('inFolder("data/people")');
		expect(result).toContain('"name"');
		expect(result).toContain('"age"');
		expect(result).toContain('"file.name"');
	});

	it("should skip excluded columns", () => {
		const mappings: ColumnMapping[] = [
			{ csvColumn: "name", frontmatterKey: "name", included: true },
			{ csvColumn: "age", frontmatterKey: "age", included: false },
		];
		const result = generateBaseYaml("data/people", mappings);
		expect(result).toContain('"name"');
		expect(result).not.toContain('"age"');
	});

	it("should omit order section when no columns are included", () => {
		const result = generateBaseYaml("data/empty", []);
		expect(result).not.toContain("order:");
	});
});

// ── getBaseFilename ──────────────────────────────────────

describe("getBaseFilename", () => {
	it("should convert .csv to .base", () => {
		expect(getBaseFilename("data/people.csv")).toBe("people.base");
	});

	it("should handle paths without directories", () => {
		expect(getBaseFilename("report.csv")).toBe("report.base");
	});

	it("should handle empty path", () => {
		expect(getBaseFilename("")).toBe("imported.base");
	});
});

// ── formatRelativeTime ───────────────────────────────────

describe("formatRelativeTime", () => {
	it("should return 'just now' for recent timestamps", () => {
		expect(formatRelativeTime(Date.now() - 5000)).toBe("just now");
	});

	it("should return minutes for recent past", () => {
		expect(formatRelativeTime(Date.now() - 5 * 60 * 1000)).toBe("5m ago");
	});

	it("should return hours for longer past", () => {
		expect(formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000)).toBe("3h ago");
	});

	it("should return days for even longer past", () => {
		expect(formatRelativeTime(Date.now() - 7 * 24 * 60 * 60 * 1000)).toBe("7d ago");
	});

	it("should return a date string for old timestamps", () => {
		const old = Date.now() - 60 * 24 * 60 * 60 * 1000;
		const result = formatRelativeTime(old);
		// Should be a localized date string, not "Xd ago"
		expect(result).not.toContain("ago");
	});
});

// ── matchMergeKeyColumn ──────────────────────────────────

describe("matchMergeKeyColumn", () => {
	it("should match exact column name", () => {
		expect(matchMergeKeyColumn("item_id", ["name", "item_id", "status"]))
			.toBe("item_id");
	});

	it("should match case-insensitively", () => {
		expect(matchMergeKeyColumn("item_id", ["Name", "ItemID", "Status"]))
			.toBe("ItemID");
	});

	it("should match ignoring underscores", () => {
		expect(matchMergeKeyColumn("item_id", ["Name", "itemid", "Status"]))
			.toBe("itemid");
	});

	it("should match ignoring spaces", () => {
		expect(matchMergeKeyColumn("item_id", ["Name", "item id", "Status"]))
			.toBe("item id");
	});

	it("should match ignoring dashes", () => {
		expect(matchMergeKeyColumn("item_id", ["Name", "item-id", "Status"]))
			.toBe("item-id");
	});

	it("should match mixed normalization", () => {
		expect(matchMergeKeyColumn("Item_ID", ["name", "item-id", "status"]))
			.toBe("item-id");
	});

	it("should return undefined when no match", () => {
		expect(matchMergeKeyColumn("item_id", ["name", "status", "description"]))
			.toBeUndefined();
	});

	it("should return the first match", () => {
		expect(matchMergeKeyColumn("id", ["ID", "id", "Id"]))
			.toBe("ID");
	});

	it("should handle empty headers", () => {
		expect(matchMergeKeyColumn("item_id", []))
			.toBeUndefined();
	});
});

// ── syncColumnMappings ───────────────────────────────────

describe("syncColumnMappings", () => {
	it("should create fresh mappings when existing is empty", () => {
		const result = syncColumnMappings(["name", "age"], []);
		expect(result).toEqual([
			{ csvColumn: "name", frontmatterKey: "name", included: true },
			{ csvColumn: "age", frontmatterKey: "age", included: true },
		]);
	});

	it("should preserve existing mappings for matching headers", () => {
		const existing: ColumnMapping[] = [
			{ csvColumn: "name", frontmatterKey: "full_name", included: false },
		];
		const result = syncColumnMappings(["name", "age"], existing);
		expect(result).toHaveLength(2);
		expect(result[0]).toEqual({ csvColumn: "name", frontmatterKey: "full_name", included: false });
		expect(result[1]).toEqual({ csvColumn: "age", frontmatterKey: "age", included: true });
	});

	it("should remove stale mappings for headers that no longer exist", () => {
		const existing: ColumnMapping[] = [
			{ csvColumn: "name", frontmatterKey: "name", included: true },
			{ csvColumn: "removed", frontmatterKey: "removed", included: true },
		];
		const result = syncColumnMappings(["name", "age"], existing);
		expect(result).toHaveLength(2);
		expect(result.find((m) => m.csvColumn === "removed")).toBeUndefined();
	});

	it("should not mutate the input array", () => {
		const existing: ColumnMapping[] = [
			{ csvColumn: "name", frontmatterKey: "name", included: true },
		];
		const result = syncColumnMappings(["name", "age"], existing);
		expect(existing).toHaveLength(1);
		expect(result).toHaveLength(2);
	});

	it("should handle headers becoming empty", () => {
		const existing: ColumnMapping[] = [
			{ csvColumn: "name", frontmatterKey: "name", included: true },
		];
		const result = syncColumnMappings([], existing);
		expect(result).toHaveLength(0);
	});

	it("should handle identical headers (no-op sync)", () => {
		const existing: ColumnMapping[] = [
			{ csvColumn: "a", frontmatterKey: "a", included: true },
			{ csvColumn: "b", frontmatterKey: "b", included: false },
		];
		const result = syncColumnMappings(["a", "b"], existing);
		expect(result).toEqual(existing);
	});
});
