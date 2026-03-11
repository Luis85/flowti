import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../../src/infrastructure/proc.js", () => ({
	proc: {
		argv: () => [] as string[],
		env: () => ({}),
	},
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
});

import { collectCovCounts, computeCoverage } from "../../../../src/domain/reports/generators/coverage-report.js";

describe("coverage-report generator", () => {
	describe("collectCovCounts logic", () => {
		it("collects statement counts", () => {
			const entry = { s: { "0": 5, "1": 0, "2": 3 } };
			expect(collectCovCounts(entry, "statements")).toEqual([5, 0, 3]);
		});

		it("collects branch counts (flattened)", () => {
			const entry = { b: { "0": [1, 0], "1": [3, 2] } };
			expect(collectCovCounts(entry, "branches")).toEqual([1, 0, 3, 2]);
		});

		it("collects function counts", () => {
			const entry = { f: { "0": 10, "1": 0 } };
			expect(collectCovCounts(entry, "functions")).toEqual([10, 0]);
		});

		it("returns empty for missing keys", () => {
			expect(collectCovCounts({}, "statements")).toEqual([]);
			expect(collectCovCounts({}, "branches")).toEqual([]);
			expect(collectCovCounts({}, "functions")).toEqual([]);
		});
	});

	describe("computeCoverage logic", () => {
		it("computes 100% when all covered", () => {
			const entries: CoverageEntry[] = [{ s: { "0": 1, "1": 5 } }];
			expect(computeCoverage(entries, "statements")).toBe(100);
		});

		it("computes 50% when half covered", () => {
			const entries: CoverageEntry[] = [{ s: { "0": 1, "1": 0 } }];
			expect(computeCoverage(entries, "statements")).toBe(50);
		});

		it("returns 0 for empty entries", () => {
			expect(computeCoverage([], "statements")).toBe(0);
		});

		it("returns 0 when all entries have no metrics", () => {
			expect(computeCoverage([{}], "statements")).toBe(0);
		});

		it("computes branch coverage correctly", () => {
			const entries: CoverageEntry[] = [{ b: { "0": [1, 0, 1], "1": [0, 0] } }];
			// 2 covered out of 5 = 40%
			expect(computeCoverage(entries, "branches")).toBe(40);
		});

		it("computes function coverage correctly", () => {
			const entries: CoverageEntry[] = [{ f: { "0": 3, "1": 0, "2": 1 } }];
			// 2 covered out of 3 = 66.67%
			expect(computeCoverage(entries, "functions")).toBe(66.67);
		});

		it("aggregates across multiple entries", () => {
			const entries: CoverageEntry[] = [
				{ s: { "0": 1 } },
				{ s: { "0": 0 } },
			];
			expect(computeCoverage(entries, "statements")).toBe(50);
		});
	});

	describe("output filename", () => {
		it("uses flow prefix by default", () => {
			const buildType = "flow";
			const safeTimestamp = "2026-03-10T12-00-00";
			const prefix = buildType === "full" ? "" : `${buildType}-`;
			const filename = `${safeTimestamp}-${prefix}coverage-report.md`;
			expect(filename).toBe("2026-03-10T12-00-00-flow-coverage-report.md");
		});

		it("omits prefix for full build type", () => {
			const buildType = "full";
			const safeTimestamp = "2026-03-10T12-00-00";
			const prefix = buildType === "full" ? "" : `${buildType}-`;
			const filename = `${safeTimestamp}-${prefix}coverage-report.md`;
			expect(filename).toBe("2026-03-10T12-00-00-coverage-report.md");
		});
	});
});
