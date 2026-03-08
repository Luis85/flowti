import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		readdirSync: vi.fn(() => []),
		statSync: vi.fn(() => ({ size: 1024 })),
	},
}));

vi.mock("../../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
	},
}));

vi.mock("../../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { disk } from "../../../../../src/infrastructure/filesystem.js";
import {
	parsePerfPayload, classifyPerfEvent,
	readLatestEventTrace, readStartupPerf,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-perf.js";
import type { PerfEventBuckets, PerfTraceEvent } from "../../../../../src/domain/reports/generators/e2e/e2e-report-types.js";

function emptyBuckets(): PerfEventBuckets {
	return { startupServices: [], startupTotal: null, storageOps: [], queries: [], dispatches: [], alerts: [] };
}

describe("parsePerfPayload", () => {
	it("parses JSON string payload", () => {
		expect(parsePerfPayload('{"key": "value"}')).toEqual({ key: "value" });
	});

	it("passes through object payload", () => {
		const obj = { foo: "bar" };
		expect(parsePerfPayload(obj)).toBe(obj);
	});

	it("returns null for invalid JSON", () => {
		expect(parsePerfPayload("not json")).toBeNull();
	});
});

describe("classifyPerfEvent", () => {
	it("classifies startup service event", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.startup.service", payload: { service: "EventBus", durationMs: 42 } }, buckets);
		expect(buckets.startupServices).toHaveLength(1);
		expect(buckets.startupServices[0].service).toBe("EventBus");
		expect(buckets.startupServices[0].durationMs).toBe(42);
	});

	it("classifies startup total event", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.startup.total", payload: { durationMs: 500, serviceCount: 10 } }, buckets);
		expect(buckets.startupTotal).not.toBeNull();
		expect(buckets.startupTotal!.durationMs).toBe(500);
		expect(buckets.startupTotal!.serviceCount).toBe(10);
	});

	it("classifies storage loaded event", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.storage.loaded", payload: { key: "settings", durationMs: 5, sizeBytes: 1024 } }, buckets);
		expect(buckets.storageOps).toHaveLength(1);
		expect(buckets.storageOps[0].op).toBe("load");
	});

	it("classifies storage saved event", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.storage.saved", payload: { key: "data", durationMs: 10, sizeBytes: 2048 } }, buckets);
		expect(buckets.storageOps).toHaveLength(1);
		expect(buckets.storageOps[0].op).toBe("save");
	});

	it("classifies query event", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.query.executed", payload: { queryId: "q1", durationMs: 15, sourceRows: 100, resultRows: 10 } }, buckets);
		expect(buckets.queries).toHaveLength(1);
		expect(buckets.queries[0].queryId).toBe("q1");
	});

	it("classifies dispatch event", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.event.dispatched", payload: { eventType: "hub.opened", handlerCount: 3, durationMs: 2 } }, buckets);
		expect(buckets.dispatches).toHaveLength(1);
		expect(buckets.dispatches[0].eventType).toBe("hub.opened");
	});

	it("classifies alert event", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.alert", payload: { metric: "startup", value: 6000, threshold: 5000 } }, buckets);
		expect(buckets.alerts).toHaveLength(1);
		expect(buckets.alerts[0].value).toBe(6000);
	});

	it("ignores unknown event types", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.unknown", payload: { foo: "bar" } }, buckets);
		expect(buckets.startupServices).toHaveLength(0);
		expect(buckets.storageOps).toHaveLength(0);
	});

	it("handles JSON string payloads", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.alert", payload: JSON.stringify({ metric: "latency", value: 100, threshold: 50 }) }, buckets);
		expect(buckets.alerts).toHaveLength(1);
		expect(buckets.alerts[0].metric).toBe("latency");
	});

	it("handles invalid payload gracefully", () => {
		const buckets = emptyBuckets();
		classifyPerfEvent({ type: "perf.alert", payload: "not-json" }, buckets);
		expect(buckets.alerts).toHaveLength(0);
	});
});

describe("readLatestEventTrace", () => {
	it("returns null when directory doesn't exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		expect(readLatestEventTrace("/traces")).toBeNull();
	});

	it("returns null when no trace files found", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([] as unknown as ReturnType<typeof disk.readdirSync>);
		expect(readLatestEventTrace("/traces")).toBeNull();
	});

	it("reads the latest trace file", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue([
			"2026-03-01-Event Trace.json",
			"2026-03-05-Event Trace.json",
		] as unknown as ReturnType<typeof disk.readdirSync>);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ summary: { totalEvents: 100 } }));
		const result = readLatestEventTrace("/traces");
		expect(result).not.toBeNull();
		expect(result!.summary!.totalEvents).toBe(100);
	});
});

describe("readStartupPerf", () => {
	it("returns null when no candidates exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		expect(readStartupPerf(["/a/data.json", "/b/data.json"])).toBeNull();
	});

	it("reads startup history from first available candidate", () => {
		vi.mocked(disk.existsSync).mockImplementation((p) => p === "/a/data.json");
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({
			perfAggregator: { startupHistory: [100, 200, 150] },
		}));
		vi.mocked(disk.statSync).mockReturnValue({ size: 4096 } as ReturnType<typeof disk.statSync>);
		const result = readStartupPerf(["/a/data.json", "/b/data.json"]);
		expect(result).not.toBeNull();
		expect(result!.history).toEqual([100, 200, 150]);
		expect(result!.sizeBytes).toBe(4096);
	});
});
