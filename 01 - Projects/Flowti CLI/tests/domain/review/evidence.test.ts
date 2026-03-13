import { describe, it, expect, vi } from "vitest";
import {
	generateRunId,
	evidenceBaseDir,
	runDir,
	createRunDir,
	createRunManifest,
	saveRunManifest,
	saveStepResult,
	saveStepLog,
	collectEvidence,
	listRuns,
	pruneRuns,
	type EvidenceDeps,
} from "../../../src/domain/review/evidence.js";
import type { JourneyResult, StepResult } from "../../../src/domain/e2e/journey/journey-types.js";
import { mockDisk, mockPathsPreset, mockClockPreset } from "../../mocks/mock-presets.js";

// ── Mock deps factory ────────────────────────────────────────────────

function makeDeps(overrides?: {
	disk?: Partial<ReturnType<typeof mockDisk>["disk"]>;
	clockIso?: string;
}): EvidenceDeps {
	return {
		...mockDisk(overrides?.disk),
		...mockPathsPreset(),
		...mockClockPreset(overrides?.clockIso ?? "2025-06-15T10:30:00.000Z"),
	};
}

// ── Fixtures ─────────────────────────────────────────────────────────

function makeStepResult(id: string, status: "pass" | "fail" | "skip"): StepResult {
	return {
		stepId: id,
		stepTitle: `Step ${id}`,
		status,
		durationMs: 50,
		actions: [
			{ tool: "command", success: status === "pass", output: "ok", durationMs: 10 },
		],
	};
}

function makeJourneyResult(
	name: string,
	steps: StepResult[],
	traceability?: JourneyResult["traceability"],
): JourneyResult {
	const passed = steps.filter((s) => s.status === "pass").length;
	const failed = steps.filter((s) => s.status === "fail").length;
	const skipped = steps.filter((s) => s.status === "skip").length;
	return {
		journeyName: name,
		totalSteps: steps.length,
		passed,
		failed,
		skipped,
		durationMs: 200,
		steps,
		traceability,
	};
}

// ── generateRunId ────────────────────────────────────────────────────

describe("generateRunId", () => {
	it("generates a timestamp-based ID with colons and dots replaced", () => {
		const deps = makeDeps({ clockIso: "2025-06-15T10:30:00.000Z" });
		const id = generateRunId(deps);
		expect(id).toBe("2025-06-15T10-30-00-000Z");
		expect(id).not.toContain(":");
		expect(id).not.toContain(".");
	});

	it("uses the injected clock, not wall time", () => {
		const deps = makeDeps({ clockIso: "2024-01-01T00:00:00.000Z" });
		const id = generateRunId(deps);
		expect(id).toContain("2024-01-01");
	});
});

// ── evidenceBaseDir ──────────────────────────────────────────────────

describe("evidenceBaseDir", () => {
	it("resolves default evidence directory", () => {
		const deps = makeDeps();
		const dir = evidenceBaseDir(deps, "/project");
		expect(dir).toBe("/project/docs/evidence");
	});

	it("uses custom config dir when provided", () => {
		const deps = makeDeps();
		const dir = evidenceBaseDir(deps, "/project", "custom/evidence");
		expect(dir).toBe("/project/custom/evidence");
	});
});

// ── runDir ───────────────────────────────────────────────────────────

describe("runDir", () => {
	it("resolves run directory under evidence/runs", () => {
		const deps = makeDeps();
		const dir = runDir(deps, "/project", "run-001");
		expect(dir).toBe("/project/docs/evidence/runs/run-001");
	});

	it("uses custom config dir when provided", () => {
		const deps = makeDeps();
		const dir = runDir(deps, "/project", "run-001", "out/evidence");
		expect(dir).toBe("/project/out/evidence/runs/run-001");
	});
});

// ── createRunDir ─────────────────────────────────────────────────────

describe("createRunDir", () => {
	it("creates the run directory and journeys subdirectory", () => {
		const deps = makeDeps();
		const dir = createRunDir(deps, "/project", "run-001");
		expect(dir).toBe("/project/docs/evidence/runs/run-001");
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(dir, { recursive: true });
		expect(deps.disk.mkdirSync).toHaveBeenCalledWith(
			"/project/docs/evidence/runs/run-001/journeys",
			{ recursive: true },
		);
	});

	it("returns the created directory path", () => {
		const deps = makeDeps();
		const dir = createRunDir(deps, "/project", "run-002");
		expect(typeof dir).toBe("string");
		expect(dir).toContain("run-002");
	});
});

