import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { ImportService } from "../../../src/domain/dataExchange/ImportService";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { ImportConfig } from "../../../src/domain/dataExchange/types";

/**
 * Creates a mock FileSystemClient.
 */
function createMockFileSystem(): IFileSystemClient {
	const files = new Map<string, string>();

	return {
		createFile: vi.fn(async (path: string, content: string) => {
			files.set(path, content);
		}),
		readFile: vi.fn(async (path: string) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		}),
		updateFile: vi.fn(async (path: string, content: string) => {
			files.set(path, content);
		}),
		deleteFile: vi.fn(async () => {}),
		moveFile: vi.fn(async (_p: string, newPath: string) => newPath),
		renameFile: vi.fn(async (_p: string, newName: string) => newName),
		getFrontmatter: vi.fn(async () => ({})),
		updateFrontmatter: vi.fn(async (_p: string, data: Record<string, unknown>) => data),
		setFrontmatter: vi.fn(async () => {}),
		// Store reference for testing
		_files: files,
	} as unknown as IFileSystemClient & { _files: Map<string, string> };
}

describe("ImportService", () => {
	let service: ImportService;
	let eventBus: IEventBus;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		service = new ImportService({ eventBus, fileSystem });
	});

	describe("parseFile", () => {
		it("should parse a CSV file from the vault", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				"name,age\nAlice,30\nBob,25"
			);

			const result = await service.parseFile("data.csv");

			expect(result.headers).toEqual(["name", "age"]);
			expect(result.rowCount).toBe(2);
		});
	});

	describe("sanitizeFilename", () => {
		it("should remove illegal characters", () => {
			expect(service.sanitizeFilename('file:name*test?')).toBe("filenametest");
		});

		it("should trim whitespace", () => {
			expect(service.sanitizeFilename("  hello world  ")).toBe("hello world");
		});

		it("should normalize multiple spaces", () => {
			expect(service.sanitizeFilename("hello   world")).toBe("hello world");
		});

		it("should return empty string for empty input", () => {
			expect(service.sanitizeFilename("")).toBe("");
		});

		it("should remove brackets and hashes", () => {
			expect(service.sanitizeFilename("file#name[1]")).toBe("filename1");
		});
	});

	describe("buildNoteContent", () => {
		it("should build valid YAML frontmatter", () => {
			const content = service.buildNoteContent({ name: "Alice", age: "30" });

			expect(content).toContain("---");
			expect(content).toContain("name: Alice");
			expect(content).toContain("age: 30");
			// Should have opening and closing ---
			const dashes = content.match(/---/g);
			expect(dashes).toHaveLength(2);
		});

		it("should quote values with special YAML characters", () => {
			const content = service.buildNoteContent({ desc: "A: B" });
			expect(content).toContain('desc: "A: B"');
		});

		it("should escape double quotes in values", () => {
			const content = service.buildNoteContent({ name: 'He said "hi"' });
			expect(content).toContain('name: "He said \\"hi\\""');
		});
	});

	describe("executeImport", () => {
		it("should create notes for each CSV row", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
				"name,category\nWidget,Tools\nGadget,Electronics"
			);

			const config: ImportConfig = {
				sourcePath: "data.csv",
				targetFolder: "imported",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
					{ csvColumn: "category", frontmatterKey: "category", included: true },
				],
				conflictStrategy: "skip",
			};

			// First read returns CSV, subsequent reads throw (files don't exist yet)
			let callCount = 0;
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
				callCount++;
				if (callCount === 1) return "name,category\nWidget,Tools\nGadget,Electronics";
				throw new Error("File not found");
			});

			const result = await service.executeImport(config);

			expect(result.totalRows).toBe(2);
			expect(result.created).toBe(2);
			expect(result.failed).toBe(0);
			expect(fileSystem.createFile).toHaveBeenCalledTimes(2);
		});

		it("should skip existing notes with skip strategy", async () => {
			let callCount = 0;
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
				callCount++;
				if (callCount === 1) return "name\nExisting";
				return "---\nname: Existing\n---"; // File exists
			});

			const config: ImportConfig = {
				sourcePath: "data.csv",
				targetFolder: "imported",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
				],
				conflictStrategy: "skip",
			};

			const result = await service.executeImport(config);

			expect(result.skipped).toBe(1);
			expect(result.created).toBe(0);
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});

		it("should update frontmatter with update strategy", async () => {
			let callCount = 0;
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
				callCount++;
				if (callCount === 1) return "name\nExisting";
				return "---\nname: Existing\n---";
			});

			const config: ImportConfig = {
				sourcePath: "data.csv",
				targetFolder: "imported",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
				],
				conflictStrategy: "update",
			};

			const result = await service.executeImport(config);

			expect(result.updated).toBe(1);
			expect(fileSystem.updateFrontmatter).toHaveBeenCalled();
		});

		it("should emit progress events", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
				if (path === "data.csv") return "name\nA\nB";
				throw new Error("Not found");
			});

			const progressHandler = vi.fn();
			eventBus.on("dataExchange.import.progress", progressHandler);

			const config: ImportConfig = {
				sourcePath: "data.csv",
				targetFolder: "imported",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
				],
				conflictStrategy: "skip",
			};

			await service.executeImport(config);

			expect(progressHandler).toHaveBeenCalledTimes(2);
			expect(progressHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ current: 1, total: 2 }),
				})
			);
		});

		it("should handle empty filename gracefully", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
				if (path === "data.csv") return "name,extra\n,something\nBob,other";
				throw new Error("Not found");
			});

			const config: ImportConfig = {
				sourcePath: "data.csv",
				targetFolder: "imported",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
					{ csvColumn: "extra", frontmatterKey: "extra", included: true },
				],
				conflictStrategy: "skip",
			};

			const result = await service.executeImport(config);

			// Empty name row should be counted as failed
			expect(result.failed).toBe(1);
			expect(result.created).toBe(1);
		});

		it("should throw when name column does not exist", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue("a,b\n1,2");

			const config: ImportConfig = {
				sourcePath: "data.csv",
				targetFolder: "imported",
				nameColumn: "nonexistent",
				columnMappings: [],
				conflictStrategy: "skip",
			};

			await expect(service.executeImport(config)).rejects.toThrow(
				'Name column "nonexistent" not found'
			);
		});

		it("should exclude non-included columns from frontmatter", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
				if (path === "data.csv") return "name,secret,visible\nAlice,hidden,shown";
				throw new Error("Not found");
			});

			const config: ImportConfig = {
				sourcePath: "data.csv",
				targetFolder: "imported",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
					{ csvColumn: "secret", frontmatterKey: "secret", included: false },
					{ csvColumn: "visible", frontmatterKey: "visible", included: true },
				],
				conflictStrategy: "skip",
			};

			await service.executeImport(config);

			const createCall = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			const content = createCall[1] as string;
			expect(content).toContain("visible: shown");
			expect(content).not.toContain("secret");
		});
	});
});
