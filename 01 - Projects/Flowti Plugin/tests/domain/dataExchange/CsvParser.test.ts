import { describe, it, expect, beforeEach } from "vitest";
import { CsvParser } from "../../../src/domain/dataExchange/CsvParser";

describe("CsvParser", () => {
	let parser: CsvParser;

	beforeEach(() => {
		parser = new CsvParser();
	});

	describe("parse", () => {
		it("should parse simple CSV with headers", () => {
			const csv = "name,age,city\nAlice,30,Berlin\nBob,25,Munich";
			const result = parser.parse(csv);

			expect(result.headers).toEqual(["name", "age", "city"]);
			expect(result.rowCount).toBe(2);
			expect(result.rows[0]).toEqual(["Alice", "30", "Berlin"]);
			expect(result.rows[1]).toEqual(["Bob", "25", "Munich"]);
		});

		it("should handle quoted fields with commas", () => {
			const csv = 'name,description\n"Smith, John","A, B, C"';
			const result = parser.parse(csv);

			expect(result.headers).toEqual(["name", "description"]);
			expect(result.rows[0]).toEqual(["Smith, John", "A, B, C"]);
		});

		it("should handle empty fields", () => {
			const csv = "a,b,c\n1,,3\n,,";
			const result = parser.parse(csv);

			expect(result.rows[0]).toEqual(["1", "", "3"]);
			expect(result.rows[1]).toEqual(["", "", ""]);
		});

		it("should skip empty lines", () => {
			const csv = "name\nAlice\n\nBob\n";
			const result = parser.parse(csv);

			expect(result.rowCount).toBe(2);
		});

		it("should handle BOM prefix", () => {
			const csv = "\uFEFFname,value\ntest,123";
			const result = parser.parse(csv);

			expect(result.headers[0]).toBe("name");
			expect(result.rowCount).toBe(1);
		});

		it("should handle tab-delimited content", () => {
			const csv = "name\tage\nAlice\t30";
			const result = parser.parse(csv, { delimiter: "\t" });

			expect(result.headers).toEqual(["name", "age"]);
			expect(result.rows[0]).toEqual(["Alice", "30"]);
		});

		it("should return empty result for empty content", () => {
			const result = parser.parse("");
			expect(result.headers).toEqual([]);
			expect(result.rows).toEqual([]);
			expect(result.rowCount).toBe(0);
		});

		it("should generate column names when hasHeader is false", () => {
			const csv = "Alice,30\nBob,25";
			const result = parser.parse(csv, { hasHeader: false });

			expect(result.headers).toEqual(["column_1", "column_2"]);
			expect(result.rowCount).toBe(2);
		});

		it("should return headers only when CSV has no data rows", () => {
			const csv = "name,age,city";
			const result = parser.parse(csv);

			expect(result.headers).toEqual(["name", "age", "city"]);
			expect(result.rowCount).toBe(0);
		});
	});

	describe("generate", () => {
		it("should generate CSV output", () => {
			const headers = ["name", "age"];
			const rows = [
				{ name: "Alice", age: "30" },
				{ name: "Bob", age: "25" },
			];

			const output = parser.generate(headers, rows, "csv");
			expect(output).toContain("name");
			expect(output).toContain("Alice");
			expect(output).toContain("Bob");
			// CSV uses commas
			expect(output).toContain(",");
		});

		it("should generate tab-delimited output", () => {
			const headers = ["name", "age"];
			const rows = [{ name: "Alice", age: "30" }];

			const output = parser.generate(headers, rows, "tab");
			expect(output).toContain("\t");
		});

		it("should handle missing values with empty string", () => {
			const headers = ["name", "age"];
			const rows = [{ name: "Alice" } as Record<string, string>];

			const output = parser.generate(headers, rows, "csv");
			// Should not throw and should include empty value
			expect(output).toContain("Alice");
		});
	});
});
