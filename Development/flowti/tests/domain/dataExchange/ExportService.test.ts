import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { ExportService } from "../../../src/domain/dataExchange/ExportService";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { ExportConfig, ResolvedColumn, VaultFileInfo } from "../../../src/domain/dataExchange/types";
import { createMockFileSystemStub as createMockFileSystem } from "../../mocks/filesystem";

function makeFiles(): VaultFileInfo[] {
	return [
		{
			path: "items/widget.md",
			basename: "widget",
			extension: "md",
			folder: "items",
			frontmatter: { type: "Item", category: "Tools", price: "19.99" },
			stat: { ctime: 1700000000000, mtime: 1700001000000, size: 256 },
			tags: ["item", "tools"],
		},
		{
			path: "items/gadget.md",
			basename: "gadget",
			extension: "md",
			folder: "items",
			frontmatter: { type: "Item", category: "Electronics", price: "49.99" },
			stat: { ctime: 1700002000000, mtime: 1700003000000, size: 512 },
		},
		{
			path: "items/readme.txt",
			basename: "readme",
			extension: "txt",
			folder: "items",
			frontmatter: undefined,
		},
	];
}

describe("ExportService", () => {
	let service: ExportService;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;
	let mockFiles: VaultFileInfo[];

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		mockFiles = makeFiles();
		service = new ExportService({
			eventBus,
			fileSystem,
			listFiles: (folder: string) => {
				if (!folder) return mockFiles;
				return mockFiles.filter((f) => f.folder === folder || f.folder.startsWith(folder + "/"));
			},
		});
	});

	describe("scanColumns", () => {
		it("should discover frontmatter keys from folder files", async () => {
			const columns = await service.scanColumns("items", "folder");

			expect(columns).toContain("type");
			expect(columns).toContain("category");
			expect(columns).toContain("price");
			// Should not include "position" (Obsidian internal)
			expect(columns).not.toContain("position");
		});

		it("should return sorted unique columns", async () => {
			const columns = await service.scanColumns("items", "folder");

			// Should be sorted
			const sorted = [...columns].sort();
			expect(columns).toEqual(sorted);
		});

		it("should use base view order as columns for base sources", async () => {
			const baseYaml = `filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Items
    order:
      - file.name
      - note.stage
      - note.category
      - domain`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const columns = await service.scanColumns("items.base", "base", 0);

			// file.name should be filtered out (handled by fileProperties)
			expect(columns).not.toContain("file.name");
			// note.stage → stage, note.category → category
			expect(columns).toContain("stage");
			expect(columns).toContain("category");
			// direct property stays as-is
			expect(columns).toContain("domain");
		});

		it("should resolve formula columns via formulas map", async () => {
			const baseYaml = `formulas:
  Total: price
  Desc: description
views:
  - type: table
    name: Items
    order:
      - file.name
      - note.stage
      - formula.Total
      - formula.Desc`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const columns = await service.scanColumns("items.base", "base", 0);

			// formula.Total → resolves via formulas["Total"] = "price"
			expect(columns).toContain("price");
			// formula.Desc → resolves via formulas["Desc"] = "description"
			expect(columns).toContain("description");
			expect(columns).not.toContain("formula.Total");
			expect(columns).not.toContain("Total");
		});

		it("should fall back to formula name when no formulas section", async () => {
			const baseYaml = `views:
  - type: table
    name: Items
    order:
      - file.name
      - note.stage
      - formula.total
      - formula.discount`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const columns = await service.scanColumns("items.base", "base", 0);

			expect(columns).toContain("total");
			expect(columns).toContain("discount");
			expect(columns).not.toContain("formula.total");
		});

		it("should resolve prop() formula expressions to property names", async () => {
			const baseYaml = `formulas:
  Total: 'prop("price")'
  Label: "prop('description')"
views:
  - type: table
    name: Items
    order:
      - formula.Total
      - formula.Label`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const columns = await service.scanColumns("items.base", "base", 0);

			// prop("price") → price, prop('description') → description
			expect(columns).toContain("price");
			expect(columns).toContain("description");
			expect(columns).not.toContain("Total");
			expect(columns).not.toContain("Label");
		});

		it("should fall back to formula name for compound formulas", async () => {
			const baseYaml = `formulas:
  ProductValue: 'prop("price") * prop("quantity")'
  Status: 'if(prop("done"), "yes", "no")'
views:
  - type: table
    name: Items
    order:
      - formula.ProductValue
      - formula.Status`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const columns = await service.scanColumns("items.base", "base", 0);

			// Compound formulas can't resolve to a single property
			expect(columns).toContain("ProductValue");
			expect(columns).toContain("Status");
		});

		it("should preserve view column order for base sources", async () => {
			const baseYaml = `views:
  - type: table
    name: Items
    order:
      - note.category
      - note.type
      - domain
      - note.price`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const columns = await service.scanColumns("items.base", "base", 0);

			// Order should match the view's order array, not alphabetical
			expect(columns).toEqual(["category", "type", "domain", "price"]);
		});

		it("should fall back to frontmatter scan when base view has no order", async () => {
			const baseYaml = `filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Items`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const columns = await service.scanColumns("items.base", "base", 0);

			// Should fall back to scanning frontmatter from resolved files
			expect(columns).toContain("type");
			expect(columns).toContain("category");
		});
	});

	describe("scanViewFileProperties", () => {
		it("should return file.* entries from base view order", async () => {
			const baseYaml = `views:
  - type: table
    name: Items
    order:
      - file.name
      - file.path
      - note.stage
      - domain`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const fileProps = await service.scanViewFileProperties("items.base", 0);

			expect(fileProps).toEqual(["file.name", "file.path"]);
		});

		it("should return empty array when view has no order", async () => {
			const baseYaml = `views:
  - type: table
    name: Items`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const fileProps = await service.scanViewFileProperties("items.base", 0);

			expect(fileProps).toEqual([]);
		});
	});

	describe("executeExport (folder)", () => {
		it("should export folder as CSV with clean header labels", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type", "category", "price"],
				fileProperties: ["file.name"],
			};

			const result = await service.executeExport(config);

			expect(result.totalRows).toBe(3);
			expect(result.totalColumns).toBe(4); // name + 3 columns
			expect(result.outputPath).toBe("exports/items.csv");
			expect(fileSystem.createFile).toHaveBeenCalledOnce();

			const [outputPath, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(outputPath).toBe("exports/items.csv");
			// Header uses clean label "name" not "file.name"
			expect(content).toContain("name");
			expect(content).toContain("widget");
			expect(content).toContain("19.99");
		});

		it("should export as tab-delimited", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "tab",
				outputPath: "exports/items.tsv",
				columns: ["type", "category"],
				fileProperties: [],
			};

			const result = await service.executeExport(config);

			expect(result.totalColumns).toBe(2);
			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			expect(content).toContain("\t");
		});

		it("should not include file properties when none selected", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: [],
			};

			const result = await service.executeExport(config);

			expect(result.totalColumns).toBe(1);
		});

		it("should handle files without frontmatter (empty values)", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			// readme.txt has no frontmatter, should have empty type value
			expect(content).toContain("readme");
		});

		it("should include multiple file properties with clean labels", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name", "file.path", "file.folder", "file.ext"],
			};

			const result = await service.executeExport(config);

			expect(result.totalColumns).toBe(5); // 4 file props + 1 column
			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			// Headers are clean labels
			const firstLine = content.split("\n")[0];
			expect(firstLine).toContain("name");
			expect(firstLine).toContain("path");
			expect(firstLine).toContain("folder");
			expect(firstLine).toContain("ext");
			// Values
			expect(content).toContain("items/widget.md"); // file.path value
			expect(content).toContain("items"); // file.folder value
		});

		it("should resolve stat-based file properties", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: [],
				fileProperties: ["file.ctime", "file.mtime", "file.size"],
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			// widget has stat, should have ISO dates and size
			expect(content).toContain(new Date(1700000000000).toISOString());
			expect(content).toContain(new Date(1700001000000).toISOString());
			expect(content).toContain("256");
			// readme.txt has no stat, should have empty values
		});

		it("should resolve tags file property", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: [],
				fileProperties: ["file.name", "file.tags"],
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			// widget has tags ["item", "tools"]
			expect(content).toContain("item, tools");
		});

		it("should resolve fullname file property", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: [],
				fileProperties: ["file.fullname"],
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			expect(content).toContain("widget.md");
			expect(content).toContain("gadget.md");
			expect(content).toContain("readme.txt");
		});

		it("should emit export.started event with operationId", async () => {
			const handler = vi.fn();
			eventBus.on("dataExchange.export.started", handler);

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "out.csv",
				columns: ["type"],
				fileProperties: [],
			};

			await service.executeExport(config);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						operationId: expect.any(String),
						config: expect.objectContaining({ sourcePath: "items" }),
					}),
				})
			);
		});

		it("should propagate pipelineId to export.started when provided", async () => {
			const handler = vi.fn();
			eventBus.on("dataExchange.export.started", handler);

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "out.csv",
				columns: ["type"],
				fileProperties: [],
			};

			await service.executeExport(config, { pipelineId: "pipe-42" });

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.pipelineId).toBe("pipe-42");
		});

		it("should emit export.progress per file (TD-68)", async () => {
			const handler = vi.fn();
			eventBus.on("dataExchange.export.progress", handler);

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "out.csv",
				columns: ["type"],
				fileProperties: [],
			};

			await service.executeExport(config);

			// 3 files in the mocked "items" folder
			expect(handler).toHaveBeenCalledTimes(3);
			expect(handler.mock.calls[0][0].payload).toEqual(
				expect.objectContaining({ current: 1, total: 3, currentFile: "items/widget.md" }),
			);
			expect(handler.mock.calls[2][0].payload).toEqual(
				expect.objectContaining({ current: 3, total: 3 }),
			);
		});
	});

	describe("executeExport (base)", () => {
		it("should export base file with filter evaluation", async () => {
			const baseYaml = `filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Items`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const config: ExportConfig = {
				sourcePath: "items.base",
				sourceType: "base",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type", "category"],
				fileProperties: ["file.name"],
				baseViewIndex: 0,
			};

			const result = await service.executeExport(config);

			// Only .md files should be included (readme.txt filtered out)
			expect(result.totalRows).toBe(2);
		});

		it("should export formula-resolved columns with actual frontmatter values", async () => {
			const baseYaml = `filters:
  and:
    - file.ext == "md"
formulas:
  Total: 'prop("price")'
views:
  - type: table
    name: Items
    order:
      - file.name
      - formula.Total`;

			// First call: base file parse (resolveFiles). Second call: output file check (should not exist).
			(fileSystem.readFile as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(baseYaml)
				.mockResolvedValueOnce(baseYaml)
				.mockRejectedValue(new Error("Not found"));

			// scanColumns resolves formula.Total → "price"
			const columns = await service.scanColumns("items.base", "base", 0);
			expect(columns).toContain("price");

			const config: ExportConfig = {
				sourcePath: "items.base",
				sourceType: "base",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["price"],
				fileProperties: ["file.name"],
				baseViewIndex: 0,
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			// Should contain actual price values from frontmatter
			expect(content).toContain("19.99");
			expect(content).toContain("49.99");
		});
	});

	describe("resolveExportFiles", () => {
		it("should return files for a folder source", async () => {
			const files = await service.resolveExportFiles("items", "folder");
			expect(files).toHaveLength(3);
		});
	});

	describe("scanDisplayNames", () => {
		it("should return display name overrides from base properties", async () => {
			const baseYaml = `properties:
  file.folder:
    displayName: Folder
  description:
    displayName: Beschreibung
views:
  - type: table
    name: Table`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const names = await service.scanDisplayNames("items.base");

			expect(names["file.folder"]).toBe("Folder");
			expect(names["description"]).toBe("Beschreibung");
		});

		it("should return empty map when no properties section", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
				`views:\n  - type: table\n    name: Table`
			);

			const names = await service.scanDisplayNames("items.base");

			expect(Object.keys(names)).toHaveLength(0);
		});
	});

	describe("executeExport with displayNames", () => {
		it("should use displayNames for file property headers", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name", "file.folder"],
				displayNames: { "file.folder": "Folder" },
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			const firstLine = content.split("\n")[0];
			expect(firstLine).toContain("Folder");
			// file.name has no displayName override, falls back to clean label
			expect(firstLine).toContain("name");
		});

		it("should use displayNames for note property headers", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["category", "type"],
				fileProperties: [],
				displayNames: { "note.category": "Kategorie" },
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			const firstLine = content.split("\n")[0];
			expect(firstLine).toContain("Kategorie");
			// type has no displayName, stays as-is
			expect(firstLine).toContain("type");
		});
	});

	describe("parseBaseViews", () => {
		it("should return parsed base file views", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
				`views:\n  - type: table\n    name: View1\n  - type: table\n    name: View2`
			);

			const base = await service.parseBaseViews("test.base");
			expect(base.views).toHaveLength(2);
			expect(base.views[0].name).toBe("View1");
		});
	});

	describe("executeExport (external)", () => {
		it("should use writeExternalFile when isExternal is true", async () => {
			const writeExternal = vi.fn(async () => {});
			service.setWriteExternalFile(writeExternal);

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "C:\\Users\\export\\items.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
				isExternal: true,
			};

			const result = await service.executeExport(config);

			expect(result.totalRows).toBe(3);
			expect(result.outputPath).toBe("C:\\Users\\export\\items.csv");
			expect(writeExternal).toHaveBeenCalledOnce();
			expect(writeExternal).toHaveBeenCalledWith(
				"C:\\Users\\export\\items.csv",
				expect.stringContaining("widget"),
			);
			// fileSystem.createFile should NOT be called
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});

		it("should throw when isExternal but no writeExternalFile callback", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "/tmp/items.csv",
				columns: ["type"],
				fileProperties: [],
				isExternal: true,
			};

			await expect(service.executeExport(config)).rejects.toThrow(
				"External file writing is not available",
			);
		});

		it("should use vault createFile when isExternal is false", async () => {
			const writeExternal = vi.fn(async () => {});
			service.setWriteExternalFile(writeExternal);

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: [],
			};

			await service.executeExport(config);

			expect(fileSystem.createFile).toHaveBeenCalledOnce();
			expect(writeExternal).not.toHaveBeenCalled();
		});
	});

	describe("conflict resolution", () => {
		it("should skip export when file exists and strategy is skip", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
				conflictStrategy: "skip",
			};

			// readFile returns content (file exists)
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue("name,type\nold,data");

			const result = await service.executeExport(config);

			expect(result.skipped).toBe(true);
			expect(result.totalRows).toBe(0);
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});

		it("should skip external export when file exists and strategy is skip", async () => {
			const readExternal = vi.fn(async () => "name,type\nold,data");
			service.setReadExternalFile(readExternal);

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "C:\\external\\items.csv",
				columns: ["type"],
				fileProperties: [],
				isExternal: true,
				conflictStrategy: "skip",
			};

			const result = await service.executeExport(config);

			expect(result.skipped).toBe(true);
			expect(readExternal).toHaveBeenCalledWith("C:\\external\\items.csv");
		});

		it("should overwrite when strategy is overwrite (default)", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
				conflictStrategy: "overwrite",
			};

			const result = await service.executeExport(config);

			expect(result.skipped).toBeUndefined();
			expect(result.totalRows).toBe(3);
			expect(fileSystem.createFile).toHaveBeenCalledOnce();
		});

		it("should append rows to existing file when strategy is append", async () => {
			// First call reads the base YAML (for resolveFiles); second reads existing file
			let readCount = 0;
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
				readCount++;
				// First call is from resolveFiles (base), but we use folder so no readFile
				// readOutputFile call returns existing CSV
				return "name,type\nold-item,OldType";
			});

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
				conflictStrategy: "append",
			};

			const result = await service.executeExport(config);

			expect(result.totalRows).toBe(3);
			// File exists, so updateFile is used instead of createFile
			const content = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			// Should contain old data + new data rows (without duplicate header)
			expect(content).toContain("old-item");
			expect(content).toContain("widget");
			// Header should appear only once
			const headerCount = content.split("\n").filter((l: string) => l.startsWith("name,type") || l.startsWith("name\t")).length;
			expect(headerCount).toBe(1);
		});

		it("should write normally when append but no existing file", async () => {
			// readFile throws (file does not exist)
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Not found"));

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
				conflictStrategy: "append",
			};

			const result = await service.executeExport(config);

			expect(result.totalRows).toBe(3);
			expect(result.skipped).toBeUndefined();
			expect(fileSystem.createFile).toHaveBeenCalledOnce();
		});

		it("should not skip when file does not exist and strategy is skip", async () => {
			// readFile throws (file does not exist)
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Not found"));

			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/nonexistent.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
				conflictStrategy: "skip",
			};

			const result = await service.executeExport(config);

			expect(result.skipped).toBeUndefined();
			expect(result.totalRows).toBe(3);
			expect(fileSystem.createFile).toHaveBeenCalledOnce();
		});
	});

	describe("scanResolvedColumns", () => {
		it("should return ResolvedColumn array for a view with mixed column types", async () => {
			const baseYaml = `formulas:
  Foo Bar: file.name
properties:
  note.baz.foo:
    displayName: Baz Foo
views:
  - type: table
    name: Test View
    order:
      - file.name
      - formula.Foo Bar
      - baz.foo
      - bar.baz`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const result = await service.scanResolvedColumns("test.base", 0);

			expect(result).not.toBeNull();
			expect(result).toHaveLength(4);

			// file.name → file property
			expect(result![0]).toEqual({
				key: "file.name",
				header: "name",
				source: "file",
				resolveKey: "file.name",
			});

			// formula.Foo Bar → formula resolving to file.name
			expect(result![1]).toEqual({
				key: "formula.Foo Bar",
				header: "Foo Bar",
				source: "formula",
				resolveKey: "file.name",
				resolveSource: "file",
			});

			// baz.foo → frontmatter with displayName "Baz Foo"
			expect(result![2]).toEqual({
				key: "baz.foo",
				header: "Baz Foo",
				source: "frontmatter",
				resolveKey: "baz.foo",
			});

			// bar.baz → bare frontmatter, no displayName
			expect(result![3]).toEqual({
				key: "bar.baz",
				header: "bar.baz",
				source: "frontmatter",
				resolveKey: "bar.baz",
			});
		});

		it("should resolve formula with prop() to frontmatter", async () => {
			const baseYaml = `formulas:
  Total: 'prop("price")'
views:
  - type: table
    name: Items
    order:
      - formula.Total`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const result = await service.scanResolvedColumns("test.base", 0);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				key: "formula.Total",
				header: "Total",
				source: "formula",
				resolveKey: "price",
				resolveSource: "frontmatter",
			});
		});

		it("should fall back to formula name for compound formulas", async () => {
			const baseYaml = `formulas:
  Revenue: 'prop("price") * prop("quantity")'
views:
  - type: table
    name: Items
    order:
      - formula.Revenue`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const result = await service.scanResolvedColumns("test.base", 0);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				key: "formula.Revenue",
				header: "Revenue",
				source: "formula",
				resolveKey: "Revenue",
				resolveSource: "frontmatter",
			});
		});

		it("should use displayName from properties section for headers", async () => {
			const baseYaml = `properties:
  note.stage:
    displayName: Phase
  note.category:
    displayName: Kategorie
views:
  - type: table
    name: Items
    order:
      - note.stage
      - note.category
      - domain`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const result = await service.scanResolvedColumns("test.base", 0);

			expect(result).toHaveLength(3);
			expect(result![0].header).toBe("Phase");
			expect(result![1].header).toBe("Kategorie");
			expect(result![2].header).toBe("domain"); // no displayName
		});

		it("should return null when view has no order", async () => {
			const baseYaml = `views:
  - type: table
    name: Items`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const result = await service.scanResolvedColumns("test.base", 0);

			expect(result).toBeNull();
		});

		it("should preserve exact view column order", async () => {
			const baseYaml = `views:
  - type: table
    name: Items
    order:
      - file.path
      - domain
      - note.category
      - file.name`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const result = await service.scanResolvedColumns("test.base", 0);

			expect(result!.map((rc) => rc.key)).toEqual([
				"file.path", "domain", "note.category", "file.name",
			]);
		});

		it("should handle formula with no formulas section", async () => {
			const baseYaml = `views:
  - type: table
    name: Items
    order:
      - formula.Unknown`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(baseYaml);

			const result = await service.scanResolvedColumns("test.base", 0);

			expect(result).toHaveLength(1);
			expect(result![0]).toEqual({
				key: "formula.Unknown",
				header: "Unknown",
				source: "formula",
				resolveKey: "Unknown",
				resolveSource: "frontmatter",
			});
		});
	});

	describe("executeExport with resolvedColumns", () => {
		it("should produce correct headers and values from resolved columns", async () => {
			const baseYaml = `filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Items`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(baseYaml)
				.mockRejectedValue(new Error("Not found"));

			const resolvedColumns: ResolvedColumn[] = [
				{ key: "file.name", header: "name", source: "file", resolveKey: "file.name" },
				{ key: "formula.Foo Bar", header: "Foo Bar", source: "formula", resolveKey: "file.name", resolveSource: "file" },
				{ key: "baz.foo", header: "Baz Foo", source: "frontmatter", resolveKey: "baz.foo" },
				{ key: "bar.baz", header: "bar.baz", source: "frontmatter", resolveKey: "bar.baz" },
			];

			const config: ExportConfig = {
				sourcePath: "items.base",
				sourceType: "base",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: [],
				fileProperties: [],
				baseViewIndex: 0,
				resolvedColumns,
			};

			const result = await service.executeExport(config);

			expect(result.totalRows).toBe(2); // only .md files
			expect(result.totalColumns).toBe(4);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			const firstLine = content.split("\n")[0].replace(/\r$/, "");
			// Headers: CSV-quoted where names contain spaces
			expect(firstLine).toContain("name");
			expect(firstLine).toContain("Foo Bar");
			expect(firstLine).toContain("Baz Foo");
			expect(firstLine).toContain("bar.baz");
			// Foo Bar formula resolves to file.name → should have basename values
			expect(content).toContain("widget");
			expect(content).toContain("gadget");
		});

		it("should resolve formula column targeting frontmatter", async () => {
			const baseYaml = `filters:
  and:
    - file.ext == "md"
views:
  - type: table
    name: Items`;

			(fileSystem.readFile as ReturnType<typeof vi.fn>)
				.mockResolvedValueOnce(baseYaml)
				.mockRejectedValue(new Error("Not found"));

			const resolvedColumns: ResolvedColumn[] = [
				{ key: "file.name", header: "name", source: "file", resolveKey: "file.name" },
				{ key: "formula.Total", header: "Total", source: "formula", resolveKey: "price", resolveSource: "frontmatter" },
			];

			const config: ExportConfig = {
				sourcePath: "items.base",
				sourceType: "base",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: [],
				fileProperties: [],
				baseViewIndex: 0,
				resolvedColumns,
			};

			await service.executeExport(config);

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
			expect(content).toContain("19.99");
			expect(content).toContain("49.99");
			const firstLine = content.split("\n")[0].replace(/\r$/, "");
			expect(firstLine).toContain("name");
			expect(firstLine).toContain("Total");
		});

		it("should fall back to legacy path when resolvedColumns is undefined", async () => {
			const config: ExportConfig = {
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["type"],
				fileProperties: ["file.name"],
			};

			const result = await service.executeExport(config);

			expect(result.totalRows).toBe(3);
			expect(result.totalColumns).toBe(2);
		});
	});

	describe("setListFiles", () => {
		it("should update the listFiles callback", async () => {
			const newFiles: VaultFileInfo[] = [
				{
					path: "other/note.md",
					basename: "note",
					extension: "md",
					folder: "other",
					frontmatter: { key: "value" },
				},
			];

			service.setListFiles(() => newFiles);

			const files = await service.resolveExportFiles("other", "folder");
			expect(files).toHaveLength(1);
			expect(files[0].basename).toBe("note");
		});
	});
});