// ── createRunManifest ────────────────────────────────────────────────

describe("createRunManifest", () => {
	it("aggregates journey results into a manifest", () => {
		const deps = makeDeps();
		const results: JourneyResult[] = [
			makeJourneyResult("j1", [
				makeStepResult("s1", "pass"),
				makeStepResult("s2", "fail"),
			]),
			makeJourneyResult("j2", [
				makeStepResult("s3", "pass"),
				makeStepResult("s4", "skip"),
			]),
		];

		const manifest = createRunManifest("run-001", "my-project", results, deps);

		expect(manifest.runId).toBe("run-001");
		expect(manifest.project).toBe("my-project");
		expect(manifest.journeyCount).toBe(2);
		expect(manifest.totalSteps).toBe(4);
		expect(manifest.passed).toBe(2);
		expect(manifest.failed).toBe(1);
		expect(manifest.skipped).toBe(1);
		expect(manifest.durationMs).toBe(400); // 200 * 2
		expect(manifest.trigger).toBe("manual");
		expect(manifest.config).toEqual({});
	});

	it("uses provided config and trigger", () => {
		const deps = makeDeps();
		const results = [makeJourneyResult("j1", [makeStepResult("s1", "pass")])];
		const manifest = createRunManifest(
			"run-002", "proj", results, deps,
			{ threshold: 80 }, "ci", "obsidian-plugin", "browser",
		);
		expect(manifest.config).toEqual({ threshold: 80 });
		expect(manifest.trigger).toBe("ci");
		expect(manifest.projectType).toBe("obsidian-plugin");
		expect(manifest.environment.provider).toBe("browser");
	});

	it("includes environment info", () => {
		const deps = makeDeps();
		const manifest = createRunManifest("run-003", "proj", [], deps);
		expect(manifest.environment.nodeVersion).toBeDefined();
		expect(manifest.environment.platform).toBeDefined();
	});
});

// ── saveRunManifest ──────────────────────────────────────────────────

describe("saveRunManifest", () => {
	it("writes manifest JSON to disk", () => {
		const deps = makeDeps();
		const manifest = createRunManifest("run-001", "proj", [], deps);
		const path = saveRunManifest(deps, "/runs/run-001", manifest);

		expect(path).toBe("/runs/run-001/run-manifest.json");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/runs/run-001/run-manifest.json",
			expect.any(String),
			"utf-8",
		);

		const written = (deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls[0][1];
		expect(JSON.parse(written).runId).toBe("run-001");
	});
});

// ── saveStepResult ───────────────────────────────────────────────────

describe("saveStepResult", () => {
	it("writes step result JSON to the step directory", () => {
		const deps = makeDeps();
		const result = makeStepResult("s1", "pass");
		const path = saveStepResult(deps, "/runs/run-001/journeys/j1/s1", result);

		expect(path).toBe("/runs/run-001/journeys/j1/s1/result.json");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/runs/run-001/journeys/j1/s1/result.json",
			expect.any(String),
			"utf-8",
		);
	});
});

// ── saveStepLog ──────────────────────────────────────────────────────

describe("saveStepLog", () => {
	it("writes log content to the step directory", () => {
		const deps = makeDeps();
		const path = saveStepLog(deps, "/runs/run-001/journeys/j1/s1", "line 1\nline 2");

		expect(path).toBe("/runs/run-001/journeys/j1/s1/log.txt");
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/runs/run-001/journeys/j1/s1/log.txt",
			"line 1\nline 2",
			"utf-8",
		);
	});
});

// ── collectEvidence ──────────────────────────────────────────────────

