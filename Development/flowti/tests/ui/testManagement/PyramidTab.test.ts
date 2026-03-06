// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { PyramidTab } from "../../../src/ui/testManagement/PyramidTab";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { JourneyRegistryEntry, TestPyramidState } from "../../../src/domain/testManagement/types";

// ── Helpers ──────────────────────────────────────────────

function makeJourney(name: string, failed = 0): JourneyRegistryEntry {
	return {
		name,
		type: "functional",
		actors: [],
		services: [],
		stepCount: 3,
		tools: [],
		jsonPath: `${name}.json`,
		complianceTags: [],
		lastRunResult: { date: new Date().toISOString(), totalSteps: 3, passed: 3 - failed, failed, skipped: 0, durationMs: 1000 },
		runHistory: [{ date: new Date().toISOString(), totalSteps: 3, passed: 3 - failed, failed, skipped: 0, durationMs: 1000 }],
	};
}

function createMockService(
	journeys: JourneyRegistryEntry[] = [],
	baseline?: TestPyramidState,
): TestManagementService {
	const e2ePassCount = journeys.filter((j) => j.lastRunResult && j.lastRunResult.failed === 0).length;
	const passRate = journeys.length > 0 ? Math.round((e2ePassCount / journeys.length) * 100) : 0;

	const pyramid: TestPyramidState = {
		e2e: { count: journeys.length, passRate, trend: "stable" },
		flow: { count: 0, passRate: 0, trend: "stable" },
		unit: { count: 0, passRate: 0, trend: "stable" },
	};

	return {
		getJourneys: vi.fn(() => journeys),
		getPyramid: vi.fn(() => pyramid),
		getPyramidWithTrends: vi.fn(() => {
			if (!baseline) return pyramid;
			// Simple trend calculation for testing
			return {
				e2e: { ...pyramid.e2e, trend: pyramid.e2e.count > baseline.e2e.count ? "up" : pyramid.e2e.count < baseline.e2e.count ? "down" : "stable" },
				flow: { ...pyramid.flow, trend: "stable" },
				unit: { ...pyramid.unit, trend: "stable" },
			};
		}),
		getBaseline: vi.fn(() => baseline),
		setBaseline: vi.fn(),
	} as unknown as TestManagementService;
}

function createMockEventBus(): IEventBus {
	return { on: vi.fn(() => () => {}), emit: vi.fn() } as unknown as IEventBus;
}

function createElements(): { masterEl: HTMLElement; detailEl: HTMLElement } {
	return {
		masterEl: document.createElement("div"),
		detailEl: document.createElement("div"),
	};
}

// ── Tests ────────────────────────────────────────────────

describe("PyramidTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let eventBus: IEventBus;

	beforeEach(() => {
		({ masterEl, detailEl } = createElements());
		eventBus = createMockEventBus();
	});

	// ── Visualization ──────────────────────────────────────

	describe("visualization", () => {
		it("renders 3 layer cards", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A")]),
				eventBus,
			});
			tab.render("");

			const cards = masterEl.querySelectorAll(".ft-tm-pyramid-card");
			expect(cards).toHaveLength(3);
		});

		it("shows E2E count and pass rate", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A"), makeJourney("B")]),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("2 journeys");
			expect(masterEl.textContent).toContain("100% pass rate");
		});

		it("shows Flow/Unit as dimmed when count is 0", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A")]),
				eventBus,
			});
			tab.render("");

			const dimmed = masterEl.querySelectorAll(".ft-tm-pyramid-card--dimmed");
			expect(dimmed).toHaveLength(2); // Flow and Unit
		});

		it("does not dim E2E even when count is 0", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([]),
				eventBus,
			});
			tab.render("");

			const dimmed = masterEl.querySelectorAll(".ft-tm-pyramid-card--dimmed");
			expect(dimmed).toHaveLength(2); // Only Flow and Unit
		});

		it("shows trend icons when baseline exists", () => {
			const baseline: TestPyramidState = {
				e2e: { count: 1, passRate: 100, trend: "stable" },
				flow: { count: 0, passRate: 0, trend: "stable" },
				unit: { count: 0, passRate: 0, trend: "stable" },
			};
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A"), makeJourney("B")], baseline),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelector(".ft-tm-trend--up")).not.toBeNull();
		});

		it("highlights E2E card as active by default", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A")]),
				eventBus,
			});
			tab.render("");

			const active = masterEl.querySelector(".ft-tm-pyramid-card--active");
			expect(active).not.toBeNull();
			expect((active as HTMLElement).dataset.layerId).toBe("e2e");
		});

		it("shows Set baseline button", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A")]),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("Set baseline");
		});
	});

	// ── Drill-down ─────────────────────────────────────────

	describe("drill-down", () => {
		it("E2E drill-down shows journey list", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("Alpha"), makeJourney("Beta")]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Alpha");
			expect(detailEl.textContent).toContain("Beta");
			expect(detailEl.querySelectorAll(".ft-tm-pyramid-drilldown-row")).toHaveLength(2);
		});

		it("E2E drill-down filters by search text", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("Login"), makeJourney("Checkout")]),
				eventBus,
			});
			tab.render("login");

			expect(detailEl.querySelectorAll(".ft-tm-pyramid-drilldown-row")).toHaveLength(1);
			expect(detailEl.textContent).toContain("Login");
		});

		it("Flow drill-down shows guidance callout", () => {
			const service = createMockService([makeJourney("A")]);
			const tab = new PyramidTab(masterEl, detailEl, { testManagementService: service, eventBus });
			tab.render("");

			// Click Flow card
			const cards = masterEl.querySelectorAll(".ft-tm-pyramid-card");
			(cards[1] as HTMLElement).click();

			expect(detailEl.textContent).toContain("Expert mode");
		});

		it("Unit drill-down shows guidance callout", () => {
			const service = createMockService([makeJourney("A")]);
			const tab = new PyramidTab(masterEl, detailEl, { testManagementService: service, eventBus });
			tab.render("");

			// Click Unit card
			const cards = masterEl.querySelectorAll(".ft-tm-pyramid-card");
			(cards[2] as HTMLElement).click();

			expect(detailEl.textContent).toContain("Expert mode");
			expect(detailEl.textContent).toContain("Unit Suites");
		});

		it("click layer changes selection and updates detail", () => {
			const service = createMockService([makeJourney("A")]);
			const tab = new PyramidTab(masterEl, detailEl, { testManagementService: service, eventBus });
			tab.render("");

			// Click Flow card
			const cards = masterEl.querySelectorAll(".ft-tm-pyramid-card");
			(cards[1] as HTMLElement).click();

			// Flow card should be active
			expect(cards[1].classList.contains("ft-tm-pyramid-card--active")).toBe(true);
			// E2E card should no longer be active
			expect(cards[0].classList.contains("ft-tm-pyramid-card--active")).toBe(false);
		});

		it("shows empty state when no journeys for E2E drill-down", () => {
			const tab = new PyramidTab(masterEl, detailEl, {
				testManagementService: createMockService([]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("No test data");
		});
	});

	// ── Baseline ───────────────────────────────────────────

	describe("baseline", () => {
		it("Set baseline button calls service.setBaseline", () => {
			const service = createMockService([makeJourney("A")]);
			const tab = new PyramidTab(masterEl, detailEl, { testManagementService: service, eventBus });
			tab.render("");

			const btn = masterEl.querySelector("button.mod-cta") as HTMLElement;
			btn.click();

			expect(service.setBaseline).toHaveBeenCalledOnce();
		});
	});
});
