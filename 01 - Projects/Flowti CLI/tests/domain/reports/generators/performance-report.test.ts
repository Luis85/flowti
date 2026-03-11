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

import { percentile, round, formatBytes } from "../../../../src/domain/reports/generators/performance-report.js";

describe("performance-report generator", () => {
	describe("percentile", () => {
		it("returns 0 for empty array", () => {
			expect(percentile([], 0.5)).toBe(0);
		});

		it("returns p50 for sorted array", () => {
			expect(percentile([10, 20, 30, 40, 50], 0.5)).toBe(30);
		});

		it("returns p95 for sorted array", () => {
			expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.95)).toBe(100);
		});

		it("returns single element for single-element array", () => {
			expect(percentile([42], 0.5)).toBe(42);
			expect(percentile([42], 0.95)).toBe(42);
		});

		it("returns first element for p=0", () => {
			// ceil(0 * 5) - 1 = -1, max(0,-1)=0
			expect(percentile([1, 2, 3, 4, 5], 0)).toBe(1);
		});
	});

	describe("round", () => {
		it("rounds to 2 decimals", () => {
			expect(round(1.2345)).toBe(1.23);
			expect(round(1.235)).toBe(1.24);
			expect(round(0)).toBe(0);
			expect(round(100)).toBe(100);
		});
	});

	describe("formatBytes", () => {
		it("formats bytes", () => {
			expect(formatBytes(500)).toBe("500B");
		});

		it("formats kilobytes", () => {
			expect(formatBytes(2048)).toBe("2.0KB");
		});

		it("formats megabytes", () => {
			expect(formatBytes(2 * 1024 * 1024)).toBe("2.0MB");
		});

		it("formats zero", () => {
			expect(formatBytes(0)).toBe("0B");
		});
	});

	describe("frontmatter construction", () => {
		it("builds correct frontmatter with perf data", () => {
			const startupHistory = [200, 300, 250, 350, 280];
			const sorted = [...startupHistory].sort((a, b) => a - b);
			const fm = {
				type: "PerformanceReport",
				date: "2026-03-10",
				startup_total_ms: round(startupHistory[startupHistory.length - 1] ?? 0),
				startup_measurements: startupHistory.length,
				startup_p50: round(percentile(sorted, 0.5)),
				startup_p95: round(percentile(sorted, 0.95)),
				startup_max: round(sorted[sorted.length - 1] ?? 0),
			};

			expect(fm.startup_total_ms).toBe(280);
			expect(fm.startup_measurements).toBe(5);
			expect(fm.startup_p50).toBe(280);
			expect(fm.startup_p95).toBe(350);
			expect(fm.startup_max).toBe(350);
		});

		it("handles empty startup history", () => {
			const startupHistory: number[] = [];
			const sorted = [...startupHistory].sort((a, b) => a - b);
			const fm = {
				startup_total_ms: round(startupHistory[startupHistory.length - 1] ?? 0),
				startup_measurements: startupHistory.length,
				startup_p50: round(percentile(sorted, 0.5)),
				startup_p95: round(percentile(sorted, 0.95)),
				startup_max: round(sorted[sorted.length - 1] ?? 0),
			};

			expect(fm.startup_total_ms).toBe(0);
			expect(fm.startup_measurements).toBe(0);
			expect(fm.startup_p50).toBe(0);
			expect(fm.startup_p95).toBe(0);
			expect(fm.startup_max).toBe(0);
		});

		it("computes data_json_size_bytes", () => {
			const data = { perfAggregator: { startupHistory: [100] } };
			const sizeBytes = JSON.stringify(data).length;
			expect(sizeBytes).toBeGreaterThan(0);
		});
	});
});
