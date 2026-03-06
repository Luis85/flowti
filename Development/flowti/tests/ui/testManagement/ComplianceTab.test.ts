// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { ComplianceTab } from "../../../src/ui/testManagement/ComplianceTab";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { ComplianceScore, JourneyRegistryEntry } from "../../../src/domain/testManagement/types";

// ── Helpers ──────────────────────────────────────────────

function makeScore(standard: string, covered = 0, total = 6, gaps: string[] = []): ComplianceScore {
	return {
		standard,
		total,
		covered,
		percentage: total > 0 ? Math.round((covered / total) * 100) : 0,
		gaps,
	};
}

function makeJourney(name: string, complianceTags: string[] = []): JourneyRegistryEntry {
	return {
		name,
		type: "functional",
		actors: [],
		services: [],
		stepCount: 3,
		tools: [],
		jsonPath: `${name}.json`,
		complianceTags,
		runHistory: [],
	} as JourneyRegistryEntry;
}

function createMockService(
	scores: ComplianceScore[] = [],
	journeys: JourneyRegistryEntry[] = [],
): TestManagementService {
	return {
		getCompliance: vi.fn(() => scores),
		getJourneys: vi.fn(() => journeys),
		getJourneyByName: vi.fn(() => undefined),
		addComplianceTag: vi.fn(),
		removeComplianceTag: vi.fn(),
		getPrds: vi.fn(() => []),
		getCoverage: vi.fn(() => []),
		getPyramid: vi.fn(() => ({ e2e: { count: 0, passRate: 0, trend: "stable" as const }, flow: { count: 0, passRate: 0, trend: "stable" as const }, unit: { count: 0, passRate: 0, trend: "stable" as const } })),
		getPyramidWithTrends: vi.fn(() => ({ e2e: { count: 0, passRate: 0, trend: "stable" as const }, flow: { count: 0, passRate: 0, trend: "stable" as const }, unit: { count: 0, passRate: 0, trend: "stable" as const } })),
		getBaseline: vi.fn(() => undefined),
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

function defaultScores(): ComplianceScore[] {
	return [
		makeScore("iso-9001", 2, 6, ["iso-9001:process-approach", "iso-9001:evidence-based-decisions", "iso-9001:continuous-improvement", "iso-9001:risk-based-thinking"]),
		makeScore("iso-27001", 0, 5, ["iso-27001:access-control", "iso-27001:data-classification", "iso-27001:incident-management", "iso-27001:business-continuity", "iso-27001:compliance-monitoring"]),
		makeScore("iso-25010", 1, 8, ["iso-25010:performance-efficiency", "iso-25010:compatibility", "iso-25010:usability", "iso-25010:reliability", "iso-25010:security", "iso-25010:maintainability", "iso-25010:portability"]),
	];
}

// ── Tests ────────────────────────────────────────────────

describe("ComplianceTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let eventBus: IEventBus;

	beforeEach(() => {
		({ masterEl, detailEl } = createElements());
		eventBus = createMockEventBus();
	});

	// ── Standard cards ─────────────────────────────────────

	describe("standard cards", () => {
		it("renders 3 standard cards", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelectorAll(".ft-tm-compliance-card")).toHaveLength(3);
		});

		it("shows standard name and score", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("ISO 9001");
			expect(masterEl.textContent).toContain("2/6 covered");
		});

		it("shows progress bar", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelectorAll(".ft-tm-domain-bar-bg")).toHaveLength(3);
		});

		it("highlights ISO 9001 by default", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			const active = masterEl.querySelector(".ft-tm-compliance-card--active") as HTMLElement;
			expect(active).not.toBeNull();
			expect(active.dataset.standardId).toBe("iso-9001");
		});

		it("click changes selected standard", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			const cards = masterEl.querySelectorAll(".ft-tm-compliance-card");
			(cards[1] as HTMLElement).click();

			expect(cards[1].classList.contains("ft-tm-compliance-card--active")).toBe(true);
			expect(cards[0].classList.contains("ft-tm-compliance-card--active")).toBe(false);
		});
	});

	// ── Characteristic list ────────────────────────────────

	describe("characteristic list", () => {
		it("shows characteristics for selected standard", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			// ISO 9001 has 6 characteristics
			expect(detailEl.querySelectorAll(".ft-tm-compliance-row")).toHaveLength(6);
		});

		it("shows covered and uncovered badges", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			expect(detailEl.querySelectorAll(".ft-tm-coverage-badge--covered").length).toBeGreaterThan(0);
			expect(detailEl.querySelectorAll(".ft-tm-coverage-badge--uncovered").length).toBeGreaterThan(0);
		});

		it("filters by search text", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("customer");

			const rows = detailEl.querySelectorAll(".ft-tm-compliance-row");
			expect(rows).toHaveLength(1);
			expect(detailEl.textContent).toContain("Customer Focus");
		});

		it("shows guidance for uncovered characteristics when expanded", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			// Click an uncovered characteristic to expand
			const rows = detailEl.querySelectorAll(".ft-tm-compliance-row-header");
			// Find the 3rd row (Process Approach - uncovered)
			(rows[2] as HTMLElement).click();

			expect(detailEl.textContent).toContain("Tag journeys that");
		});

		it("shows tagged journey names for covered characteristics when expanded", () => {
			const journeys = [makeJourney("Login Flow", ["iso-9001:customer-focus"])];
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores(), journeys),
				eventBus,
			});
			tab.render("");

			// Click first row (Customer Focus - covered)
			const rows = detailEl.querySelectorAll(".ft-tm-compliance-row-header");
			(rows[0] as HTMLElement).click();

			expect(detailEl.textContent).toContain("Login Flow");
		});

		it("shows empty state when filter matches nothing", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("nonexistent");

			expect(detailEl.textContent).toContain("No characteristics match");
		});
	});

	// ── Tag management ─────────────────────────────────────

	describe("tag management", () => {
		it("shows 'Tag journey' button for uncovered characteristics when expanded", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			// Expand an uncovered characteristic
			const rows = detailEl.querySelectorAll(".ft-tm-compliance-row-header");
			(rows[2] as HTMLElement).click(); // Process Approach - uncovered

			expect(detailEl.querySelector("button.mod-cta")).not.toBeNull();
			expect(detailEl.textContent).toContain("Tag journey");
		});

		it("clicking 'Tag journey' shows journey list", () => {
			const journeys = [makeJourney("Alpha"), makeJourney("Beta")];
			const service = createMockService(defaultScores(), journeys);
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: service,
				eventBus,
			});
			tab.render("");

			// Expand uncovered characteristic
			const rows = detailEl.querySelectorAll(".ft-tm-compliance-row-header");
			(rows[2] as HTMLElement).click();

			// Click "Tag journey" button
			const btn = detailEl.querySelector("button.mod-cta") as HTMLElement;
			btn.click();

			expect(detailEl.textContent).toContain("Alpha");
			expect(detailEl.textContent).toContain("Beta");
		});

		it("selecting journey calls addComplianceTag", () => {
			const journeys = [makeJourney("Alpha")];
			const service = createMockService(defaultScores(), journeys);
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: service,
				eventBus,
			});
			tab.render("");

			// Expand uncovered characteristic
			const rows = detailEl.querySelectorAll(".ft-tm-compliance-row-header");
			(rows[2] as HTMLElement).click();

			// Click "Tag journey" → show list
			const btn = detailEl.querySelector("button.mod-cta") as HTMLElement;
			btn.click();

			// Click journey option
			const option = detailEl.querySelector(".ft-tm-compliance-journey-option") as HTMLElement;
			option.click();

			expect(service.addComplianceTag).toHaveBeenCalledWith("Alpha", "iso-9001:process-approach");
		});

		it("remove button calls removeComplianceTag", () => {
			const journeys = [makeJourney("Login Flow", ["iso-9001:customer-focus"])];
			const service = createMockService(defaultScores(), journeys);
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: service,
				eventBus,
			});
			tab.render("");

			// Expand covered characteristic
			const rows = detailEl.querySelectorAll(".ft-tm-compliance-row-header");
			(rows[0] as HTMLElement).click(); // Customer Focus - covered

			// Click remove button
			const removeBtn = detailEl.querySelector(".ft-tm-compliance-tag-remove") as HTMLElement;
			removeBtn.click();

			expect(service.removeComplianceTag).toHaveBeenCalledWith("Login Flow", "iso-9001:customer-focus");
		});
	});

	// ── Selection ──────────────────────────────────────────

	describe("selection", () => {
		it("auto-selects ISO 9001 by default", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("ISO 9001");
			expect(detailEl.textContent).toContain("Quality Management");
		});

		it("resetSelection resets to ISO 9001", () => {
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(defaultScores()),
				eventBus,
			});
			tab.render("");

			// Switch to ISO 27001
			const cards = masterEl.querySelectorAll(".ft-tm-compliance-card");
			(cards[1] as HTMLElement).click();
			expect(detailEl.textContent).toContain("ISO 27001");

			// Reset and re-render
			tab.resetSelection();
			tab.render("");

			expect(detailEl.textContent).toContain("ISO 9001");
		});
	});

	// ── Lifecycle ──────────────────────────────────────────

	describe("lifecycle", () => {
		it("renders without errors with empty data", () => {
			const scores = [makeScore("iso-9001", 0, 6, []), makeScore("iso-27001", 0, 5, []), makeScore("iso-25010", 0, 8, [])];
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(scores),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelectorAll(".ft-tm-compliance-card")).toHaveLength(3);
		});

		it("shows all standards even when no tags exist", () => {
			const scores = [makeScore("iso-9001", 0, 6, []), makeScore("iso-27001", 0, 5, []), makeScore("iso-25010", 0, 8, [])];
			const tab = new ComplianceTab(masterEl, detailEl, {
				testManagementService: createMockService(scores),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("ISO 9001");
			expect(masterEl.textContent).toContain("ISO 27001");
			expect(masterEl.textContent).toContain("ISO 25010");
		});
	});
});
