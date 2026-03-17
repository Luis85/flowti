import { describe, it, expect, vi } from "vitest";
import type {
	IVaultQueryService,
	VaultFileEntry,
	VaultChildEntry,
} from "../../../src/infrastructure/services/VaultQueryService";

/**
 * Creates a mock VaultQueryService backed by simple data structures.
 */
function createMockVaultQuery(
	files: Record<string, { frontmatter?: Record<string, unknown> }> = {},
	folders: Record<string, string[]> = {},
): IVaultQueryService {
	return {
		fileExists: vi.fn((path: string) => path in files || path in folders),
		getFile: vi.fn((path: string): VaultFileEntry | null => {
			if (!(path in files)) return null;
			const parts = path.split("/");
			const name = parts[parts.length - 1];
			const dotIdx = name.lastIndexOf(".");
			return {
				path,
				name,
				basename: dotIdx > 0 ? name.slice(0, dotIdx) : name,
				extension: dotIdx > 0 ? name.slice(dotIdx + 1) : "",
			};
		}),
		isFolder: vi.fn((path: string) => path in folders),
		isFile: vi.fn((path: string) => path in files),
		getFrontmatter: vi.fn((path: string) => files[path]?.frontmatter),
		getChildren: vi.fn((folderPath: string): VaultChildEntry[] => {
			const children = folders[folderPath] ?? [];
			return children.map((name) => {
				const childPath = folderPath ? `${folderPath}/${name}` : name;
				const isChildFolder = childPath in folders;
				const dotIdx = name.lastIndexOf(".");
				return {
					path: childPath,
					name,
					isFolder: isChildFolder,
					extension: !isChildFolder && dotIdx > 0 ? name.slice(dotIdx + 1) : undefined,
				};
			});
		}),
		listMarkdownFiles: vi.fn((folderPath: string): VaultFileEntry[] => {
			const children = folders[folderPath] ?? [];
			return children
				.filter((name) => name.endsWith(".md"))
				.map((name) => {
					const path = folderPath ? `${folderPath}/${name}` : name;
					return {
						path,
						name,
						basename: name.slice(0, -3),
						extension: "md",
					};
				});
		}),
		readFile: vi.fn(async () => ""),
	};
}

describe("IVaultQueryService (mock implementation)", () => {
	const files = {
		"notes/hello.md": { frontmatter: { title: "Hello" } },
		"notes/world.md": { frontmatter: { title: "World" } },
		"data/config.json": {},
	};
	const folders = {
		"notes": ["hello.md", "world.md"],
		"data": ["config.json"],
	};

	it("fileExists returns true for known files", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.fileExists("notes/hello.md")).toBe(true);
	});

	it("fileExists returns true for known folders", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.fileExists("notes")).toBe(true);
	});

	it("fileExists returns false for unknown paths", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.fileExists("unknown/path")).toBe(false);
	});

	it("getFile returns file info for known files", () => {
		const vq = createMockVaultQuery(files, folders);
		const file = vq.getFile("notes/hello.md");
		expect(file).toEqual({
			path: "notes/hello.md",
			name: "hello.md",
			basename: "hello",
			extension: "md",
		});
	});

	it("getFile returns null for unknown paths", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.getFile("unknown")).toBeNull();
	});

	it("isFolder identifies folders", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.isFolder("notes")).toBe(true);
		expect(vq.isFolder("notes/hello.md")).toBe(false);
	});

	it("isFile identifies files", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.isFile("notes/hello.md")).toBe(true);
		expect(vq.isFile("notes")).toBe(false);
	});

	it("getFrontmatter returns cached frontmatter", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.getFrontmatter("notes/hello.md")).toEqual({ title: "Hello" });
	});

	it("getFrontmatter returns undefined for files without frontmatter", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.getFrontmatter("data/config.json")).toBeUndefined();
	});

	it("getChildren lists folder contents", () => {
		const vq = createMockVaultQuery(files, folders);
		const children = vq.getChildren("notes");
		expect(children).toHaveLength(2);
		expect(children[0].name).toBe("hello.md");
		expect(children[0].isFolder).toBe(false);
		expect(children[0].extension).toBe("md");
	});

	it("getChildren returns empty for non-folders", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.getChildren("unknown")).toEqual([]);
	});

	it("listMarkdownFiles filters to .md files", () => {
		const vq = createMockVaultQuery(files, folders);
		expect(vq.listMarkdownFiles("notes")).toHaveLength(2);
		expect(vq.listMarkdownFiles("data")).toHaveLength(0);
	});
});
