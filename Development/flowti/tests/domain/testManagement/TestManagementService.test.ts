import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { TestManagementState } from "../../../src/domain/testManagement/types";

// ── Mock Storage ─────────────────────────────────────────────

function createMockStorage(initialState?: Partial<TestManagementState>) {
	let stored: TestManagementState | null = initialState
		? { journeys: [], complianceTags: {}, ...initialState }
		: null;
	return {
		load: vi.fn(async () => stored),
		save: vi.fn(async (data: TestManagementState) => { stored = data; }),
		safeLoad: vi.fn(async (defaults: TestManagementState) => stored ?? defaults),
	};
}

// ── Mock EventBus ────────────────────────────────────────────

function createMockEventBus() {
	return {
		emit: vi.fn(async () => {}),
		on: vi.fn(() => () => {}),
	};
}

// ── Tests ────────────────────────────────────────────────────

describe("TestManagementService", () => {
	let service: TestManagementService;
	let storage: ReturnType<typeof createMockStorage>;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(() => {
		storage = createMockStorage();
		eventBus = createMockEventBus();
		service = new TestManagementService({
			storage: storage as unknown as Parameters<typeof TestManagementService.prototype.load extends () => Promise<void> ? never : never>[0],
			eventBus: eventBus as unknown as Parameters<typeof TestManagementService.prototype.load extends () => Promise<void> ? never : never>[0],
		} as ConstructorParameters<typeof TestManagementService>[0]);
	});

	describe("lifecycle", () => {
		it("loads state from storage", async () => {
			await service.load();
			expect(storage.load).toHaveBeenCalledOnce();
		});

		it("emits hub.loaded on load", async () => {
			await service.load();
			expect(eventBus.emit).toHaveBeenCalledWith("test-mgmt.hub.loaded", {
				journeyCount: 0,
				coveragePercent: 0,
			});
		});

		it("restores persisted journeys on load", async () => {
			storage = createMockStorage({
				journeys: [{
					name: "Existing",
					type: "functional",
					actors: [],
					services: [],
					stepCount: 2,
					tools: [],
					jsonPath: "test.json",
					complianceTags: [],
					runHistory: [],
				}],
			});
			service = new TestManagementService({ storage: storage as never, eventBus: eventBus as never });
			await service.load();

			expect(service.getJourneys()).toHaveLength(1);
			expect(service.getJourneys()[0].name).toBe("Existing");
		});

		it("dispose cleans up subscriptions", async () => {
			await service.load();
			service.dispose();
			// No error thrown — subscriptions cleaned
		});
	});

	describe("registerJourney", () => {
		beforeEach(async () => { await service.load(); });

		it("registers a valid journey definition", () => {
			const entry = service.registerJourney({
				journey: "New Journey",
				type: "smoke",
				domain: "hub",
				steps: [{ id: "s1", title: "Step 1", actions: [{ tool: "click" }] }],
			});

			expect(entry).not.toBeNull();
			expect(entry!.name).toBe("New Journey");
			expect(service.getJourneys()).toHaveLength(1);
		});

		it("returns null for invalid JSON", () => {
			expect(service.registerJourney({})).toBeNull();
			expect(service.getJourneys()).toHaveLength(0);
		});

		it("emits journey.registered event", () => {
			service.registerJourney({ journey: "Test", steps: [] });
			expect(eventBus.emit).toHaveBeenCalledWith("test-mgmt.journey.registered", {
				name: "Test",
				domain: undefined,
				stepCount: 0,
			});
		});

		it("upserts: replaces existing entry with same name", () => {
			service.registerJourney({ journey: "A", steps: [{ id: "s1", actions: [] }] });
			service.registerJourney({ journey: "A", steps: [{ id: "s1", actions: [] }, { id: "s2", actions: [] }] });

			expect(service.getJourneys()).toHaveLength(1);
			expect(service.getJourneys()[0].stepCount).toBe(2);
		});

		it("preserves run history on upsert", () => {
			service.registerJourney({ journey: "A", steps: [] });
			service.recordRunResult("A", { totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000, date: "2026-03-01" });

			// Re-register same journey
			service.registerJourney({ journey: "A", steps: [{ id: "s1", actions: [] }] });

			const entry = service.getJourneyByName("A")!;
			expect(entry.runHistory).toHaveLength(1);
			expect(entry.lastRunResult).toBeDefined();
		});

		it("saves to storage after register", () => {
			service.registerJourney({ journey: "A", steps: [] });
			expect(storage.save).toHaveBeenCalled();
		});
	});

	describe("deregisterJourney", () => {
		beforeEach(async () => { await service.load(); });

		it("removes a registered journey", () => {
			service.registerJourney({ journey: "A", steps: [] });
			const removed = service.deregisterJourney("A");
			expect(removed).toBe(true);
			expect(service.getJourneys()).toHaveLength(0);
		});

		it("returns false for non-existent journey", () => {
			expect(service.deregisterJourney("X")).toBe(false);
		});

		it("emits journey.deregistered event", () => {
			service.registerJourney({ journey: "A", steps: [] });
			service.deregisterJourney("A");
			expect(eventBus.emit).toHaveBeenCalledWith("test-mgmt.journey.deregistered", { name: "A" });
		});
	});

	describe("recordRunResult", () => {
		beforeEach(async () => { await service.load(); });

		it("records a run result on an existing journey", () => {
			service.registerJourney({ journey: "A", steps: [] });
			service.recordRunResult("A", { totalSteps: 5, passed: 4, failed: 1, skipped: 0, durationMs: 2000, date: "2026-03-05" });

			const entry = service.getJourneyByName("A")!;
			expect(entry.runHistory).toHaveLength(1);
			expect(entry.lastRunResult!.failed).toBe(1);
		});

		it("ignores run result for unknown journey", () => {
			service.recordRunResult("X", { totalSteps: 1, passed: 1, failed: 0, skipped: 0, durationMs: 100 });
			// No error — silently ignored
		});

		it("emits status-changed when status transitions", () => {
			service.registerJourney({ journey: "A", steps: [] });
			// First run: never-run → failing
			service.recordRunResult("A", { totalSteps: 3, passed: 2, failed: 1, skipped: 0, durationMs: 500, date: new Date().toISOString() });

			expect(eventBus.emit).toHaveBeenCalledWith("test-mgmt.journey.status-changed", {
				name: "A",
				oldStatus: "never-run",
				newStatus: "failing",
			});
		});

		it("emits run-completed event", () => {
			service.registerJourney({ journey: "A", steps: [] });
			service.recordRunResult("A", { totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 500, date: "2026-03-05" });

			expect(eventBus.emit).toHaveBeenCalledWith("test-mgmt.journey.run-completed", {
				name: "A",
				passed: 3,
				failed: 0,
				skipped: 0,
			});
		});
	});

	describe("compliance tags", () => {
		beforeEach(async () => { await service.load(); });

		it("adds a compliance tag to a journey", () => {
			service.addComplianceTag("Journey A", "iso-9001:customer-focus");
			const scores = service.getCompliance();
			const iso9001 = scores.find((s) => s.standard === "iso-9001")!;
			expect(iso9001.covered).toBe(1);
		});

		it("removes a compliance tag", () => {
			service.addComplianceTag("Journey A", "iso-9001:customer-focus");
			service.removeComplianceTag("Journey A", "iso-9001:customer-focus");
			const scores = service.getCompliance();
			const iso9001 = scores.find((s) => s.standard === "iso-9001")!;
			expect(iso9001.covered).toBe(0);
		});

		it("does not duplicate tags", () => {
			service.addComplianceTag("Journey A", "iso-9001:customer-focus");
			service.addComplianceTag("Journey A", "iso-9001:customer-focus");
			const scores = service.getCompliance();
			const iso9001 = scores.find((s) => s.standard === "iso-9001")!;
			expect(iso9001.covered).toBe(1);
		});
	});

	describe("scan on load", () => {
		it("registers journeys from scanner callback on load", async () => {
			const scanner = vi.fn(async () => [
				{ json: { journey: "Scanned A", steps: [{ id: "s1", actions: [] }] }, path: "journeys/A.json" },
				{ json: { journey: "Scanned B", steps: [], type: "smoke" }, path: "journeys/B.json" },
			]);
			service = new TestManagementService({ storage: storage as never, eventBus: eventBus as never, scanJourneys: scanner });
			await service.load();

			expect(scanner).toHaveBeenCalledOnce();
			expect(service.getJourneys()).toHaveLength(2);
			expect(service.getJourneys()[0].name).toBe("Scanned A");
			expect(service.getJourneys()[0].jsonPath).toBe("journeys/A.json");
		});

		it("preserves run history when rescanning existing journey", async () => {
			// Pre-seed a journey with run history
			storage = createMockStorage({
				journeys: [{
					name: "A",
					type: "functional",
					actors: [],
					services: [],
					stepCount: 1,
					tools: [],
					jsonPath: "old.json",
					complianceTags: [],
					runHistory: [{ date: "2026-03-05", totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000 }],
					lastRunResult: { date: "2026-03-05", totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000 },
				}],
			});
			const scanner = vi.fn(async () => [
				{ json: { journey: "A", steps: [{ id: "s1", actions: [] }, { id: "s2", actions: [] }] }, path: "journeys/A.json" },
			]);
			service = new TestManagementService({ storage: storage as never, eventBus: eventBus as never, scanJourneys: scanner });
			await service.load();

			const entry = service.getJourneyByName("A")!;
			expect(entry.runHistory).toHaveLength(1);
			expect(entry.lastRunResult).toBeDefined();
			expect(entry.stepCount).toBe(2); // Updated from scan
			expect(entry.jsonPath).toBe("journeys/A.json");
		});

		it("skips invalid JSON files from scanner", async () => {
			const scanner = vi.fn(async () => [
				{ json: { notAJourney: true }, path: "bad.json" }, // invalid — no 'journey' field
				{ json: { journey: "Valid", steps: [] }, path: "good.json" },
			]);
			service = new TestManagementService({ storage: storage as never, eventBus: eventBus as never, scanJourneys: scanner });
			await service.load();

			expect(service.getJourneys()).toHaveLength(1);
			expect(service.getJourneys()[0].name).toBe("Valid");
		});

		it("handles scanner failure gracefully", async () => {
			const scanner = vi.fn(async () => { throw new Error("Vault read failed"); });
			service = new TestManagementService({ storage: storage as never, eventBus: eventBus as never, scanJourneys: scanner });
			await service.load(); // Should not throw

			expect(service.getJourneys()).toHaveLength(0);
		});

		it("loads without scanner when not provided", async () => {
			service = new TestManagementService({ storage: storage as never, eventBus: eventBus as never });
			await service.load();

			expect(service.getJourneys()).toHaveLength(0);
		});

		it("setScanner allows setting scanner after construction", async () => {
			const scanner = vi.fn(async () => [
				{ json: { journey: "Late", steps: [] }, path: "late.json" },
			]);
			service = new TestManagementService({ storage: storage as never, eventBus: eventBus as never });
			service.setScanner(scanner);
			await service.load();

			expect(service.getJourneys()).toHaveLength(1);
			expect(service.getJourneys()[0].name).toBe("Late");
		});
	});

	describe("queries", () => {
		beforeEach(async () => { await service.load(); });

		it("getJourneyByName returns entry or undefined", () => {
			service.registerJourney({ journey: "A", steps: [] });
			expect(service.getJourneyByName("A")).toBeDefined();
			expect(service.getJourneyByName("X")).toBeUndefined();
		});

		it("getPyramid returns pyramid state", () => {
			service.registerJourney({ journey: "A", steps: [] });
			const pyramid = service.getPyramid();
			expect(pyramid.e2e.count).toBe(1);
			expect(pyramid.flow.count).toBe(0);
			expect(pyramid.unit.count).toBe(0);
		});

		it("getCoverage returns coverage entries", () => {
			service.registerJourney({ journey: "A", domain: "analytics", steps: [] });
			const coverage = service.getCoverage([
				{ name: "Analytics PRD", stage: "done", domain: "analytics" },
			]);
			expect(coverage).toHaveLength(1);
			expect(coverage[0].journeyCount).toBe(1);
		});
	});

	describe("baseline", () => {
		beforeEach(async () => { await service.load(); });

		it("setBaseline persists pyramid baseline to storage", () => {
			service.registerJourney({ journey: "A", steps: [] });
			service.setBaseline();

			expect(storage.save).toHaveBeenCalled();
			const baseline = service.getBaseline();
			expect(baseline).toBeDefined();
			expect(baseline!.e2e.count).toBe(1);
		});

		it("getBaseline returns undefined when not set", () => {
			expect(service.getBaseline()).toBeUndefined();
		});

		it("getPyramidWithTrends applies trend comparison from baseline", () => {
			service.registerJourney({ journey: "A", steps: [] });
			service.setBaseline();

			// Register more journeys → count goes up
			service.registerJourney({ journey: "B", steps: [] });
			service.registerJourney({ journey: "C", steps: [] });

			const trended = service.getPyramidWithTrends();
			expect(trended.e2e.count).toBe(3);
			expect(trended.e2e.trend).toBe("up"); // 3 > 1
		});
	});
});
