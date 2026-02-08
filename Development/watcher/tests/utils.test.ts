import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as fsp from "fs/promises";
import {
	isSymlinkSync,
	checkSymlink,
	checkDirectoryForSymlinks,
	matchesExcludePattern,
	isAllowedByExtensions,
	isPathExcluded,
	isTempFile,
	toVaultPath,
	walkExternalFiles,
	validateSourcePath,
	validateTargetPath,
} from "../src/utils";
import { PathTraversalError } from "../src/services/retry";

// Mock fs module for symlink tests
vi.mock("fs", async () => {
	const actual = await vi.importActual<typeof fs>("fs");
	return {
		...actual,
		lstatSync: vi.fn(),
	};
});

vi.mock("fs/promises", async () => {
	const actual = await vi.importActual<typeof fsp>("fs/promises");
	return {
		...actual,
		lstat: vi.fn(),
		readlink: vi.fn(),
		readdir: vi.fn(),
	};
});

describe("Symlink Detection", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("isSymlinkSync", () => {
		it("should return true for symlinks", () => {
			const mockLstatSync = vi.mocked(fs.lstatSync);
			mockLstatSync.mockReturnValue({
				isSymbolicLink: () => true,
			} as fs.Stats);

			expect(isSymlinkSync("/path/to/symlink")).toBe(true);
			expect(mockLstatSync).toHaveBeenCalledWith("/path/to/symlink");
		});

		it("should return false for regular files", () => {
			const mockLstatSync = vi.mocked(fs.lstatSync);
			mockLstatSync.mockReturnValue({
				isSymbolicLink: () => false,
			} as fs.Stats);

			expect(isSymlinkSync("/path/to/file.txt")).toBe(false);
		});

		it("should return false for directories", () => {
			const mockLstatSync = vi.mocked(fs.lstatSync);
			mockLstatSync.mockReturnValue({
				isSymbolicLink: () => false,
			} as fs.Stats);

			expect(isSymlinkSync("/path/to/dir")).toBe(false);
		});

		it("should return false when path does not exist", () => {
			const mockLstatSync = vi.mocked(fs.lstatSync);
			mockLstatSync.mockImplementation(() => {
				throw new Error("ENOENT: no such file or directory");
			});

			expect(isSymlinkSync("/nonexistent/path")).toBe(false);
		});

		it("should return false on permission error", () => {
			const mockLstatSync = vi.mocked(fs.lstatSync);
			mockLstatSync.mockImplementation(() => {
				throw new Error("EACCES: permission denied");
			});

			expect(isSymlinkSync("/restricted/path")).toBe(false);
		});
	});

	describe("checkSymlink", () => {
		it("should return isSymlink=true with target for symlinks", async () => {
			const mockLstat = vi.mocked(fsp.lstat);
			const mockReadlink = vi.mocked(fsp.readlink);

			mockLstat.mockResolvedValue({
				isSymbolicLink: () => true,
			} as fs.Stats);
			mockReadlink.mockResolvedValue("/target/path");

			const result = await checkSymlink("/path/to/symlink");

			expect(result.isSymlink).toBe(true);
			expect(result.target).toBe("/target/path");
			expect(result.error).toBeUndefined();
		});

		it("should return isSymlink=true without target if readlink fails", async () => {
			const mockLstat = vi.mocked(fsp.lstat);
			const mockReadlink = vi.mocked(fsp.readlink);

			mockLstat.mockResolvedValue({
				isSymbolicLink: () => true,
			} as fs.Stats);
			mockReadlink.mockRejectedValue(new Error("readlink failed"));

			const result = await checkSymlink("/path/to/symlink");

			expect(result.isSymlink).toBe(true);
			expect(result.target).toBeUndefined();
		});

		it("should return isSymlink=false for regular files", async () => {
			const mockLstat = vi.mocked(fsp.lstat);

			mockLstat.mockResolvedValue({
				isSymbolicLink: () => false,
			} as fs.Stats);

			const result = await checkSymlink("/path/to/file.txt");

			expect(result.isSymlink).toBe(false);
			expect(result.target).toBeUndefined();
		});

		it("should return isSymlink=false with error for nonexistent paths", async () => {
			const mockLstat = vi.mocked(fsp.lstat);

			mockLstat.mockRejectedValue(new Error("ENOENT: no such file or directory"));

			const result = await checkSymlink("/nonexistent/path");

			expect(result.isSymlink).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe("checkDirectoryForSymlinks", () => {
		it("should detect symlinks in directory", async () => {
			const mockReaddir = vi.mocked(fsp.readdir);

			mockReaddir.mockResolvedValue([
				{ name: "regular.txt", isSymbolicLink: () => false },
				{ name: "link1", isSymbolicLink: () => true },
				{ name: "subdir", isSymbolicLink: () => false },
				{ name: "link2", isSymbolicLink: () => true },
			] as any);

			const result = await checkDirectoryForSymlinks("/some/dir");

			expect(result.hasSymlinks).toBe(true);
			expect(result.symlinks).toEqual(["link1", "link2"]);
		});

		it("should return empty list when no symlinks", async () => {
			const mockReaddir = vi.mocked(fsp.readdir);

			mockReaddir.mockResolvedValue([
				{ name: "file1.txt", isSymbolicLink: () => false },
				{ name: "file2.txt", isSymbolicLink: () => false },
			] as any);

			const result = await checkDirectoryForSymlinks("/some/dir");

			expect(result.hasSymlinks).toBe(false);
			expect(result.symlinks).toEqual([]);
		});

		it("should handle directory read errors", async () => {
			const mockReaddir = vi.mocked(fsp.readdir);

			mockReaddir.mockRejectedValue(new Error("EACCES: permission denied"));

			const result = await checkDirectoryForSymlinks("/restricted/dir");

			expect(result.hasSymlinks).toBe(false);
			expect(result.symlinks).toEqual([]);
		});
	});
});

describe("matchesExcludePattern", () => {
	it("should match simple file names", () => {
		expect(matchesExcludePattern("node_modules", ["node_modules"])).toBe(true);
		expect(matchesExcludePattern("src/node_modules", ["node_modules"])).toBe(true);
		expect(matchesExcludePattern("path/to/node_modules/file.js", ["node_modules"])).toBe(true);
	});

	it("should match glob patterns with *", () => {
		expect(matchesExcludePattern("test.log", ["*.log"])).toBe(true);
		expect(matchesExcludePattern("path/to/error.log", ["*.log"])).toBe(true);
		expect(matchesExcludePattern("test.txt", ["*.log"])).toBe(false);
	});

	it("should match glob patterns with **", () => {
		expect(matchesExcludePattern("build/output/file.js", ["build/**"])).toBe(true);
		expect(matchesExcludePattern("build/deep/nested/file.js", ["build/**"])).toBe(true);
	});

	it("should match glob patterns with ?", () => {
		expect(matchesExcludePattern("file1.txt", ["file?.txt"])).toBe(true);
		expect(matchesExcludePattern("file12.txt", ["file?.txt"])).toBe(false);
	});

	it("should return false for empty patterns", () => {
		expect(matchesExcludePattern("anything.txt", [])).toBe(false);
		expect(matchesExcludePattern("file.log", ["", "  "])).toBe(false);
	});

	it("should handle path with backslashes", () => {
		expect(matchesExcludePattern("path\\to\\node_modules", ["node_modules"])).toBe(true);
	});
});

describe("isTempFile", () => {
	it("should detect Office lock files", () => {
		expect(isTempFile("~$document.docx")).toBe(true);
		expect(isTempFile("~$spreadsheet.xlsx")).toBe(true);
	});

	it("should detect generic temp files", () => {
		expect(isTempFile("~tempfile")).toBe(true);
		expect(isTempFile("file.tmp")).toBe(true);
		expect(isTempFile("file.temp")).toBe(true);
	});

	it("should detect vim swap files", () => {
		expect(isTempFile("file.swp")).toBe(true);
	});

	it("should detect partial download files", () => {
		expect(isTempFile("file.partial")).toBe(true);
		expect(isTempFile("file.crdownload")).toBe(true);
	});

	it("should detect system files", () => {
		expect(isTempFile("thumbs.db")).toBe(true);
		expect(isTempFile(".DS_Store")).toBe(true);
		expect(isTempFile("desktop.ini")).toBe(true);
	});

	it("should not flag regular files", () => {
		expect(isTempFile("document.docx")).toBe(false);
		expect(isTempFile("readme.md")).toBe(false);
		expect(isTempFile("~file.txt")).toBe(false); // has extension
	});

	it("should handle full paths", () => {
		expect(isTempFile("C:/path/to/~$document.docx")).toBe(true);
		expect(isTempFile("/home/user/file.tmp")).toBe(true);
	});
});

describe("toVaultPath", () => {
	it("should convert backslashes to forward slashes", () => {
		expect(toVaultPath("path\\to\\file.md")).toBe("path/to/file.md");
		expect(toVaultPath("C:\\Users\\name\\file.md")).toBe("C:/Users/name/file.md");
	});

	it("should preserve forward slashes", () => {
		expect(toVaultPath("path/to/file.md")).toBe("path/to/file.md");
	});

	it("should handle mixed separators", () => {
		expect(toVaultPath("path\\to/mixed/separators")).toBe("path/to/mixed/separators");
	});
});

describe("isAllowedByExtensions", () => {
	it("should allow all files when extension list is empty", () => {
		expect(isAllowedByExtensions("file.md", [])).toBe(true);
		expect(isAllowedByExtensions("file.txt", [])).toBe(true);
		expect(isAllowedByExtensions("file", [])).toBe(true);
	});

	it("should allow files with matching extensions", () => {
		expect(isAllowedByExtensions("notes.md", [".md", ".txt"])).toBe(true);
		expect(isAllowedByExtensions("readme.txt", [".md", ".txt"])).toBe(true);
	});

	it("should reject files with non-matching extensions", () => {
		expect(isAllowedByExtensions("image.png", [".md", ".txt"])).toBe(false);
		expect(isAllowedByExtensions("data.json", [".md"])).toBe(false);
	});

	it("should reject extensionless files when filter is active", () => {
		expect(isAllowedByExtensions("Makefile", [".md", ".txt"])).toBe(false);
		expect(isAllowedByExtensions("LICENSE", [".md"])).toBe(false);
	});

	it("should match case-insensitively", () => {
		expect(isAllowedByExtensions("FILE.MD", [".md"])).toBe(true);
		expect(isAllowedByExtensions("file.TXT", [".txt"])).toBe(true);
	});

	it("should handle full paths", () => {
		expect(isAllowedByExtensions("/path/to/file.md", [".md"])).toBe(true);
		expect(isAllowedByExtensions("C:\\Users\\file.txt", [".txt"])).toBe(true);
	});
});

describe("isPathExcluded", () => {
	it("should return false when patterns is empty", () => {
		expect(isPathExcluded("any/path.md", [])).toBe(false);
	});

	it("should delegate to matchesExcludePattern", () => {
		expect(isPathExcluded("node_modules/pkg/index.js", ["node_modules"])).toBe(true);
		expect(isPathExcluded("src/main.ts", ["node_modules"])).toBe(false);
	});

	it("should support glob patterns", () => {
		expect(isPathExcluded("debug.log", ["*.log"])).toBe(true);
		expect(isPathExcluded("build/out/file.js", ["build/**"])).toBe(true);
	});
});

describe("walkExternalFiles", () => {
	const mockReaddir = vi.mocked(fsp.readdir);

	it("should return files in root directory", async () => {
		mockReaddir.mockResolvedValueOnce([
			{ name: "file1.md", isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
			{ name: "file2.txt", isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
		] as any);

		const result = await walkExternalFiles("/root", false);
		expect(result).toHaveLength(2);
	});

	it("should recurse into subdirectories when includeSubfolders is true", async () => {
		mockReaddir
			.mockResolvedValueOnce([
				{ name: "sub", isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false },
			] as any)
			.mockResolvedValueOnce([
				{ name: "nested.md", isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
			] as any);

		const result = await walkExternalFiles("/root", true);
		expect(result).toHaveLength(1);
		expect(result[0]).toContain("nested.md");
	});

	it("should skip dotfiles and dotdirs", async () => {
		mockReaddir.mockResolvedValueOnce([
			{ name: ".hidden", isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
			{ name: ".git", isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false },
			{ name: "visible.md", isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
		] as any);

		const result = await walkExternalFiles("/root", true);
		expect(result).toHaveLength(1);
		expect(result[0]).toContain("visible.md");
	});

	it("should handle readdir errors gracefully", async () => {
		mockReaddir.mockRejectedValueOnce(new Error("EACCES"));

		const result = await walkExternalFiles("/root", false);
		expect(result).toEqual([]);
	});

	it("should not recurse when includeSubfolders is false", async () => {
		vi.clearAllMocks();
		mockReaddir.mockResolvedValueOnce([
			{ name: "sub", isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false },
			{ name: "file.md", isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false },
		] as any);

		const result = await walkExternalFiles("/root", false);
		expect(result).toHaveLength(1);
		// readdir should only be called once (root only, no recursion)
		expect(mockReaddir).toHaveBeenCalledTimes(1);
	});
});

describe("validateSourcePath", () => {
	it("accepts valid paths within source folder", () => {
		expect(() => validateSourcePath("/source/file.md", "/source")).not.toThrow();
		expect(() => validateSourcePath("/source/sub/file.md", "/source")).not.toThrow();
	});

	it("throws PathTraversalError for paths escaping source folder", () => {
		expect(() => validateSourcePath("/source/../etc/passwd", "/source")).toThrow(PathTraversalError);
		expect(() => validateSourcePath("/other/file.md", "/source")).toThrow(PathTraversalError);
	});
});

describe("validateTargetPath", () => {
	it("accepts valid paths within target folder", () => {
		expect(() => validateTargetPath("vault/target/file.md", "vault/target")).not.toThrow();
		expect(() => validateTargetPath("vault/target/sub/file.md", "vault/target")).not.toThrow();
	});

	it("throws PathTraversalError for paths escaping target folder", () => {
		expect(() => validateTargetPath("vault/other/file.md", "vault/target")).toThrow(PathTraversalError);
	});
});
