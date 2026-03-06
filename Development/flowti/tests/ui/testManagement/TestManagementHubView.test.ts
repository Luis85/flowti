// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TestManagementHubView } from "../../../src/ui/testManagement/TestManagementHubView";
import { VIEW_TYPE_TEST_MANAGEMENT_HUB } from "../../../src/domain/hub/types";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { OnboardingService } from "../../../src/domain/onboarding/OnboardingService";

// ── Helpers ──────────────────────────────────────────────

function createMockLeaf(): import("obsidian").WorkspaceLeaf {
	return {} as import("obsidian").WorkspaceLeaf;
}

function createMockService(): TestManagementService {
	const pyramid = {
		e2e: { count: 0, passRate: 0, trend: "stable" as const },
		flow: { count: 0, passRate: 0, trend: "stable" as const },
		unit: { count: 0, passRate: 0, trend: "stable" as const },
	};
	return {
		getJourneys: vi.fn(() => []),
		getJourneyByName: vi.fn(() => undefined),
		getPyramid: vi.fn(() => pyramid),
		getPyramidWithTrends: vi.fn(() => pyramid),
		getBaseline: vi.fn(() => undefined),
		setBaseline: vi.fn(),
		getPrds: vi.fn(() => []),
		getCoverage: vi.fn(() => []),
		getCompliance: vi.fn(() => []),
	} as unknown as TestManagementService;
}

function createMockOnboardingService(): OnboardingService {
	return {
		hasVisited: vi.fn(() => true),
		isCalloutDismissed: vi.fn(() => false),
		recordFirstVisit: vi.fn(async () => {}),
		markCalloutDismissed: vi.fn(async () => {}),
	} as unknown as OnboardingService;
}

/** Prepare containerEl for BaseHubView — needs 2 children (Obsidian adds them). */
function prepareContainerEl(view: TestManagementHubView): void {
	const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
	el.appendChild(document.createElement("div")); // [0] = header (hidden by ft-hide-header)
	el.appendChild(document.createElement("div")); // [1] = content area
}

// ── Tests ────────────────────────────────────────────────

