import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:fs", () => ({
	default: {
		readFileSync: vi.fn(),
		writeFileSync: vi.fn(),
		existsSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(),
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
		unlinkSync: vi.fn(),
		statSync: vi.fn(),
	},
}));

import fsNode from "node:fs";
import { disk } from "../../src/infrastructure/filesystem.js";

const mocked = vi.mocked(fsNode);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("disk.readFileSync", () => {
	it("delegates to fs.readFileSync", () => {
		mocked.readFileSync.mockReturnValue("file content" as unknown as Buffer);
		const result = disk.readFileSync("/path/to/file.txt", "utf-8");
		expect(result).toBe("file content");
		expect(mocked.readFileSync).toHaveBeenCalledWith("/path/to/file.txt", "utf-8");
	});
});

describe("disk.writeFileSync", () => {
	it("delegates to fs.writeFileSync", () => {
		disk.writeFileSync("/path/to/file.txt", "content", "utf-8");
		expect(mocked.writeFileSync).toHaveBeenCalledWith("/path/to/file.txt", "content", "utf-8");
	});
});

describe("disk.existsSync", () => {
	it("returns true when file exists", () => {
		mocked.existsSync.mockReturnValue(true);
		expect(disk.existsSync("/path/to/file.txt")).toBe(true);
		expect(mocked.existsSync).toHaveBeenCalledWith("/path/to/file.txt");
	});

	it("returns false when file does not exist", () => {
		mocked.existsSync.mockReturnValue(false);
		expect(disk.existsSync("/nonexistent")).toBe(false);
	});
});

describe("disk.mkdirSync", () => {
	it("delegates to fs.mkdirSync without options", () => {
		disk.mkdirSync("/new/dir");
		expect(mocked.mkdirSync).toHaveBeenCalledWith("/new/dir", undefined);
	});

	it("passes options through to fs.mkdirSync", () => {
		disk.mkdirSync("/new/dir", { recursive: true });
		expect(mocked.mkdirSync).toHaveBeenCalledWith("/new/dir", { recursive: true });
	});
});

describe("disk.readdirSync", () => {
	it("returns string array without options", () => {
		mocked.readdirSync.mockReturnValue(["a.ts", "b.ts"] as unknown as ReturnType<typeof fsNode.readdirSync>);
		const result = disk.readdirSync("/src");
		expect(result).toEqual(["a.ts", "b.ts"]);
		expect(mocked.readdirSync).toHaveBeenCalledWith("/src");
	});

	it("returns DirEntry array with withFileTypes option", () => {
		const entries = [
			{ name: "file.ts", isDirectory: () => false, isFile: () => true },
			{ name: "subdir", isDirectory: () => true, isFile: () => false },
		];
		mocked.readdirSync.mockReturnValue(entries as unknown as ReturnType<typeof fsNode.readdirSync>);
		const result = disk.readdirSync("/src", { withFileTypes: true });
		expect(result).toEqual(entries);
		expect(mocked.readdirSync).toHaveBeenCalledWith("/src", { withFileTypes: true });
	});
});

describe("disk.copyFileSync", () => {
	it("delegates to fs.copyFileSync", () => {
		disk.copyFileSync("/src/file.txt", "/dest/file.txt");
		expect(mocked.copyFileSync).toHaveBeenCalledWith("/src/file.txt", "/dest/file.txt");
	});
});

describe("disk.rmSync", () => {
	it("delegates to fs.rmSync without options", () => {
		disk.rmSync("/path/to/file.txt");
		expect(mocked.rmSync).toHaveBeenCalledWith("/path/to/file.txt", undefined);
	});

	it("passes options through to fs.rmSync", () => {
		disk.rmSync("/path/to/dir", { recursive: true, force: true });
		expect(mocked.rmSync).toHaveBeenCalledWith("/path/to/dir", { recursive: true, force: true });
	});
});

describe("disk.unlinkSync", () => {
	it("delegates to fs.unlinkSync", () => {
		disk.unlinkSync("/path/to/file.txt");
		expect(mocked.unlinkSync).toHaveBeenCalledWith("/path/to/file.txt");
	});
});

describe("disk.statSync", () => {
	it("delegates to fs.statSync and returns Stats", () => {
		const fakeStats = { size: 1024, isFile: () => true, isDirectory: () => false };
		mocked.statSync.mockReturnValue(fakeStats as unknown as ReturnType<typeof fsNode.statSync>);
		const result = disk.statSync("/path/to/file.txt");
		expect(result).toBe(fakeStats);
		expect(mocked.statSync).toHaveBeenCalledWith("/path/to/file.txt");
	});
});
