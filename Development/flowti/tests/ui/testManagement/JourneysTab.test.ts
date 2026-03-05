// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { JourneysTab } from "../../../src/ui/testManagement/JourneysTab";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { JourneyRegistryEntry, JourneyRunSummary } from "../../../src/domain/testManagement/types";

// ── Helpers ──────────────────────────────────────────────

function makeRun(overrides: Partial<JourneyRunSummary> = {}): JourneyRunSummary {
	return { date: "2026-03-05T10:00:00Z", totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000, ...overrides };
}

function makeJourney(name: string, overrides: Partial<JourneyRegistryEntry> = {}): JourneyRegistryEntry {
	return {
		name,
		type: "functional",
		actors: [],
		services: [],
		stepCount: 3,
		tools: [],
		jsonPath: `${name}.json`,
		complianceTags: [],
		runHistory: [],
		...overrides,
	};
}

function createMockService(journeys: JourneyRegistryEntry[] = []): TestManagementService {
	return {
		getJourneys: vi.fn(() => journeys),
		getJourneyByName: vi.fn(() => undefined),
		getPyramid: vi.fn(() => ({
			e2e: { count: 0, passRate: 0, trend: "stable" },
			flow: { count: 0, passRate: 0, trend: "stable" },
			unit: { count: 0, passRate: 0, trend: "stable" },
		})),
		getCoverage: vi.fn(() => []),
		getCompliance: vi.fn(() => []),
	} as unknown as TestManagementService;
}

function createMockEventBus(): IEventBus {
	return {
		on: vi.fn(() => () => {}),
		emit: vi.fn(),
	} as unknown as IEventBus;
}

function createElements(): { masterEl: HTMLElement; detailEl: HTMLElement } {
	return {
		masterEl: document.createElement("div"),
		detailEl: document.createElement("div"),
	};
}

// ── Tests ────────────────────────────────────────────────