describe("TestManagementHubView", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	// ── Identity ────────────────────────────────────────────

	describe("identity", () => {
		it("returns correct view type", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			expect(view.getViewType()).toBe(VIEW_TYPE_TEST_MANAGEMENT_HUB);
			expect(view.getViewType()).toBe("flowti-test-management-hub");
		});

		it("returns shield-check icon", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			expect(view.getIcon()).toBe("shield-check");
		});

		it("returns Test Management display text", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			expect(view.getDisplayText()).toBe("Test Management");
		});

		it("has hub ID 'test-management'", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			expect(view.getHubId()).toBe("test-management");
		});

		it("has hub type 'domain'", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			expect(view.getHubType()).toBe("domain");
		});
	});

	// ── Tab definitions ─────────────────────────────────────

	describe("tabs", () => {
		it("defines 4 tabs", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			const tabs = view.getTabDefinitions();
			expect(tabs).toHaveLength(4);
		});

		it("tab IDs are journeys, pyramid, coverage, compliance", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			const tabs = view.getTabDefinitions();
			expect(tabs.map((t) => t.id)).toEqual(["journeys", "pyramid", "coverage", "compliance"]);
		});

		it("each tab has a search placeholder", () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			const tabs = view.getTabDefinitions();
			for (const tab of tabs) {
				expect(tab.searchPlaceholder).toBeTruthy();
			}
		});
	});

	// ── Dashboard rendering ─────────────────────────────────

	describe("dashboard rendering", () => {
		it("renders dashboard with Test Management heading", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			expect(el.textContent).toContain("Test Management");
		});

		it("renders empty state when no journeys", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			expect(el.textContent).toContain("No journeys registered");
		});
	});

	// ── Tab rendering ──────────────────────────────────────

	describe("tab rendering", () => {
		beforeEach(() => { vi.useFakeTimers(); });
		afterEach(() => { vi.useRealTimers(); });

		it("renders journeys tab content (not placeholder)", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			// Navigate to journeys tab
			(view as unknown as { navigateTo: (p: string) => void }).navigateTo("journeys");
			vi.advanceTimersByTime(20);

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			// Journeys tab renders empty state (no journeys), not the placeholder
			expect(el.textContent).toContain("No journeys found");
			expect(el.textContent).not.toContain("Coming in a future increment");
		});

		it("renders pyramid tab content (not placeholder)", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			(view as unknown as { navigateTo: (p: string) => void }).navigateTo("pyramid");
			vi.advanceTimersByTime(20);

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			// Pyramid tab renders layer cards, not the placeholder
			expect(el.textContent).toContain("E2E Journeys");
			expect(el.textContent).not.toContain("Coming in a future increment");
		});

		it("renders coverage tab content (not placeholder)", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			(view as unknown as { navigateTo: (p: string) => void }).navigateTo("coverage");
			vi.advanceTimersByTime(20);

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			// Coverage tab renders empty state, not the placeholder
			expect(el.textContent).toContain("No PRDs found");
			expect(el.textContent).not.toContain("Coming in a future increment");
		});

		it("renders compliance tab content (not placeholder)", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			(view as unknown as { navigateTo: (p: string) => void }).navigateTo("compliance");
			vi.advanceTimersByTime(20);

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			// Compliance tab renders standard cards, not the placeholder
			expect(el.textContent).toContain("ISO 9001");
			expect(el.textContent).not.toContain("Coming in a future increment");
		});
	});

	// ── Cross-hub navigation ───────────────────────────────

	describe("cross-hub navigation", () => {
		beforeEach(() => { vi.useFakeTimers(); });
		afterEach(() => { vi.useRealTimers(); });

		it("onNavigateToEntity selects journey by name", async () => {
			const service = createMockService();
			(service.getJourneys as ReturnType<typeof vi.fn>).mockReturnValue([
				{ name: "Alpha", type: "functional", actors: [], services: [], stepCount: 1, tools: [], jsonPath: "a.json", complianceTags: [], runHistory: [] },
				{ name: "Beta", type: "functional", actors: [], services: [], stepCount: 2, tools: [], jsonPath: "b.json", complianceTags: [], runHistory: [] },
			]);
			const view = new TestManagementHubView(createMockLeaf(), eventBus, service, createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			// Navigate to journeys tab
			(view as unknown as { navigateTo: (p: string) => void }).navigateTo("journeys");
			vi.advanceTimersByTime(20);

			// Simulate entity navigation
			(view as unknown as { onNavigateToEntity: (tabId: string, entityId: string) => void }).onNavigateToEntity("journeys", "Beta");
			vi.advanceTimersByTime(20);

			const el = (view as unknown as { containerEl: HTMLElement }).containerEl;
			expect(el.textContent).toContain("Beta");
		});

		it("onNavigateToEntity with non-journeys tab is no-op", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			// Should not throw
			(view as unknown as { onNavigateToEntity: (tabId: string, entityId: string) => void }).onNavigateToEntity("pyramid", "something");
		});
	});

	// ── Lifecycle ──────────────────────────────────────────

	describe("lifecycle", () => {
		it("opens and closes without errors", async () => {
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();
			await view.onClose();
		});

		it("emits hub.opened on open", async () => {
			const emitSpy = vi.spyOn(eventBus, "emit");
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();

			expect(emitSpy).toHaveBeenCalledWith("hub.opened", {
				hubId: "test-management",
				hubType: "domain",
			});
		});

		it("emits hub.closed on close", async () => {
			const emitSpy = vi.spyOn(eventBus, "emit");
			const view = new TestManagementHubView(createMockLeaf(), eventBus, createMockService(), createMockOnboardingService());
			prepareContainerEl(view);
			await view.onOpen();
			await view.onClose();

			expect(emitSpy).toHaveBeenCalledWith("hub.closed", { hubId: "test-management" });
		});
	});
});
