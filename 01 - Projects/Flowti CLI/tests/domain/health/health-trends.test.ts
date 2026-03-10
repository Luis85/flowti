import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		sep: "/",
	},
}));

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: {
		iso: () => "2026-03-09T12:00:00.000Z",
		safeIso: () => "2026-03-09T12-00-00",
		now: () => new Date("2026-03-09T12:00:00.000Z"),
		ms: () => 0,
	},
}));

import * as filesystemMod from "../../../src/infrastructure/filesystem.js";
import {
	saveSnapshot,
	loadHistory,
	computeDeltas,
	buildTrend,
} from "../../../src/domain/health/health-trends.js";
import type { StoredSnapshot } from "../../../src/domain/health/health-trends.js";
import type { HealthSnapshot } from "../../../src/domain/health/health.js";
import type { HealthScore } from "../../../src/domain/health/health-scoring.js";

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(filesystemMod, { disk: mockFs });
}

const makeSnapshot = (overrides: Partial<HealthSnapshot> = {}): HealthSnapshot => ({
	name: "test",
	source: { files: 100, testFiles: 50 },
	tests: { total: 1000, passed: 1000, failed: 0, suites: 50 },
	coverage: { lines: 80, branches: 70, functions: 85 },
	build: { success: true, durationMs: 5000 },
	lint: { errors: 0, warnings: 2 },
	git: { branch: "main", status: "clean" },
	security: null,
	components: 10,
	...overrides,
});

const makeScore = (overall = 90): HealthScore => ({
	overall,
	grade: overall >= 90 ? "A" : "B",
	categories: { tests: 100, coverage: 85, build: 100, lint: 95, security: 0, git: 100 },
});

const makeStored = (timestamp: string, snapshot?: Partial<HealthSnapshot>, overall?: number): StoredSnapshot => ({
	timestamp,
	snapshot: makeSnapshot(snapshot),
	score: makeScore(overall),
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("saveSnapshot", () => {
	it("saves a JSON file in the health history directory", () => {
		const fs = createMockFs();
		setDisk(fs);
		const snapshot = makeSnapshot();
		const score = makeScore();

		const filePath = saveSnapshot("/project", snapshot, score);

		expect(filePath).toContain("health");
		expect(filePath).toContain("-health.json");
		expect(fs.files.has(filePath)).toBe(true);

		const content = JSON.parse(fs.files.get(filePath)!);
		expect(content.timestamp).toBe("2026-03-09T12:00:00.000Z");
		expect(content.snapshot.name).toBe("test");
		expect(content.score.overall).toBe(90);
	});
});

describe("loadHistory", () => {
	it("loads snapshots sorted most recent first", () => {
		const fs = createMockFs({
			"/project/reports/health/2026-03-08T10-00-00-health.json": JSON.stringify(makeStored("2026-03-08T10:00:00Z")),
			"/project/reports/health/2026-03-09T10-00-00-health.json": JSON.stringify(makeStored("2026-03-09T10:00:00Z")),
		});
		setDisk(fs);

		const history = loadHistory("/project");
		expect(history).toHaveLength(2);
		expect(history[0].timestamp).toBe("2026-03-09T10:00:00Z");
		expect(history[1].timestamp).toBe("2026-03-08T10:00:00Z");
	});

	it("returns empty array when no history", () => {
		const fs = createMockFs();
		setDisk(fs);
		expect(loadHistory("/project")).toEqual([]);
	});

	it("skips corrupt JSON files", () => {
		const fs = createMockFs({
			"/project/reports/health/2026-03-08T10-00-00-health.json": "not json",
			"/project/reports/health/2026-03-09T10-00-00-health.json": JSON.stringify(makeStored("2026-03-09")),
		});
		setDisk(fs);

		const history = loadHistory("/project");
		expect(history).toHaveLength(1);
	});
});

describe("computeDeltas", () => {
	it("computes deltas between two snapshots", () => {
		const prev = makeStored("2026-03-08", { tests: { total: 900, passed: 900, failed: 0, suites: 45 } }, 85);
		const curr = makeStored("2026-03-09", { tests: { total: 1000, passed: 1000, failed: 0, suites: 50 } }, 90);

		const deltas = computeDeltas(curr, prev);

		const scoreDelta = deltas.find((d) => d.metric === "score.overall");
		expect(scoreDelta).toBeDefined();
		expect(scoreDelta!.delta).toBe(5);
		expect(scoreDelta!.indicator).toBe("▲");

		const testsDelta = deltas.find((d) => d.metric === "tests.total");
		expect(testsDelta).toBeDefined();
		expect(testsDelta!.delta).toBe(100);
	});

	it("filters out zero deltas", () => {
		const prev = makeStored("2026-03-08");
		const curr = makeStored("2026-03-09");

		const deltas = computeDeltas(curr, prev);
		expect(deltas).toHaveLength(0);
	});

	it("shows downward trends with ▼", () => {
		const prev = makeStored("2026-03-08", { coverage: { lines: 85, branches: 75, functions: 90 } });
		const curr = makeStored("2026-03-09", { coverage: { lines: 80, branches: 70, functions: 85 } });

		const deltas = computeDeltas(curr, prev);
		const linesDelta = deltas.find((d) => d.metric === "coverage.lines");
		expect(linesDelta!.indicator).toBe("▼");
		expect(linesDelta!.delta).toBe(-5);
	});

	it("handles null sections gracefully", () => {
		const prev = makeStored("2026-03-08", { tests: null, coverage: null });
		const curr = makeStored("2026-03-09", { tests: null, coverage: null });

		const deltas = computeDeltas(curr, prev);
		// Should not include test or coverage deltas
		expect(deltas.some((d) => d.metric.startsWith("tests."))).toBe(false);
		expect(deltas.some((d) => d.metric.startsWith("coverage."))).toBe(false);
	});
});

describe("buildTrend", () => {
	it("builds trend with deltas from previous", () => {
		const history = [makeStored("2026-03-08", { tests: { total: 900, passed: 900, failed: 0, suites: 45 } })];
		const current = makeStored("2026-03-09");

		const trend = buildTrend(current, history);
		expect(trend.previous).toBeDefined();
		expect(trend.deltas.length).toBeGreaterThan(0);
	});

	it("returns empty deltas when no history", () => {
		const current = makeStored("2026-03-09");
		const trend = buildTrend(current, []);
		expect(trend.previous).toBeNull();
		expect(trend.deltas).toHaveLength(0);
	});
});
