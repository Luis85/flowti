import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => true),
		readdirSync: vi.fn(() => []),
	},
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { getNextTestFileNumber } from "../../../src/domain/make/makers.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("getNextTestFileNumber", () => {
	it("returns '10' when directory does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		expect(getNextTestFileNumber("/tests")).toBe("10");
	});

	it("returns '10' when directory is empty", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([]);

		expect(getNextTestFileNumber("/tests")).toBe("10");
	});

	it("returns '10' when no files match the journey pattern", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([
			"README.md",
			"helpers.ts",
			"some-other-file.ts",
		] as unknown as string[]);

		expect(getNextTestFileNumber("/tests")).toBe("10");
	});

	it("returns next number after max for a single journey file", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([
			"10-journey-getting-started.test.ts",
		] as unknown as string[]);

		expect(getNextTestFileNumber("/tests")).toBe("20");
	});

	it("returns next number after highest numbered journey file", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([
			"10-journey-getting-started.test.ts",
			"20-journey-component-library.test.ts",
			"30-journey-publish.test.ts",
		] as unknown as string[]);

		expect(getNextTestFileNumber("/tests")).toBe("40");
	});

	it("handles gaps in numbering and picks max + 10", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([
			"10-journey-first.test.ts",
			"50-journey-last.test.ts",
		] as unknown as string[]);

		expect(getNextTestFileNumber("/tests")).toBe("60");
	});

	it("ignores non-journey files and only considers journey pattern", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([
			"99-some-other.test.ts",
			"10-journey-first.test.ts",
			"helpers.ts",
		] as unknown as string[]);

		expect(getNextTestFileNumber("/tests")).toBe("20");
	});

	it("handles unsorted files correctly", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([
			"30-journey-third.test.ts",
			"10-journey-first.test.ts",
			"20-journey-second.test.ts",
		] as unknown as string[]);

		expect(getNextTestFileNumber("/tests")).toBe("40");
	});

	it("passes testDir to existsSync and readdirSync", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([]);

		getNextTestFileNumber("/my/test/dir");

		expect(disk.existsSync).toHaveBeenCalledWith("/my/test/dir");
		expect(disk.readdirSync).toHaveBeenCalledWith("/my/test/dir");
	});

	it("does not call readdirSync when directory does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);

		getNextTestFileNumber("/tests");

		expect(disk.readdirSync).not.toHaveBeenCalled();
	});
});