describe("JourneysTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let eventBus: IEventBus;

	beforeEach(() => {
		({ masterEl, detailEl } = createElements());
		eventBus = createMockEventBus();
	});

	// ── Master list ─────────────────────────────────────────

	describe("master list", () => {
		it("renders journey rows for registered journeys", () => {
			const journeys = [makeJourney("Alpha"), makeJourney("Beta")];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.render("");

			const rows = masterEl.querySelectorAll(".ft-tm-journey-row");
			expect(rows).toHaveLength(2);
		});

		it("shows journey name in each row", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("Login Flow")]),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("Login Flow");
		});

		it("shows status badge per row", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A")]),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelector(".ft-tm-status-badge--never-run")).not.toBeNull();
		});

		it("shows type badge per row", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { type: "regression" })]),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelector(".ft-tm-type-badge")?.textContent).toBe("regression");
		});

		it("shows step count per row", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { stepCount: 7 })]),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("7 steps");
		});

		it("shows last run date when available", () => {
			const run = makeRun({ date: "2026-03-04T10:00:00Z" });
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { lastRunResult: run, runHistory: [run] })]),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("2026-03-04");
		});

		it("renders empty state when no journeys", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("No journeys found");
		});

		it("renders empty state when all filtered out", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("Alpha")]),
				eventBus,
			});
			tab.setFilters({ typeFilter: "smoke" });
			tab.render("");

			expect(detailEl.textContent).toContain("No journeys found");
		});
	});

	// ── Filtering ──────────────────────────────────────────

	describe("filtering", () => {
		it("filters by name (case-insensitive)", () => {
			const journeys = [makeJourney("Login Flow"), makeJourney("Checkout")];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.render("login");

			const rows = masterEl.querySelectorAll(".ft-tm-journey-row");
			expect(rows).toHaveLength(1);
			expect(masterEl.textContent).toContain("Login Flow");
		});

		it("filters by domain", () => {
			const journeys = [
				makeJourney("A", { domain: "auth" }),
				makeJourney("B", { domain: "billing" }),
			];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.render("auth");

			const rows = masterEl.querySelectorAll(".ft-tm-journey-row");
			expect(rows).toHaveLength(1);
		});

		it("filters by type", () => {
			const journeys = [
				makeJourney("A", { type: "functional" }),
				makeJourney("B", { type: "smoke" }),
			];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.setFilters({ typeFilter: "smoke" });
			tab.render("");

			const rows = masterEl.querySelectorAll(".ft-tm-journey-row");
			expect(rows).toHaveLength(1);
			expect(masterEl.textContent).toContain("B");
		});

		it("filters by status", () => {
			const run = makeRun({ passed: 3, failed: 0 });
			const journeys = [
				makeJourney("Passing", { lastRunResult: run, runHistory: [run] }),
				makeJourney("NeverRun"),
			];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.setFilters({ statusFilter: "never-run" });
			tab.render("");

			const rows = masterEl.querySelectorAll(".ft-tm-journey-row");
			expect(rows).toHaveLength(1);
			expect(masterEl.textContent).toContain("NeverRun");
		});
	});

	// ── Selection ──────────────────────────────────────────

	describe("selection", () => {
		it("auto-selects first journey on initial render", () => {
			const journeys = [makeJourney("Alpha"), makeJourney("Beta")];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.render("");

			// Detail shows first journey
			expect(detailEl.textContent).toContain("Alpha");
			// First row has active class
			const rows = masterEl.querySelectorAll(".ft-list-item");
			expect(rows[0].classList.contains("ft-list-item-active")).toBe(true);
		});

		it("click row selects and renders detail", () => {
			const journeys = [makeJourney("Alpha"), makeJourney("Beta")];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.render("");

			// Click second row
			const rows = masterEl.querySelectorAll(".ft-tm-journey-row");
			(rows[1] as HTMLElement).click();

			expect(detailEl.textContent).toContain("Beta");
			expect(rows[1].classList.contains("ft-list-item-active")).toBe(true);
			expect(rows[0].classList.contains("ft-list-item-active")).toBe(false);
		});

		it("preserves selection across re-renders", () => {
			const journeys = [makeJourney("Alpha"), makeJourney("Beta")];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.render("");

			// Select Beta
			const rows = masterEl.querySelectorAll(".ft-tm-journey-row");
			(rows[1] as HTMLElement).click();

			// Re-render
			tab.render("");

			expect(detailEl.textContent).toContain("Beta");
			const updatedRows = masterEl.querySelectorAll(".ft-list-item");
			expect(updatedRows[1].classList.contains("ft-list-item-active")).toBe(true);
		});

		it("resetSelection clears selection and filters", () => {
			const journeys = [makeJourney("Alpha", { type: "smoke" })];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService(journeys),
				eventBus,
			});
			tab.setFilters({ typeFilter: "smoke" });
			tab.render("");
			tab.resetSelection();
			tab.render("");

			// All journeys shown (filter reset to "all")
			expect(masterEl.querySelectorAll(".ft-tm-journey-row")).toHaveLength(1);
		});
	});

	// ── Detail panel ──────────────────────────────────────

	describe("detail panel", () => {
		it("renders journey name in header", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("Login Flow")]),
				eventBus,
			});
			tab.render("");

			const h3 = detailEl.querySelector("h3");
			expect(h3?.textContent).toBe("Login Flow");
		});

		it("shows type and domain info", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { type: "regression", domain: "auth" })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("regression");
			expect(detailEl.textContent).toContain("auth");
		});

		it("shows chapter when present", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { chapter: 5 })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Ch. 5");
		});

		it("shows step count in header", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { stepCount: 12 })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("12 steps");
		});

		it("renders run history entries (sorted newest first)", () => {
			const runs: JourneyRunSummary[] = [
				makeRun({ date: "2026-03-01T10:00:00Z", passed: 3, failed: 0 }),
				makeRun({ date: "2026-03-05T10:00:00Z", passed: 2, failed: 1 }),
			];
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { runHistory: runs, lastRunResult: runs[1] })]),
				eventBus,
			});
			tab.render("");

			const historyRows = detailEl.querySelectorAll(".ft-tm-run-history-row");
			expect(historyRows).toHaveLength(2);
			// First row should be the newest date
			expect(historyRows[0].textContent).toContain("2026-03-05");
			expect(historyRows[1].textContent).toContain("2026-03-01");
		});

		it("shows 'No runs recorded' when no history", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A")]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("No runs recorded");
		});

		it("renders actors as chips", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { actors: ["Admin", "User"] })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Actors");
			expect(detailEl.textContent).toContain("Admin");
			expect(detailEl.textContent).toContain("User");
			expect(detailEl.querySelectorAll(".ft-tm-chip").length).toBeGreaterThanOrEqual(2);
		});

		it("renders services as chips", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { services: ["AuthService"] })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Services");
			expect(detailEl.textContent).toContain("AuthService");
		});

		it("renders tools as chips", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { tools: ["command", "assert"] })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Tools");
			expect(detailEl.textContent).toContain("command");
			expect(detailEl.textContent).toContain("assert");
		});

		it("renders compliance tags as chips", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { complianceTags: ["iso-9001:7.1"] })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Compliance");
			expect(detailEl.textContent).toContain("iso-9001:7.1");
		});

		it("shows PRD when present", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { prd: "PRD-Auth-v2" })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("PRD:");
			expect(detailEl.textContent).toContain("PRD-Auth-v2");
		});

		it("shows JSON path in files section", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("Alpha")]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Files");
			expect(detailEl.textContent).toContain("Alpha.json");
		});

		it("shows canvas and test source paths when present", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([
					makeJourney("A", { canvasPath: "A.canvas", testSourcePath: "tests/A.test.ts" }),
				]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Canvas");
			expect(detailEl.textContent).toContain("A.canvas");
			expect(detailEl.textContent).toContain("Test Source");
			expect(detailEl.textContent).toContain("tests/A.test.ts");
		});

		it("does not render traceability section when no traceability data", () => {
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A")]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).not.toContain("Traceability");
		});

		it("shows run result counts", () => {
			const run = makeRun({ passed: 2, failed: 1, skipped: 1, totalSteps: 4 });
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { runHistory: [run], lastRunResult: run })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("2/4 passed");
			expect(detailEl.textContent).toContain("1 failed");
			expect(detailEl.textContent).toContain("1 skipped");
		});

		it("shows run duration", () => {
			const run = makeRun({ durationMs: 5000 });
			const tab = new JourneysTab(masterEl, detailEl, {
				testManagementService: createMockService([makeJourney("A", { runHistory: [run], lastRunResult: run })]),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("5s");
		});
	});
});
