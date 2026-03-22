import { describe, it, expect, vi } from "vitest";
import { getNextTestFileNumber } from "../../../src/domain/make/makers.js";
import type { CliDeps } from "../../../src/infrastructure/deps.js";

function makeDeps(overrides: {
	existsSync?: (p: string) => boolean;
	readdirSync?: (p: string) => string[];
} = {}): Pick<CliDeps, "disk"> {
	return {
		disk: {
			existsSync: overrides.existsSync ?? (() => true),
			readdirSync: (overrides.readdirSync ?? (() => [])) as CliDeps["disk"]["readdirSync"],
			readFileSync: vi.fn() as unknown as CliDeps["disk"]["readFileSync"],
			writeFileSync: vi.fn(),
			mkdirSync: vi.fn(),
			copyFileSync: vi.fn(),
			rmSync: vi.fn(),
			unlinkSync: vi.fn(),
			statSync: vi.fn() as unknown as CliDeps["disk"]["statSync"],
			renameSync: vi.fn(),
		},
	};
}

describe("getNextTestFileNumber", () => {
	it("returns '10' when directory does not exist", () => {
		const deps = makeDeps({ existsSync: () => false });
		expect(getNextTestFileNumber("/tests", deps)).toBe("10");
	});

	it("returns '10' when directory is empty", () => {
		const deps = makeDeps({ existsSync: () => true, readdirSync: () => [] });
		expect(getNextTestFileNumber("/tests", deps)).toBe("10");
	});

	it("returns '10' when no files match the journey pattern", () => {
		const deps = makeDeps({
			existsSync: () => true,
			readdirSync: () => ["README.md", "helpers.ts", "some-other-file.ts"],
		});
		expect(getNextTestFileNumber("/tests", deps)).toBe("10");
	});

	it("returns next number after max for a single journey file", () => {
		const deps = makeDeps({
			existsSync: () => true,
			readdirSync: () => ["10-journey-getting-started.test.ts"],
		});
		expect(getNextTestFileNumber("/tests", deps)).toBe("20");
	});

	it("returns next number after highest numbered journey file", () => {
		const deps = makeDeps({
			existsSync: () => true,
			readdirSync: () => [
				"10-journey-getting-started.test.ts",
				"20-journey-component-library.test.ts",
				"30-journey-publish.test.ts",
			],
		});
		expect(getNextTestFileNumber("/tests", deps)).toBe("40");
	});

	it("handles gaps in numbering and picks max + 10", () => {
		const deps = makeDeps({
			existsSync: () => true,
			readdirSync: () => ["10-journey-first.test.ts", "50-journey-last.test.ts"],
		});
		expect(getNextTestFileNumber("/tests", deps)).toBe("60");
	});

	it("ignores non-journey files and only considers journey pattern", () => {
		const deps = makeDeps({
			existsSync: () => true,
			readdirSync: () => ["99-some-other.test.ts", "10-journey-first.test.ts", "helpers.ts"],
		});
		expect(getNextTestFileNumber("/tests", deps)).toBe("20");
	});

	it("handles unsorted files correctly", () => {
		const deps = makeDeps({
			existsSync: () => true,
			readdirSync: () => [
				"30-journey-third.test.ts",
				"10-journey-first.test.ts",
				"20-journey-second.test.ts",
			],
		});
		expect(getNextTestFileNumber("/tests", deps)).toBe("40");
	});

	it("passes testDir to existsSync and readdirSync", () => {
		const existsSync = vi.fn(() => true);
		const readdirSync = vi.fn(() => []);
		const deps = makeDeps({ existsSync, readdirSync });

		getNextTestFileNumber("/my/test/dir", deps);

		expect(existsSync).toHaveBeenCalledWith("/my/test/dir");
		expect(readdirSync).toHaveBeenCalledWith("/my/test/dir");
	});

	it("does not call readdirSync when directory does not exist", () => {
		const readdirSync = vi.fn(() => []);
		const deps = makeDeps({ existsSync: () => false, readdirSync });

		getNextTestFileNumber("/tests", deps);

		expect(readdirSync).not.toHaveBeenCalled();
	});
});
