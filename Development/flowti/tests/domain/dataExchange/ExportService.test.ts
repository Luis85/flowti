import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { ExportService } from "../../../src/domain/dataExchange/ExportService";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { ExportConfig, VaultFileInfo } from "../../../src/domain/dataExchange/types";

function createMockFileSystem(): IFileSystemClient {
	return {
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

		it("should emit export.started event", async () => {
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
