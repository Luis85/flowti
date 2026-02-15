/**
 * Tab-delimited export tests — verifies output matches Excel's tab-stop format.
 *
 * Excel tab-delimited conventions:
 * - Fields separated by \t (0x09)
 * - Rows separated by \r\n (CRLF)
 * - Plain fields: unquoted
 * - Fields containing the delimiter (\t), newlines, or double quotes: quoted
 * - Double quotes inside quoted fields: doubled ("" → escaped)
 * - Empty fields: empty string between delimiters
 * - No trailing line break after last row
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CsvParser } from "../../../src/domain/dataExchange/CsvParser";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { ExportService } from "../../../src/domain/dataExchange/ExportService";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { ExportConfig, VaultFileInfo } from "../../../src/domain/dataExchange/types";

// ── Helpers ─────────────────────────────────────────────

function createMockFileSystem(): IFileSystemClient {
	return {
		fileExists: vi.fn(async () => false),
		createFile: vi.fn(async () => {}),
		readFile: vi.fn(async () => { throw new Error("File not found"); }),
		updateFile: vi.fn(async () => {}),
		deleteFile: vi.fn(async () => {}),
		moveFile: vi.fn(async (_p: string, np: string) => np),
		renameFile: vi.fn(async (_p: string, nn: string) => nn),
		getFrontmatter: vi.fn(async () => ({})),
		updateFrontmatter: vi.fn(async (_p: string, d: Record<string, unknown>) => d),
		setFrontmatter: vi.fn(async () => {}),
	} as unknown as IFileSystemClient;
}

/** Extracts the written content from fileSystem.createFile mock. */
function getWrittenContent(fileSystem: IFileSystemClient): string {
	return (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
}

/** Splits output into lines by \r\n (Excel's line separator). */
function splitLines(content: string): string[] {
	return content.split("\r\n");
}

// ── CsvParser unit tests ────────────────────────────────

describe("Tab-delimited export (Excel compatibility)", () => {
	let parser: CsvParser;

	beforeEach(() => {
		parser = new CsvParser();
	});

	describe("CsvParser.generate — basic structure", () => {
		it("should separate fields with tab characters", () => {
			const output = parser.generate(
				["name", "age", "city"],
				[{ name: "Alice", age: "30", city: "Berlin" }],
				"tab",
			);

			const lines = splitLines(output);
			expect(lines[0]).toBe("name\tage\tcity");
			expect(lines[1]).toBe("Alice\t30\tBerlin");
		});

		it("should use CRLF line endings (Excel standard)", () => {
			const output = parser.generate(
				["a", "b"],
				[{ a: "1", b: "2" }],
				"tab",
			);

			// Must contain \r\n between header and data row
			expect(output).toContain("\r\n");
			// Must NOT contain bare \n without preceding \r
			const withoutCrlf = output.replace(/\r\n/g, "");
			expect(withoutCrlf).not.toContain("\n");
		});

		it("should not add trailing line break after last row", () => {
			const output = parser.generate(
				["x"],
				[{ x: "1" }, { x: "2" }],
				"tab",
			);

			expect(output).not.toMatch(/\r?\n$/);
		});

		it("should produce exact output for simple 2x2 table", () => {
			const output = parser.generate(
				["name", "age"],
				[
					{ name: "Alice", age: "30" },
					{ name: "Bob", age: "25" },
				],
				"tab",
			);

			expect(output).toBe("name\tage\r\nAlice\t30\r\nBob\t25");
		});

		it("should output header-only when rows are empty", () => {
			const output = parser.generate(["name", "age"], [], "tab");

			// papaparse appends a trailing CRLF after headers with no data rows
			expect(output.trimEnd()).toBe("name\tage");
			expect(output).toContain("name\tage");
		});

		it("should handle single column (no tab characters)", () => {
			const output = parser.generate(
				["name"],
				[{ name: "Alice" }, { name: "Bob" }],
				"tab",
			);

			expect(output).toBe("name\r\nAlice\r\nBob");
			expect(output).not.toContain("\t");
		});
	});

	describe("CsvParser.generate — no quoting for plain fields", () => {
		it("should not quote plain text fields", () => {
			const output = parser.generate(
				["name"],
				[{ name: "Alice" }],
				"tab",
			);

			expect(output).not.toContain('"');
		});

		it("should not quote numeric strings", () => {
			const output = parser.generate(
				["price", "qty"],
				[{ price: "19.99", qty: "100" }],
				"tab",
			);

			expect(output).not.toContain('"');
			expect(splitLines(output)[1]).toBe("19.99\t100");
		});

		it("should not quote fields containing commas (commas are data in tab format)", () => {
			const output = parser.generate(
				["name", "tags"],
				[{ name: "Alice", tags: "admin, editor, viewer" }],
				"tab",
			);

			// Commas are NOT special in tab-delimited — no quoting needed
			expect(output).not.toContain('"');
			expect(splitLines(output)[1]).toBe("Alice\tadmin, editor, viewer");
		});
	});

	describe("CsvParser.generate — empty and missing fields", () => {
		it("should produce empty string for missing keys", () => {
			const output = parser.generate(
				["name", "age", "city"],
				[{ name: "Alice" } as Record<string, string>],
				"tab",
			);

			// Missing age and city → empty strings between tabs
			expect(splitLines(output)[1]).toBe("Alice\t\t");
		});

		it("should produce consecutive tabs for all-empty row", () => {
			const output = parser.generate(
				["a", "b", "c"],
				[{} as Record<string, string>],
				"tab",
			);

			expect(splitLines(output)[1]).toBe("\t\t");
		});

		it("should handle explicit empty string values", () => {
			const output = parser.generate(
				["name", "note"],
				[{ name: "Alice", note: "" }],
				"tab",
			);

			expect(splitLines(output)[1]).toBe("Alice\t");
		});
	});

	describe("CsvParser.generate — special character quoting", () => {
		it("should quote fields containing tab characters", () => {
			const output = parser.generate(
				["data"],
				[{ data: "col1\tcol2" }],
				"tab",
			);

			// Tab inside field value MUST be quoted to avoid splitting
			const dataLine = splitLines(output)[1];
			expect(dataLine).toContain('"');
			expect(dataLine).toContain("col1\tcol2");
		});

		it("should quote fields containing newlines", () => {
			const output = parser.generate(
				["notes"],
				[{ notes: "line one\nline two" }],
				"tab",
			);

			// Newline inside field MUST be quoted
			expect(output).toContain('"line one\nline two"');
		});

		it("should quote and double-escape fields containing double quotes", () => {
			const output = parser.generate(
				["quote"],
				[{ quote: 'She said "hello"' }],
				"tab",
			);

			// Double quotes inside field → field is quoted, inner quotes doubled
			expect(output).toContain('"She said ""hello"""');
		});

		it("should quote fields containing CRLF", () => {
			const output = parser.generate(
				["text"],
				[{ text: "first\r\nsecond" }],
				"tab",
			);

			expect(output).toContain('"first\r\nsecond"');
		});
	});

	describe("CsvParser.generate — CSV vs Tab quoting difference", () => {
		it("should quote all fields in CSV mode but not in tab mode", () => {
			const headers = ["name", "city"];
			const rows = [{ name: "Alice", city: "Berlin" }];

			const csv = parser.generate(headers, rows, "csv");
			const tab = parser.generate(headers, rows, "tab");

			// CSV mode: all fields quoted (quotes: true)
			expect(csv).toContain('"Alice"');
			expect(csv).toContain('"Berlin"');

			// Tab mode: no quoting for plain fields (quotes: false)
			expect(tab).not.toContain('"');
		});

		it("should use comma delimiter in CSV and tab in tab mode", () => {
			const headers = ["a", "b"];
			const rows = [{ a: "1", b: "2" }];

			const csv = parser.generate(headers, rows, "csv");
			const tab = parser.generate(headers, rows, "tab");

			expect(csv).toContain(",");
			expect(csv).not.toContain("\t");

			expect(tab).toContain("\t");
			// Tab format should not use comma as delimiter
			const tabDataLine = splitLines(tab)[1];
			expect(tabDataLine).toBe("1\t2");
		});
	});

	describe("CsvParser.generate — wide and multi-row tables", () => {
		it("should handle 10 columns correctly", () => {
			const headers = Array.from({ length: 10 }, (_, i) => `col${i}`);
			const row: Record<string, string> = {};
			headers.forEach((h, i) => { row[h] = `val${i}`; });

			const output = parser.generate(headers, [row], "tab");
			const lines = splitLines(output);

			// Header should have 9 tabs (10 columns)
			expect(lines[0].split("\t")).toHaveLength(10);
			expect(lines[1].split("\t")).toHaveLength(10);
		});

		it("should maintain column alignment across rows", () => {
			const output = parser.generate(
				["name", "age", "city"],
				[
					{ name: "Alice", age: "30", city: "Berlin" },
					{ name: "Bob", age: "25", city: "Munich" },
					{ name: "Charlie", age: "35", city: "Hamburg" },
				],
				"tab",
			);

			const lines = splitLines(output);
			expect(lines).toHaveLength(4); // header + 3 rows

			// Every line must have the same number of tab separators
			const tabCounts = lines.map((l) => (l.match(/\t/g) ?? []).length);
			expect(new Set(tabCounts).size).toBe(1); // all same count
			expect(tabCounts[0]).toBe(2); // 3 columns = 2 tabs
		});
	});

	describe("CsvParser.generate — Unicode and special data", () => {
		it("should preserve Unicode characters", () => {
			const output = parser.generate(
				["name", "beschreibung"],
				[{ name: "Müller", beschreibung: "Geschäftsführer" }],
				"tab",
			);

			expect(splitLines(output)[1]).toBe("Müller\tGeschäftsführer");
		});

		it("should preserve emoji characters", () => {
			const output = parser.generate(
				["status"],
				[{ status: "Done ✅" }],
				"tab",
			);

			expect(splitLines(output)[1]).toBe("Done ✅");
		});

		it("should handle long field values without truncation", () => {
			const longValue = "x".repeat(10000);
			const output = parser.generate(
				["data"],
				[{ data: longValue }],
				"tab",
			);

			expect(splitLines(output)[1]).toBe(longValue);
		});
	});

	describe("CsvParser round-trip — generate then parse", () => {
		it("should round-trip simple data through generate → parse", () => {
			const headers = ["name", "age", "city"];
			const rows = [
				{ name: "Alice", age: "30", city: "Berlin" },
				{ name: "Bob", age: "25", city: "Munich" },
			];

			const tabOutput = parser.generate(headers, rows, "tab");
			const parsed = parser.parse(tabOutput, { delimiter: "\t" });

			expect(parsed.headers).toEqual(headers);
			expect(parsed.rowCount).toBe(2);
			expect(parsed.rows[0]).toEqual(["Alice", "30", "Berlin"]);
			expect(parsed.rows[1]).toEqual(["Bob", "25", "Munich"]);
		});

		it("should round-trip data with commas through tab format", () => {
			const headers = ["name", "tags"];
			const rows = [{ name: "Alice", tags: "admin, editor" }];

			const tabOutput = parser.generate(headers, rows, "tab");
			const parsed = parser.parse(tabOutput, { delimiter: "\t" });

			expect(parsed.rows[0]).toEqual(["Alice", "admin, editor"]);
		});

		it("should round-trip data with quoted fields through tab format", () => {
			const headers = ["name", "bio"];
			const rows = [{ name: "Alice", bio: 'She said "hello"' }];

			const tabOutput = parser.generate(headers, rows, "tab");
			const parsed = parser.parse(tabOutput, { delimiter: "\t" });

			expect(parsed.rows[0]).toEqual(["Alice", 'She said "hello"']);
		});

		it("should round-trip data with empty fields", () => {
			const headers = ["a", "b", "c"];
			const rows = [
				{ a: "1", b: "", c: "3" },
				{ a: "", b: "2", c: "" },
			];

			const tabOutput = parser.generate(headers, rows, "tab");
			const parsed = parser.parse(tabOutput, { delimiter: "\t" });

			expect(parsed.rows[0]).toEqual(["1", "", "3"]);
			expect(parsed.rows[1]).toEqual(["", "2", ""]);
		});
	});
});

// ── ExportService integration tests ─────────────────────

describe("ExportService tab-delimited output", () => {
	let service: ExportService;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;

	function makeFiles(overrides?: Partial<VaultFileInfo>[]): VaultFileInfo[] {
		const defaults: VaultFileInfo[] = [
			{
				path: "notes/alpha.md",
				basename: "alpha",
				extension: "md",
				folder: "notes",
				frontmatter: { type: "Event", domain: "Sales", description: "First event" },
				stat: { ctime: 1700000000000, mtime: 1700001000000, size: 256 },
				tags: ["event", "sales"],
			},
			{
				path: "notes/beta.md",
				basename: "beta",
				extension: "md",
				folder: "notes",
				frontmatter: { type: "Event", domain: "Marketing", description: "Second event" },
				stat: { ctime: 1700002000000, mtime: 1700003000000, size: 512 },
				tags: ["event"],
			},
			{
				path: "notes/gamma.md",
				basename: "gamma",
				extension: "md",
				folder: "notes",
				frontmatter: { type: "Task", domain: "Engineering" },
				stat: { ctime: 1700004000000, mtime: 1700005000000, size: 128 },
			},
		];
		if (overrides) {
			overrides.forEach((o, i) => {
				if (defaults[i]) Object.assign(defaults[i], o);
			});
		}
		return defaults;
	}

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		const files = makeFiles();
		service = new ExportService({
			eventBus,
			fileSystem,
			listFiles: (folder: string) => {
				if (!folder) return files;
				return files.filter((f) => f.folder === folder);
			},
		});
	});

	it("should produce tab-separated header and data rows", async () => {
		const config: ExportConfig = {
			sourcePath: "notes",
			sourceType: "folder",
			format: "tab",
			outputPath: "export.txt",
			columns: ["type", "domain"],
			fileProperties: [],
		};

		await service.executeExport(config);

		const content = getWrittenContent(fileSystem);
		const lines = splitLines(content);

		expect(lines[0]).toBe("type\tdomain");
		expect(lines[1]).toBe("Event\tSales");
		expect(lines[2]).toBe("Event\tMarketing");
		expect(lines[3]).toBe("Task\tEngineering");
	});

	it("should include file properties as unquoted tab-separated values", async () => {
		const config: ExportConfig = {
			sourcePath: "notes",
			sourceType: "folder",
			format: "tab",
			outputPath: "export.txt",
			columns: ["type"],
			fileProperties: ["file.name", "file.folder"],
		};

		await service.executeExport(config);

		const content = getWrittenContent(fileSystem);
		const lines = splitLines(content);

		// Headers: name, folder, type
		expect(lines[0]).toBe("name\tfolder\ttype");
		expect(lines[1]).toBe("alpha\tnotes\tEvent");
		expect(lines[2]).toBe("beta\tnotes\tEvent");
		expect(lines[3]).toBe("gamma\tnotes\tTask");

		// No quotes anywhere in the output
		expect(content).not.toContain('"');
	});

	it("should produce empty cells for missing frontmatter", async () => {
		const config: ExportConfig = {
			sourcePath: "notes",
			sourceType: "folder",
			format: "tab",
			outputPath: "export.txt",
			columns: ["type", "description"],
			fileProperties: [],
		};

		await service.executeExport(config);

		const content = getWrittenContent(fileSystem);
		const lines = splitLines(content);

		// gamma has no description → empty cell
		expect(lines[3]).toBe("Task\t");
	});

	it("should handle tags with commas without quoting in tab mode", async () => {
		const config: ExportConfig = {
			sourcePath: "notes",
			sourceType: "folder",
			format: "tab",
			outputPath: "export.txt",
			columns: [],
			fileProperties: ["file.name", "file.tags"],
		};

		await service.executeExport(config);

		const content = getWrittenContent(fileSystem);
		const lines = splitLines(content);

		// alpha has tags ["event", "sales"] → "event, sales" (comma-separated)
		// In tab-delimited, commas are NOT special → no quoting
		expect(lines[1]).toBe("alpha\tevent, sales");

		// gamma has no tags → empty
		expect(lines[3]).toBe("gamma\t");
	});

	it("should use displayNames in tab header row", async () => {
		const config: ExportConfig = {
			sourcePath: "notes",
			sourceType: "folder",
			format: "tab",
			outputPath: "export.txt",
			columns: ["type", "domain"],
			fileProperties: ["file.name"],
			displayNames: {
				"file.name": "Name",
				"note.domain": "Bereich",
			},
		};

		await service.executeExport(config);

		const content = getWrittenContent(fileSystem);
		const firstLine = splitLines(content)[0];

		// file.name → "Name", type → "type" (no override), domain → "Bereich"
		expect(firstLine).toBe("Name\ttype\tBereich");
	});

	it("should produce consistent column count across all rows", async () => {
		const config: ExportConfig = {
			sourcePath: "notes",
			sourceType: "folder",
			format: "tab",
			outputPath: "export.txt",
			columns: ["type", "domain", "description"],
			fileProperties: ["file.name"],
		};

		await service.executeExport(config);

		const content = getWrittenContent(fileSystem);
		const lines = splitLines(content);

		// 4 columns = 3 tab separators per line
		const tabCounts = lines.map((l) => (l.match(/\t/g) ?? []).length);
		expect(tabCounts.every((c) => c === 3)).toBe(true);
	});

	it("should export ISO timestamps in tab format", async () => {
		const config: ExportConfig = {
			sourcePath: "notes",
			sourceType: "folder",
			format: "tab",
			outputPath: "export.txt",
			columns: [],
			fileProperties: ["file.name", "file.ctime", "file.mtime"],
		};

		await service.executeExport(config);

		const content = getWrittenContent(fileSystem);
		const lines = splitLines(content);
		const fields = lines[1].split("\t");

		// alpha: ctime=1700000000000, mtime=1700001000000
		expect(fields[0]).toBe("alpha");
		expect(fields[1]).toBe(new Date(1700000000000).toISOString());
		expect(fields[2]).toBe(new Date(1700001000000).toISOString());

		// ISO timestamps may contain colons but no quoting needed in tab format
		expect(content).not.toContain('"');
	});

	it("should match CSV content but differ in delimiter and quoting", async () => {
		const baseConfig = {
			sourcePath: "notes",
			sourceType: "folder" as const,
			outputPath: "export",
			columns: ["type", "domain"],
			fileProperties: ["file.name"],
		};

		// Export as tab
		await service.executeExport({
			...baseConfig,
			format: "tab",
			outputPath: "export.txt",
		});
		const tabContent = getWrittenContent(fileSystem);

		// Reset mock
		(fileSystem.createFile as ReturnType<typeof vi.fn>).mockClear();

		// Export as CSV
		await service.executeExport({
			...baseConfig,
			format: "csv",
			outputPath: "export.csv",
		});
		const csvContent = getWrittenContent(fileSystem);

		// Tab: no quotes, tab-separated
		expect(tabContent).not.toContain('"');
		expect(tabContent).toContain("\t");

		// CSV: quoted fields, comma-separated
		expect(csvContent).toContain('"');
		expect(csvContent).toContain(",");

		// Both have the same number of rows
		const tabLines = splitLines(tabContent);
		const csvLines = splitLines(csvContent);
		expect(tabLines).toHaveLength(csvLines.length);
	});

	describe("frontmatter with special characters", () => {
		it("should quote frontmatter values containing double quotes", async () => {
			const specialFiles: VaultFileInfo[] = [{
				path: "notes/special.md",
				basename: "special",
				extension: "md",
				folder: "notes",
				frontmatter: { note: 'He said "yes"' },
			}];

			const svc = new ExportService({
				eventBus,
				fileSystem,
				listFiles: () => specialFiles,
			});

			const config: ExportConfig = {
				sourcePath: "notes",
				sourceType: "folder",
				format: "tab",
				outputPath: "export.txt",
				columns: ["note"],
				fileProperties: [],
			};

			await svc.executeExport(config);

			const content = getWrittenContent(fileSystem);
			const dataLine = splitLines(content)[1];

			// Field contains quotes → must be quoted with doubled escaping
			expect(dataLine).toBe('"He said ""yes"""');
		});

		it("should not quote frontmatter values containing commas in tab format", async () => {
			const specialFiles: VaultFileInfo[] = [{
				path: "notes/tagged.md",
				basename: "tagged",
				extension: "md",
				folder: "notes",
				frontmatter: { categories: "A, B, C" },
			}];

			const svc = new ExportService({
				eventBus,
				fileSystem,
				listFiles: () => specialFiles,
			});

			const config: ExportConfig = {
				sourcePath: "notes",
				sourceType: "folder",
				format: "tab",
				outputPath: "export.txt",
				columns: ["categories"],
				fileProperties: [],
			};

			await svc.executeExport(config);

			const content = getWrittenContent(fileSystem);

			// Commas are NOT special in tab format → no quoting
			expect(content).not.toContain('"');
			expect(splitLines(content)[1]).toBe("A, B, C");
		});
	});

	describe("tab-delimited append conflict strategy", () => {
		it("should append rows without duplicating header", async () => {
			// Existing file has tab-delimited content
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
				"type\tdomain\r\nEvent\tOldDomain",
			);

			const config: ExportConfig = {
				sourcePath: "notes",
				sourceType: "folder",
				format: "tab",
				outputPath: "export.txt",
				columns: ["type", "domain"],
				fileProperties: [],
				conflictStrategy: "append",
			};

			await service.executeExport(config);

			const content = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;

			// Count header occurrences — should appear exactly once
			const headerMatches = content.split("\n")
				.filter((l: string) => l.replace(/\r$/, "") === "type\tdomain");
			expect(headerMatches).toHaveLength(1);

			// Should contain old data AND new data
			expect(content).toContain("OldDomain");
			expect(content).toContain("Sales");
			expect(content).toContain("Marketing");
		});
	});
});
