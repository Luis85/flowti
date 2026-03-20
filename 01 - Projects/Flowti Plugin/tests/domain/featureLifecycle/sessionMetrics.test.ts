import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeFeatureSessionMetrics, createSessionRecordFromEvent } from "../../../src/domain/featureLifecycle/sessionMetrics";
import type { FeatureSessionRecord } from "../../../src/domain/featureLifecycle/types";
import { FeatureLifecycleService } from "../../../src/domain/featureLifecycle/FeatureLifecycleService";
import type { ScannedPRD } from "../../../src/domain/featureLifecycle/FeatureLifecycleService";

// ── Helpers ──────────────────────────────────────────────────

function makeRecord(overrides: Partial<FeatureSessionRecord> = {}): FeatureSessionRecord {
	return {
		featureName: "Test Feature",
		startTime: "2026-03-06T10:00:00.000Z",
		endTime: "2026-03-06T10:30:00.000Z",
		filesCreated: [],
		filesModified: [],
		notes: "",
		stageAtStart: "idea",
		stageAtEnd: "idea",
		...overrides,
	};
}

function createMockStorage() {
	let stored: any = null;
	return {
		load: vi.fn(async () => stored),
		save: vi.fn(async (data: any) => { stored = data; }),
		safeLoad: vi.fn(async (defaults: any) => stored ?? defaults),
	};
}

function createMockEventBus() {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
	};
}

function createTestPRD(overrides: Partial<ScannedPRD> = {}): ScannedPRD {
	return {
		path: "docs/features/Process/Process Management PRD.md",
		name: "Process Management PRD",
		frontmatter: {
			type: "ProductRequirementsDocument",
			stage: "in-progress",
			domain: "Flowti",
			related_events: [],
		},
		...overrides,
	};
}

// ── computeFeatureSessionMetrics ────────────────────────────

describe("computeFeatureSessionMetrics", () => {
	it("returns zeros for empty records", () => {
		const result = computeFeatureSessionMetrics([]);
		expect(result.totalSessions).toBe(0);
		expect(result.totalTimeMs).toBe(0);
		expect(result.totalFilesChanged).toBe(0);
		expect(result.lastSessionEnd).toBeNull();
	});

	it("counts completed sessions", () => {
		const records = [
			makeRecord(),
			makeRecord({ endTime: "2026-03-06T11:00:00.000Z", startTime: "2026-03-06T10:30:00.000Z" }),
		];
		const result = computeFeatureSessionMetrics(records);
		expect(result.totalSessions).toBe(2);
	});

	it("excludes active sessions (no endTime)", () => {
		const records = [
			makeRecord(),
			makeRecord({ endTime: null }),
		];
		const result = computeFeatureSessionMetrics(records);
		expect(result.totalSessions).toBe(1);
	});

	it("sums total time across sessions", () => {
		const records = [
			makeRecord({ startTime: "2026-03-06T10:00:00.000Z", endTime: "2026-03-06T10:30:00.000Z" }),
			makeRecord({ startTime: "2026-03-06T11:00:00.000Z", endTime: "2026-03-06T11:45:00.000Z" }),
		];
		const result = computeFeatureSessionMetrics(records);
		expect(result.totalTimeMs).toBe(30 * 60_000 + 45 * 60_000);
	});

	it("sums files changed", () => {
		const records = [
			makeRecord({ filesCreated: ["a.ts"], filesModified: ["b.ts", "c.ts"] }),
			makeRecord({ filesCreated: [], filesModified: ["d.ts"] }),
		];
		const result = computeFeatureSessionMetrics(records);
		expect(result.totalFilesChanged).toBe(4);
	});

	it("finds the latest session end time", () => {
		const records = [
			makeRecord({ endTime: "2026-03-06T10:30:00.000Z" }),
			makeRecord({ endTime: "2026-03-06T12:00:00.000Z" }),
			makeRecord({ endTime: "2026-03-06T11:00:00.000Z" }),
		];
		const result = computeFeatureSessionMetrics(records);
		expect(result.lastSessionEnd).toBe("2026-03-06T12:00:00.000Z");
	});
});

// ── createSessionRecordFromEvent ────────────────────────────

describe("createSessionRecordFromEvent", () => {
	it("creates a record from event payload", () => {
		const record = createSessionRecordFromEvent({
			featureName: "Process Management",
			endTime: "2026-03-06T10:30:00.000Z",
			duration: 1800000, // 30 minutes
			filesChanged: 3,
		});

		expect(record.featureName).toBe("Process Management");
		expect(record.endTime).toBe("2026-03-06T10:30:00.000Z");
		expect(record.startTime).toBe("2026-03-06T10:00:00.000Z");
		expect(record.filesModified).toHaveLength(3);
	});

	it("handles zero files changed", () => {
		const record = createSessionRecordFromEvent({
			featureName: "Test",
			endTime: "2026-03-06T10:30:00.000Z",
			duration: 60000,
			filesChanged: 0,
		});

		expect(record.filesModified).toHaveLength(0);
		expect(record.filesCreated).toHaveLength(0);
	});
});

// ── FeatureLifecycleService.handleSessionEnded ──────────────

describe("FeatureLifecycleService.handleSessionEnded", () => {
	let service: FeatureLifecycleService;
	let storage: ReturnType<typeof createMockStorage>;

	beforeEach(async () => {
		storage = createMockStorage();
		const eventBus = createMockEventBus();
		service = new FeatureLifecycleService({ storage, eventBus, deferVaultScan: false } as any);
		service.setScanner(async () => [createTestPRD()]);
		await service.load();
	});

	it("records session into feature history", async () => {
		await service.handleSessionEnded({
			featureName: "Process Management",
			endTime: "2026-03-06T10:30:00.000Z",
			duration: 1800000,
			filesChanged: 2,
		});

		const sessions = service.getSessionsForFeature("Process Management");
		expect(sessions).toHaveLength(1);
		expect(sessions[0].stageAtStart).toBe("in-progress");
		expect(sessions[0].stageAtEnd).toBe("in-progress");
	});

	it("ignores unknown feature names", async () => {
		await service.handleSessionEnded({
			featureName: "Unknown Feature",
			endTime: "2026-03-06T10:30:00.000Z",
			duration: 1800000,
			filesChanged: 0,
		});

		const sessions = service.getSessionsForFeature("Unknown Feature");
		expect(sessions).toHaveLength(0);
	});

	it("computes metrics after recording", async () => {
		await service.handleSessionEnded({
			featureName: "Process Management",
			endTime: "2026-03-06T10:30:00.000Z",
			duration: 1800000,
			filesChanged: 2,
		});

		const metrics = service.getSessionMetrics("Process Management");
		expect(metrics.totalSessions).toBe(1);
		expect(metrics.totalTimeMs).toBe(1800000);
		expect(metrics.totalFilesChanged).toBe(2);
	});
});
