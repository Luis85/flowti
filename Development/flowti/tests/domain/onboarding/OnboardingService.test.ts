import { describe, expect, it, vi, beforeEach } from "vitest";
import { OnboardingService } from "../../../src/domain/onboarding/OnboardingService";
import type { OnboardingState, OnboardingChecklist } from "../../../src/domain/onboarding/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Test helpers ──────────────────────────────────────────

function createMockStorage(): ITypedStorage<OnboardingState> {
	let data: OnboardingState | undefined;
	return {
		load: vi.fn(async () => data),
		save: vi.fn(async (state: OnboardingState) => { data = state; }),
		safeLoad: vi.fn(async () => data),
		safeSave: vi.fn(async (state: OnboardingState) => { data = state; return true; }),
	} as unknown as ITypedStorage<OnboardingState>;
}

function createMockEventBus(): IEventBus {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		_emitted: emitted,
	} as unknown as IEventBus & { _emitted: typeof emitted };
}

describe("OnboardingService", () => {
	let service: OnboardingService;
	let storage: ITypedStorage<OnboardingState>;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(() => {
		storage = createMockStorage();
		eventBus = createMockEventBus();
		service = new OnboardingService({ storage, eventBus });
	});

	// ── Load & init ──────────────────────────────────────────

	describe("load", () => {
		it("loads persisted state from storage", async () => {
			const saved: OnboardingState = {
				checklist: {
					dismissed: false,
					collapsed: true,
					milestones: {
						installed: true,
						dashboardExplored: true,
						sampleDataReviewed: false,
						ownDataImported: false,
						customQueryBuilt: false,
					},
				},
				dismissedCallouts: ["callout-1"],
				firstVisits: { "analytics": "2026-02-26T00:00:00Z" },
				startedAt: "2026-02-26T00:00:00Z",
			};
			vi.mocked(storage.load).mockResolvedValue(saved);

			await service.load();

			expect(service.getState()).toEqual(saved);
		});

		it("migrates legacy checklist from AnalyticsState", async () => {
			vi.mocked(storage.load).mockResolvedValue(undefined);
			const legacyChecklist: OnboardingChecklist = {
				dismissed: false,
				collapsed: false,
				milestones: {
					installed: true,
					dashboardExplored: true,
					sampleDataReviewed: false,
					ownDataImported: false,
					customQueryBuilt: false,
				},
			};
			service = new OnboardingService({
				storage,
				eventBus,
				readLegacyChecklist: () => legacyChecklist,
			});

			await service.load();

			const state = service.getState();
			expect(state).toBeDefined();
			expect(state!.checklist).toEqual(legacyChecklist);
			expect(state!.dismissedCallouts).toEqual([]);
			expect(state!.firstVisits).toEqual({});
			expect(state!.startedAt).toBeDefined();
			expect(storage.save).toHaveBeenCalledTimes(1);
		});

		it("does not migrate if onboarding state already exists", async () => {
			const existing: OnboardingState = {
				checklist: {
					dismissed: true,
					collapsed: false,
					milestones: {
						installed: true,
						dashboardExplored: true,
						sampleDataReviewed: true,
						ownDataImported: true,
						customQueryBuilt: true,
					},
				},
				dismissedCallouts: [],
				firstVisits: {},
				startedAt: "2026-02-26T00:00:00Z",
				completedAt: "2026-02-26T01:00:00Z",
			};
			vi.mocked(storage.load).mockResolvedValue(existing);
			const readLegacy = vi.fn(() => undefined);
			service = new OnboardingService({
				storage,
				eventBus,
				readLegacyChecklist: readLegacy,
			});

			await service.load();

			expect(readLegacy).not.toHaveBeenCalled();
			expect(storage.save).not.toHaveBeenCalled();
		});

		it("remains uninitialised when no state and no legacy", async () => {
			vi.mocked(storage.load).mockResolvedValue(undefined);

			await service.load();

			expect(service.getState()).toBeUndefined();
			expect(service.getChecklist()).toBeUndefined();
		});
	});

	// ── Checklist ────────────────────────────────────────────

	describe("checklist", () => {
		it("returns undefined before initialisation", () => {
			expect(service.getChecklist()).toBeUndefined();
		});

		it("initialises checklist with installed milestone set", async () => {
			await service.initChecklist();

			const checklist = service.getChecklist();
			expect(checklist).toBeDefined();
			expect(checklist!.dismissed).toBe(false);
			expect(checklist!.collapsed).toBe(false);
			expect(checklist!.milestones.installed).toBe(true);
			expect(checklist!.milestones.dashboardExplored).toBe(false);
			expect(checklist!.milestones.customQueryBuilt).toBe(false);
		});

		it("persists state to storage on init", async () => {
			await service.initChecklist();

			expect(storage.save).toHaveBeenCalled();
			const saveCalls = vi.mocked(storage.save).mock.calls;
			const lastSave = saveCalls[saveCalls.length - 1][0];
			expect(lastSave.checklist).toBeDefined();
			expect(lastSave.checklist.milestones.installed).toBe(true);
		});

		it("is idempotent — second init is a no-op", async () => {
			await service.initChecklist();
			const callCount = vi.mocked(storage.save).mock.calls.length;

			await service.initChecklist();

			expect(vi.mocked(storage.save).mock.calls.length).toBe(callCount);
		});

		it("updates milestones via partial merge", async () => {
			await service.initChecklist();

			await service.updateChecklist({
				milestones: { dashboardExplored: true } as never,
			});

			const checklist = service.getChecklist()!;
			expect(checklist.milestones.dashboardExplored).toBe(true);
			expect(checklist.milestones.installed).toBe(true); // preserved
		});

		it("update is no-op when not initialised", async () => {
			const callCount = vi.mocked(storage.save).mock.calls.length;

			await service.updateChecklist({
				milestones: { dashboardExplored: true } as never,
			});

			expect(vi.mocked(storage.save).mock.calls.length).toBe(callCount);
		});

		it("dismisses the checklist", async () => {
			await service.initChecklist();

			await service.dismissChecklist();

			expect(service.getChecklist()!.dismissed).toBe(true);
		});

		it("dismiss is no-op when not initialised", async () => {
			const callCount = vi.mocked(storage.save).mock.calls.length;

			await service.dismissChecklist();

			expect(vi.mocked(storage.save).mock.calls.length).toBe(callCount);
		});

		it("updates non-milestone fields", async () => {
			await service.initChecklist();

			await service.updateChecklist({ collapsed: true });

			expect(service.getChecklist()!.collapsed).toBe(true);
		});
	});

	// ── First-visit tracking ─────────────────────────────────

	describe("first-visit tracking", () => {
		beforeEach(async () => {
			await service.initChecklist();
		});

		it("reports not visited for unknown view", () => {
			expect(service.hasVisited("event-catalog")).toBe(false);
		});

		it("records first visit and persists", async () => {
			await service.recordFirstVisit("event-catalog");

			expect(service.hasVisited("event-catalog")).toBe(true);
			const state = service.getState()!;
			expect(state.firstVisits["event-catalog"]).toBeDefined();
		});

		it("is idempotent — second record does not overwrite", async () => {
			await service.recordFirstVisit("event-catalog");
			const firstTimestamp = service.getState()!.firstVisits["event-catalog"];
			vi.mocked(storage.save).mockClear();

			await service.recordFirstVisit("event-catalog");

			expect(service.getState()!.firstVisits["event-catalog"]).toBe(firstTimestamp);
			expect(storage.save).not.toHaveBeenCalled();
		});

		it("tracks multiple views independently", async () => {
			await service.recordFirstVisit("event-catalog");
			await service.recordFirstVisit("data-exchange");

			expect(service.hasVisited("event-catalog")).toBe(true);
			expect(service.hasVisited("data-exchange")).toBe(true);
			expect(service.hasVisited("user-hub")).toBe(false);
		});

		it("returns false when service not initialised", () => {
			const uninitService = new OnboardingService({ storage, eventBus });
			expect(uninitService.hasVisited("analytics")).toBe(false);
		});

		it("record is no-op when service not initialised", async () => {
			const freshStorage = createMockStorage();
			const uninitService = new OnboardingService({ storage: freshStorage, eventBus });

			await uninitService.recordFirstVisit("analytics");

			expect(freshStorage.save).not.toHaveBeenCalled();
		});
	});

	// ── Callout tracking ─────────────────────────────────────

	describe("callout tracking", () => {
		beforeEach(async () => {
			await service.initChecklist();
		});

		it("reports callout not dismissed initially", () => {
			expect(service.isCalloutDismissed("event-catalog-callout")).toBe(false);
		});

		it("marks callout as dismissed and persists", async () => {
			await service.markCalloutDismissed("event-catalog-callout");

			expect(service.isCalloutDismissed("event-catalog-callout")).toBe(true);
		});

		it("is idempotent — does not duplicate callout IDs", async () => {
			await service.markCalloutDismissed("callout-1");
			await service.markCalloutDismissed("callout-1");

			expect(service.getState()!.dismissedCallouts).toEqual(["callout-1"]);
		});

		it("tracks multiple callouts", async () => {
			await service.markCalloutDismissed("callout-1");
			await service.markCalloutDismissed("callout-2");

			expect(service.isCalloutDismissed("callout-1")).toBe(true);
			expect(service.isCalloutDismissed("callout-2")).toBe(true);
			expect(service.isCalloutDismissed("callout-3")).toBe(false);
		});

		it("returns false when service not initialised", () => {
			const uninitService = new OnboardingService({ storage, eventBus });
			expect(uninitService.isCalloutDismissed("x")).toBe(false);
		});
	});

	// ── Reset ────────────────────────────────────────────────

	describe("resetAll", () => {
		it("resets all state to defaults", async () => {
			await service.initChecklist();
			await service.updateChecklist({ milestones: { dashboardExplored: true } as never });
			await service.markCalloutDismissed("callout-1");
			await service.recordFirstVisit("analytics");

			await service.resetAll();

			const state = service.getState()!;
			expect(state.checklist.dismissed).toBe(false);
			expect(state.checklist.milestones.dashboardExplored).toBe(false);
			expect(state.checklist.milestones.installed).toBe(true);
			expect(state.dismissedCallouts).toEqual([]);
			expect(state.firstVisits).toEqual({});
			expect(state.startedAt).toBeDefined();
		});

		it("persists reset state to storage", async () => {
			await service.initChecklist();
			vi.mocked(storage.save).mockClear();

			await service.resetAll();

			expect(storage.save).toHaveBeenCalledTimes(1);
		});
	});

	// ── Milestone helpers ────────────────────────────────────

	describe("milestone helpers", () => {
		it("returns 0 completed when not initialised", () => {
			expect(service.getCompletedMilestoneCount()).toBe(0);
		});

		it("returns 1 completed after init (installed)", async () => {
			await service.initChecklist();
			expect(service.getCompletedMilestoneCount()).toBe(1);
		});

		it("returns total milestone count", () => {
			expect(service.getTotalMilestoneCount()).toBe(7);
		});

		it("isComplete returns false when not all milestones done", async () => {
			await service.initChecklist();
			expect(service.isComplete()).toBe(false);
		});

		it("isComplete returns true when all milestones done", async () => {
			await service.initChecklist();
			await service.updateChecklist({
				milestones: {
					installed: true,
					dashboardExplored: true,
					sampleDataReviewed: true,
					ownDataImported: true,
					customQueryBuilt: true,
					catalogExplored: true,
					startpageConfigured: true,
				},
			});
			expect(service.isComplete()).toBe(true);
		});

		it("isComplete returns false when not initialised", () => {
			expect(service.isComplete()).toBe(false);
		});
	});

	// ── Lifecycle events ────────────────────────────────────

	describe("lifecycle events", () => {
		it("emits onboarding.started when checklist is initialised", async () => {
			await service.initChecklist();

			expect(eventBus.emit).toHaveBeenCalledWith(
				"onboarding.started",
				expect.objectContaining({ startedAt: expect.any(String) }),
			);
		});

		it("does not emit started on second init (idempotent)", async () => {
			await service.initChecklist();
			vi.mocked(eventBus.emit).mockClear();

			await service.initChecklist();

			expect(eventBus.emit).not.toHaveBeenCalledWith(
				"onboarding.started",
				expect.anything(),
			);
		});

		it("emits onboarding.step.completed when a milestone transitions false→true", async () => {
			await service.initChecklist();
			vi.mocked(eventBus.emit).mockClear();

			await service.updateChecklist({
				milestones: { dashboardExplored: true } as never,
			});

			expect(eventBus.emit).toHaveBeenCalledWith(
				"onboarding.step.completed",
				expect.objectContaining({
					milestone: "dashboardExplored",
					completedCount: 2,
					totalCount: 7,
				}),
			);
		});

		it("does not emit step.completed for already-true milestones", async () => {
			await service.initChecklist();
			vi.mocked(eventBus.emit).mockClear();

			// installed is already true from init
			await service.updateChecklist({
				milestones: { installed: true } as never,
			});

			expect(eventBus.emit).not.toHaveBeenCalledWith(
				"onboarding.step.completed",
				expect.anything(),
			);
		});

		it("emits onboarding.completed when all milestones are done", async () => {
			await service.initChecklist();
			vi.mocked(eventBus.emit).mockClear();

			await service.updateChecklist({
				milestones: {
					installed: true,
					dashboardExplored: true,
					sampleDataReviewed: true,
					ownDataImported: true,
					customQueryBuilt: true,
					catalogExplored: true,
					startpageConfigured: true,
				},
			});

			expect(eventBus.emit).toHaveBeenCalledWith(
				"onboarding.completed",
				expect.objectContaining({
					completedAt: expect.any(String),
					durationMs: expect.any(Number),
				}),
			);
		});

		it("does not emit completed if already completed previously", async () => {
			await service.initChecklist();
			await service.updateChecklist({
				milestones: {
					installed: true,
					dashboardExplored: true,
					sampleDataReviewed: true,
					ownDataImported: true,
					customQueryBuilt: true,
					catalogExplored: true,
					startpageConfigured: true,
				},
			});
			vi.mocked(eventBus.emit).mockClear();

			// Update again with all true — should not re-emit completed
			await service.updateChecklist({
				milestones: { installed: true } as never,
			});

			expect(eventBus.emit).not.toHaveBeenCalledWith(
				"onboarding.completed",
				expect.anything(),
			);
		});

		it("emits onboarding.reset when resetAll is called", async () => {
			await service.initChecklist();
			vi.mocked(eventBus.emit).mockClear();

			await service.resetAll();

			expect(eventBus.emit).toHaveBeenCalledWith("onboarding.reset", {});
		});

		it("sets completedAt on state when all milestones are done", async () => {
			await service.initChecklist();
			await service.updateChecklist({
				milestones: {
					installed: true,
					dashboardExplored: true,
					sampleDataReviewed: true,
					ownDataImported: true,
					customQueryBuilt: true,
					catalogExplored: true,
					startpageConfigured: true,
				},
			});

			expect(service.getState()!.completedAt).toBeDefined();
		});
	});

	// ── C50 milestones ───────────────────────────────────────

	describe("C50 milestones (catalogExplored, startpageConfigured)", () => {
		it("should include new milestones in default checklist", async () => {
			await service.initChecklist();
			const ms = service.getMilestones()!;

			expect(ms.catalogExplored).toBe(false);
			expect(ms.startpageConfigured).toBe(false);
		});

		it("should update catalogExplored milestone", async () => {
			await service.initChecklist();
			await service.updateChecklist({ milestones: { catalogExplored: true } as never });

			expect(service.getMilestones()!.catalogExplored).toBe(true);
		});

		it("should update startpageConfigured milestone", async () => {
			await service.initChecklist();
			await service.updateChecklist({ milestones: { startpageConfigured: true } as never });

			expect(service.getMilestones()!.startpageConfigured).toBe(true);
		});

		it("should emit step.completed for catalogExplored", async () => {
			await service.initChecklist();
			vi.mocked(eventBus.emit).mockClear();

			await service.updateChecklist({ milestones: { catalogExplored: true } as never });

			expect(eventBus.emit).toHaveBeenCalledWith(
				"onboarding.step.completed",
				expect.objectContaining({ milestone: "catalogExplored" }),
			);
		});

		it("should emit step.completed for startpageConfigured", async () => {
			await service.initChecklist();
			vi.mocked(eventBus.emit).mockClear();

			await service.updateChecklist({ milestones: { startpageConfigured: true } as never });

			expect(eventBus.emit).toHaveBeenCalledWith(
				"onboarding.step.completed",
				expect.objectContaining({ milestone: "startpageConfigured" }),
			);
		});

		it("should not be complete with only original 5 milestones done", async () => {
			await service.initChecklist();
			await service.updateChecklist({
				milestones: {
					installed: true,
					dashboardExplored: true,
					sampleDataReviewed: true,
					ownDataImported: true,
					customQueryBuilt: true,
				},
			});

			expect(service.isComplete()).toBe(false);
		});

		it("should handle existing state without new milestones (backward compat)", async () => {
			// Simulate legacy persisted state that lacks new milestone fields
			const legacyState: OnboardingState = {
				checklist: {
					dismissed: false,
					collapsed: false,
					milestones: {
						installed: true,
						dashboardExplored: true,
						sampleDataReviewed: true,
						ownDataImported: true,
						customQueryBuilt: true,
					},
				},
				dismissedCallouts: [],
				firstVisits: {},
				startedAt: "2026-02-01T00:00:00Z",
			};
			vi.mocked(storage.load).mockResolvedValueOnce(legacyState);
			await service.load();

			// State loads without error
			expect(service.getState()).toBeDefined();
			// New milestones are undefined → isComplete returns false
			expect(service.isComplete()).toBe(false);
			// Completed count only includes original 5
			expect(service.getCompletedMilestoneCount()).toBe(5);
		});

		it("should report correct completedCount including new milestones", async () => {
			await service.initChecklist();
			await service.updateChecklist({
				milestones: { catalogExplored: true, startpageConfigured: true } as never,
			});

			// installed (true from init) + catalogExplored + startpageConfigured = 3
			expect(service.getCompletedMilestoneCount()).toBe(3);
		});
	});
});
