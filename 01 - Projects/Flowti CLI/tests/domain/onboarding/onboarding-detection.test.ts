import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import type { IPaths, IFileSystem, DirEntry } from "../../../src/infrastructure/types.js";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { shouldOnboard, markOnboardingComplete, resetOnboarding } from "../../../src/domain/onboarding/onboarding-detection.js";

const mockDisk = {
	readFileSync: vi.fn() as IFileSystem["readFileSync"],
	writeFileSync: vi.fn() as IFileSystem["writeFileSync"],
	existsSync: vi.fn(() => false) as unknown as IFileSystem["existsSync"],
	mkdirSync: vi.fn() as IFileSystem["mkdirSync"],
	readdirSync: vi.fn(() => []) as unknown as IFileSystem["readdirSync"],
	copyFileSync: vi.fn() as IFileSystem["copyFileSync"],
	rmSync: vi.fn() as IFileSystem["rmSync"],
	unlinkSync: vi.fn() as IFileSystem["unlinkSync"],
	statSync: vi.fn() as IFileSystem["statSync"],
} satisfies IFileSystem;

const mockPaths: IPaths = {
	join: (...args: string[]) => args.join("/"),
	resolve: (...args: string[]) => path.resolve(...args).replace(/\\/g, "/"),
	dirname: (p: string) => path.dirname(p).replace(/\\/g, "/"),
	basename: (p: string, ext?: string) => path.basename(p, ext),
	relative: (from: string, to: string) => path.relative(from, to),
	extname: (p: string) => path.extname(p),
	isAbsolute: (p: string) => path.isAbsolute(p),
	sep: "/",
};

const deps = { disk: mockDisk, paths: mockPaths };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("shouldOnboard", () => {
	it("returns true when no projects and no flag file", () => {
		(mockDisk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(mockDisk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(true);
	});

	it("returns false when flag file exists", () => {
		(mockDisk.existsSync as ReturnType<typeof vi.fn>).mockImplementation((p: string) =>
			p.includes("onboarding-complete"),
		);
		(mockDisk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(false);
	});

	it("returns false when projects exist", () => {
		(mockDisk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(mockDisk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
			{ name: "my-project", isDirectory: () => true, isFile: () => false } satisfies DirEntry,
		]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(false);
	});

	it("returns false when both flag and projects exist", () => {
		(mockDisk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		(mockDisk.readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
			{ name: "my-project", isDirectory: () => true, isFile: () => false } satisfies DirEntry,
		]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(false);
	});

	it("returns true when projects directory does not exist", () => {
		(mockDisk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
		(mockDisk.readdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
			throw new Error("ENOENT");
		});
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(true);
	});
});

describe("markOnboardingComplete", () => {
	it("writes the flag file", () => {
		markOnboardingComplete("/vault", deps);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/vault/.flowti/onboarding-complete",
			expect.any(String),
			"utf-8",
		);
	});

	it("creates .flowti directory if needed", () => {
		markOnboardingComplete("/vault", deps);
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith(
			"/vault/.flowti",
			{ recursive: true },
		);
	});
});

describe("resetOnboarding", () => {
	it("removes the flag file if it exists", () => {
		(mockDisk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(true);
		resetOnboarding("/vault", deps);
		expect(mockDisk.unlinkSync).toHaveBeenCalledWith(
			"/vault/.flowti/onboarding-complete",
		);
	});

	it("does nothing if flag file does not exist", () => {
		(mockDisk.existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
		resetOnboarding("/vault", deps);
		expect(mockDisk.unlinkSync).not.toHaveBeenCalled();
	});
});