describe("collectEvidence", () => {
	it("orchestrates full evidence collection", () => {
		const deps = makeDeps();
		const results: JourneyResult[] = [
			makeJourneyResult("Login Flow", [
				makeStepResult("s1", "pass"),
				makeStepResult("s2", "fail"),
			]),
		];

		const summary = collectEvidence(deps, "/project", "my-app", "run-001", results);

		expect(summary.runId).toBe("run-001");
		expect(summary.manifest.project).toBe("my-app");
		expect(summary.manifest.journeyCount).toBe(1);
		expect(summary.journeyResults).toHaveLength(1);

		// Should have created run dir
		expect(deps.disk.mkdirSync).toHaveBeenCalled();
		// Should have written manifest, journey result, step results, summary
		expect((deps.disk.writeFileSync as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
	});

	it("skips evidence for skipped steps", () => {
		const deps = makeDeps();
		const results: JourneyResult[] = [
			makeJourneyResult("J1", [
				makeStepResult("s1", "skip"),
			]),
		];

		const summary = collectEvidence(deps, "/project", "app", "run-002", results);

		// No step-level evidence for skipped steps, but still have manifest + journey + summary
		expect(summary.artifacts).toHaveLength(0);
	});

	it("collects log artifacts from step actions", () => {
		const deps = makeDeps();
		const results: JourneyResult[] = [
			makeJourneyResult("J1", [makeStepResult("s1", "pass")]),
		];

		const summary = collectEvidence(deps, "/project", "app", "run-003", results);

		expect(summary.artifacts.length).toBeGreaterThanOrEqual(1);
		expect(summary.artifacts[0].type).toBe("log");
		expect(summary.artifacts[0].stepId).toBe("s1");
		expect(summary.artifacts[0].journeyName).toBe("J1");
	});

	it("uses custom config dir", () => {
		const deps = makeDeps();
		const results = [makeJourneyResult("J1", [makeStepResult("s1", "pass")])];
		const summary = collectEvidence(deps, "/project", "app", "run-004", results, {}, "custom/out");

		expect(summary.runDir).toContain("custom/out");
	});
});

// ── listRuns ─────────────────────────────────────────────────────────

describe("listRuns", () => {
	it("returns empty array when runs directory does not exist", () => {
		const deps = makeDeps({ disk: { existsSync: vi.fn(() => false) } });
		expect(listRuns(deps, "/project")).toEqual([]);
	});

	it("lists runs sorted newest first", () => {
		const deps = makeDeps({
			disk: {
				existsSync: vi.fn(() => true),
				readdirSync: vi.fn(() => [
					"2025-06-01T00-00-00-000Z",
					"2025-06-15T00-00-00-000Z",
					"2025-06-10T00-00-00-000Z",
				]),
			},
		});

		const runs = listRuns(deps, "/project");
		expect(runs).toEqual([
			"2025-06-15T00-00-00-000Z",
			"2025-06-10T00-00-00-000Z",
			"2025-06-01T00-00-00-000Z",
		]);
	});

	it("filters out hidden entries", () => {
		const deps = makeDeps({
			disk: {
				existsSync: vi.fn(() => true),
				readdirSync: vi.fn(() => [".gitkeep", "run-001", "run-002"]),
			},
		});

		const runs = listRuns(deps, "/project");
		expect(runs).not.toContain(".gitkeep");
		expect(runs).toHaveLength(2);
	});
});

// ── pruneRuns ────────────────────────────────────────────────────────

describe("pruneRuns", () => {
	it("removes runs beyond the retention limit", () => {
		const deps = makeDeps({
			disk: {
				existsSync: vi.fn(() => true),
				readdirSync: vi.fn(() => ["run-001", "run-002", "run-003", "run-004", "run-005"]),
			},
		});

		const removed = pruneRuns(deps, "/project", 3);

		expect(removed).toBe(2);
		expect(deps.disk.rmSync).toHaveBeenCalledTimes(2);
	});

	it("removes nothing when count is within retention", () => {
		const deps = makeDeps({
			disk: {
				existsSync: vi.fn(() => true),
				readdirSync: vi.fn(() => ["run-001", "run-002"]),
			},
		});

		const removed = pruneRuns(deps, "/project", 5);
		expect(removed).toBe(0);
		expect(deps.disk.rmSync).not.toHaveBeenCalled();
	});

	it("removes all when retention is 0", () => {
		const deps = makeDeps({
			disk: {
				existsSync: vi.fn(() => true),
				readdirSync: vi.fn(() => ["run-001", "run-002"]),
			},
		});

		const removed = pruneRuns(deps, "/project", 0);
		expect(removed).toBe(2);
	});

	it("handles empty runs directory", () => {
		const deps = makeDeps({
			disk: {
				existsSync: vi.fn(() => false),
			},
		});

		const removed = pruneRuns(deps, "/project", 3);
		expect(removed).toBe(0);
	});

	it("uses recursive force when removing", () => {
		const deps = makeDeps({
			disk: {
				existsSync: vi.fn(() => true),
				readdirSync: vi.fn(() => ["run-001", "run-002"]),
			},
		});

		pruneRuns(deps, "/project", 1);
		expect(deps.disk.rmSync).toHaveBeenCalledWith(
			expect.any(String),
			{ recursive: true, force: true },
		);
	});
});
