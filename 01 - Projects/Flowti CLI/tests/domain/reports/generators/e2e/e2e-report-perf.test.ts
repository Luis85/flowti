import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn(() => []),
		statSync: vi.fn(() => ({ size: 1024 })),
	},
}));
vi.mock("../../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));
vi.mock("../../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

import { disk } from "../../../../../src/infrastructure/filesystem.js";
import { paths } from "../../../../../src/infrastructure/paths.js";
import { Document } from "../../../../../src/infrastructure/document.js";
import {
	readLatestEventTrace, readStartupPerf, buildPerfLines,
	parsePerfPayload, classifyPerfEvent, buildPerfEventStats,
	buildEventTraceLines,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-perf.js";
import type { PerfEventBuckets } from "../../../../../src/domain/reports/generators/e2e/e2e-report-types.js";

const mockDeps = { disk, paths } as any;

function emptyBuckets(): PerfEventBuckets {
	return { startupServices: [], startupTotal: null, storageOps: [], queries: [], dispatches: [], alerts: [] };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("e2e-report-perf", () => {
	describe("readLatestEventTrace", () => {
		it("returns null when dir doesn't exist", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			const result = readLatestEventTrace("/traces", mockDeps);

			expect(result).toBeNull();
		});

		it("returns null when no trace files", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.readdirSync).mockReturnValue([] as any as never);

			const result = readLatestEventTrace("/traces", mockDeps);

			expect(result).toBeNull();
		});

		it("reads latest trace file (sorted reverse)", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.readdirSync).mockReturnValue([
				"2026-03-09-Event Trace.json",
				"2026-03-11-Event Trace.json",
				"2026-03-10-Event Trace.json",
			] as any as never);
			const traceData = { summary: { totalEvents: 42 }, events: [] };
			vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(traceData) as never);

			const result = readLatestEventTrace("/traces", mockDeps);

			expect(result).toEqual(traceData);
			expect(disk.readFileSync).toHaveBeenCalledWith(
				"/traces/2026-03-11-Event Trace.json",
				"utf-8",
			);
		});

		it("returns null on parse error", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.readdirSync).mockReturnValue(["2026-03-10-Event Trace.json"] as any as never);
			vi.mocked(disk.readFileSync).mockReturnValue("not valid json {{" as never);

			const result = readLatestEventTrace("/traces", mockDeps);

			expect(result).toBeNull();
		});
	});

	describe("readStartupPerf", () => {
		it("returns null when no candidates exist", () => {
			vi.mocked(disk.existsSync).mockReturnValue(false);

			const result = readStartupPerf(["/a/data.json", "/b/data.json"], mockDeps);

			expect(result).toBeNull();
		});

		it("returns startup history and size from valid data.json", () => {
			vi.mocked(disk.existsSync).mockReturnValue(true);
			vi.mocked(disk.statSync).mockReturnValue({ size: 8192 } as any as never);
			const dataJson = {
				perfAggregator: {
					startupHistory: [120, 140, 130],
				},
			};
			vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify(dataJson) as never);

			const result = readStartupPerf(["/vault/data.json"], mockDeps);

			expect(result).toEqual({ history: [120, 140, 130], sizeBytes: 8192 });
		});
	});

	describe("buildPerfLines", () => {
		it("does nothing when startupPerf is null", () => {
			const doc = Document.create("Test");
			const before = doc.toString();

			buildPerfLines(null, doc);

			expect(doc.toString()).toEqual(before);
		});

		it("appends performance section to document", () => {
			const doc = Document.create("Test");

			buildPerfLines({ history: [100, 200, 300], sizeBytes: 4096 }, doc);

			const output = doc.toString();
			expect(output).toContain("Performance");
			expect(output).toContain("Startup");
			expect(output).toContain("p50");
			expect(output).toContain("p95");
		});
	});

	describe("parsePerfPayload", () => {
		it("parses JSON string payload", () => {
			const payload = JSON.stringify({ durationMs: 42, service: "TestService" });

			const result = parsePerfPayload(payload);

			expect(result).toEqual({ durationMs: 42, service: "TestService" });
		});

		it("returns object payload as-is", () => {
			const payload = { durationMs: 99, service: "OtherService" };

			const result = parsePerfPayload(payload);

			expect(result).toBe(payload);
		});

		it("returns null on invalid JSON", () => {
			const result = parsePerfPayload("{bad json}");

			expect(result).toBeNull();
		});
	});

	describe("classifyPerfEvent", () => {
		it("classifies startup service event", () => {
			const buckets = emptyBuckets();

			classifyPerfEvent(
				{ type: "perf.startup.service", payload: { service: "AnalyticsService", durationMs: 55 } },
				buckets,
			);

			expect(buckets.startupServices).toHaveLength(1);
			expect(buckets.startupServices[0]).toEqual({ service: "AnalyticsService", durationMs: 55 });
		});

		it("classifies storage loaded event", () => {
			const buckets = emptyBuckets();

			classifyPerfEvent(
				{ type: "perf.storage.loaded", payload: { key: "settings", durationMs: 12, sizeBytes: 512 } },
				buckets,
			);

			expect(buckets.storageOps).toHaveLength(1);
			expect(buckets.storageOps[0]).toEqual({ key: "settings", op: "load", durationMs: 12, sizeBytes: 512 });
		});

		it("classifies query executed event", () => {
			const buckets = emptyBuckets();

			classifyPerfEvent(
				{ type: "perf.query.executed", payload: { queryId: "q-001", durationMs: 8, sourceRows: 100, resultRows: 10 } },
				buckets,
			);

			expect(buckets.queries).toHaveLength(1);
			expect(buckets.queries[0]).toEqual({ queryId: "q-001", durationMs: 8, sourceRows: 100, resultRows: 10 });
		});

		it("classifies alert event", () => {
			const buckets = emptyBuckets();

			classifyPerfEvent(
				{ type: "perf.alert", payload: { metric: "startup.total", value: 6000, threshold: 5000 } },
				buckets,
			);

			expect(buckets.alerts).toHaveLength(1);
			expect(buckets.alerts[0]).toEqual({ metric: "startup.total", value: 6000, threshold: 5000 });
		});
	});

	describe("buildPerfEventStats", () => {
		it("does nothing for empty perf events", () => {
			const doc = Document.create("Test");
			const before = doc.toString();

			buildPerfEventStats([], doc);

			expect(doc.toString()).toEqual(before);
		});

		it("builds stats section from perf events", () => {
			const doc = Document.create("Test");
			const perfEvents = [
				{ type: "perf.startup.service", payload: { service: "SettingsService", durationMs: 30 } },
				{ type: "perf.startup.total", payload: { durationMs: 120, serviceCount: 3 } },
				{ type: "perf.storage.loaded", payload: { key: "data", durationMs: 5, sizeBytes: 256 } },
				{ type: "perf.query.executed", payload: { queryId: "q-dashboard", durationMs: 22, sourceRows: 50, resultRows: 5 } },
				{ type: "perf.alert", payload: { metric: "startup.total", value: 6000, threshold: 5000 } },
			];

			buildPerfEventStats(perfEvents, doc);

			const output = doc.toString();
			expect(output).toContain("Event Performance Statistics");
			expect(output).toContain("Perf events: 5");
		});
	});

	describe("buildEventTraceLines", () => {
		it("does nothing when trace is null", () => {
			const doc = Document.create("Test");
			const before = doc.toString();

			buildEventTraceLines(null, doc);

			expect(doc.toString()).toEqual(before);
		});

		it("appends event trace section", () => {
			const doc = Document.create("Test");
			const trace = {
				summary: {
					totalEvents: 300,
					perfEvents: 20,
					uniqueTypes: 45,
					eventFrequency: { "hub.opened": 10, "settings.loaded": 5 },
				},
				durationMs: 15000,
				perfEvents: [],
			};

			buildEventTraceLines(trace, doc);

			const output = doc.toString();
			expect(output).toContain("Event Trace");
			expect(output).toContain("Trace Summary");
			expect(output).toContain("Events: 300");
			expect(output).toContain("Full details");
		});
	});
});
