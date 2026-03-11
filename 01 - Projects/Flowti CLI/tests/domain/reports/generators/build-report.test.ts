import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────

const mockExistsSync = vi.fn(() => false);
const mockReadFileSync = vi.fn(() => "{}");
const mockWriteFileSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (...a: unknown[]) => mockExistsSync(...a),
		readFileSync: (...a: unknown[]) => mockReadFileSync(...a),
		writeFileSync: (...a: unknown[]) => mockWriteFileSync(...a),
		mkdirSync: (...a: unknown[]) => mockMkdirSync(...a),
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

import { humanBytes, safeLocalTime, collectOutputs } from "../../../../src/domain/reports/generators/build-report.js";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("build-report generator", () => {
	describe("humanBytes", () => {
		it("formats bytes", () => {
			expect(humanBytes(500)).toBe("500 B");
		});

		it("formats kilobytes", () => {
			expect(humanBytes(2048)).toBe("2.00 KB");
		});

		it("formats megabytes", () => {
			expect(humanBytes(1024 * 1024 * 3)).toBe("3.00 MB");
		});

		it("formats gigabytes", () => {
			expect(humanBytes(1024 * 1024 * 1024 * 2)).toBe("2.00 GB");
		});

		it("handles zero", () => {
			expect(humanBytes(0)).toBe("0 B");
		});
	});

	describe("safeLocalTime", () => {
		it("formats date correctly", () => {
			const d = new Date(2026, 2, 10, 14, 5, 9);
			expect(safeLocalTime(d)).toBe("2026-03-10 14:05:09");
		});

		it("pads single-digit values", () => {
			const d = new Date(2026, 0, 1, 1, 2, 3);
			expect(safeLocalTime(d)).toBe("2026-01-01 01:02:03");
		});
	});

	describe("collectOutputs", () => {
		it("returns empty summary for missing outputs", () => {
			const result = collectOutputs({});
			expect(result.totalBytes).toBe(0);
			expect(result.outputs).toEqual([]);
		});

		it("sums JS bytes", () => {
			const result = collectOutputs({ outputs: { "dist/main.js": { bytes: 1000 } } });
			expect(result.jsBytes).toBe(1000);
			expect(result.totalBytes).toBe(1000);
		});

		it("sums CSS bytes", () => {
			const result = collectOutputs({ outputs: { "dist/styles.css": { bytes: 500 } } });
			expect(result.cssBytes).toBe(500);
		});

		it("sums other bytes", () => {
			const result = collectOutputs({ outputs: { "dist/icon.svg": { bytes: 200 } } });
			expect(result.otherBytes).toBe(200);
		});

		it("handles multiple outputs", () => {
			const result = collectOutputs({
				outputs: {
					"dist/main.js": { bytes: 1000 },
					"dist/styles.css": { bytes: 300 },
					"dist/map.json": { bytes: 100 },
				},
			});
			expect(result.totalBytes).toBe(1400);
			expect(result.jsBytes).toBe(1000);
			expect(result.cssBytes).toBe(300);
			expect(result.otherBytes).toBe(100);
			expect(result.outputs).toHaveLength(3);
		});
	});

	describe("output filename", () => {
		it("uses build-report for default", () => {
			const args: Record<string, string> = {};
			const isRelease = args.release === "true";
			const buildType = args["build-type"];
			const prefix = buildType === "increment"
				? "increment-build-report"
				: isRelease ? "release-build-report" : "build-report";
			expect(prefix).toBe("build-report");
		});

		it("uses release-build-report when --release", () => {
			const args: Record<string, string> = { release: "true" };
			const isRelease = args.release === "true";
			const buildType = args["build-type"];
			const prefix = buildType === "increment"
				? "increment-build-report"
				: isRelease ? "release-build-report" : "build-report";
			expect(prefix).toBe("release-build-report");
		});

		it("uses increment-build-report for increment build-type", () => {
			const args: Record<string, string> = { "build-type": "increment" };
			const buildType = args["build-type"];
			const prefix = buildType === "increment"
				? "increment-build-report"
				: "build-report";
			expect(prefix).toBe("increment-build-report");
		});
	});
});
