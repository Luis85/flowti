// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TestManagementDashboard } from "../../../src/ui/testManagement/TestManagementDashboard";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { JourneyRegistryEntry, JourneyRunSummary } from "../../../src/domain/testManagement/types";

// ── Helpers ──────────────────────────────────────────────

function makeJourney(name: string, lastRun?: Partial<JourneyRunSummary>): JourneyRegistryEntry {
	return {
		name,
		type: "functional",
		actors: [],
		services: [],
		stepCount: 3,
		tools: [],
		jsonPath: `${name}.json`,
		complianceTags: [],
		runHistory: lastRun ? [{ date: "2026-03-05", totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000, ...lastRun }] : [],
		lastRunResult: lastRun ? { date: "2026-03-05", totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000, ...lastRun } : undefined,
	};
}

function createMockService(journeys: JourneyRegistryEntry[] = []): TestManagementService {
	return {
		getJourneys: vi.fn(() => journeys),
		getPyramid: vi.fn(() => ({
			e2e: { count: journeys.length, passRate: journeys.length > 0 ? 80 : 0, trend: "stable" },
			flow: { count: 0, passRate: 0, trend: "stable" },
			unit: { count: 0, passRate: 0, trend: "stable" },
		})),
		getCompliance: vi.fn(() => [
			{ standard: "iso-9001", total: 6, covered: 3, percentage: 50, gaps: [] },
			{ standard: "iso-27001", total: 5, covered: 2, percentage: 40, gaps: [] },
			{ standard: "iso-25010", total: 8, covered: 4, percentage: 50, gaps: [] },
		]),
	} as unknown as TestManagementService;
}

function createContainer(): HTMLElement {
	return document.createElement("div");
}

// ── Tests ────────────────────────────────────────────────

describe("TestManagementDashboard", () => {
	let navigateTo: ReturnType<typeof vi.fn<(page: string) => void>>;
	let container: HTMLElement;

	beforeEach(() => {
		navigateTo = vi.fn<(page: string) => void>();
		container = createContainer();
	});

	describe("empty state", () => {
		it("renders empty state when no journeys", () => {
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService([]),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).toContain("No journeys registered");
		});

		it("does not render stat cards when empty", () => {
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService([]),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.querySelector(".ft-stat-grid")).toBeNull();
		});
	});

	describe("stat cards", () => {
		it("renders 4 stat cards", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 }), makeJourney("B", { passed: 2, failed: 1 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			const cards = container.querySelectorAll(".ft-stat-card");
			expect(cards).toHaveLength(4);
		});

		it("shows correct journey count", () => {
			const journeys = [makeJourney("A"), makeJourney("B"), makeJourney("C")];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).toContain("3");
			expect(container.textContent).toContain("Journeys");
		});

		it("shows passing count", () => {
			const journeys = [
				makeJourney("A", { passed: 3, failed: 0 }),
				makeJourney("B", { passed: 2, failed: 1 }),
			];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).toContain("Passing");
		});

		it("shows compliance percentage", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			// Average of 50, 40, 50 = 47
			expect(container.textContent).toContain("47%");
			expect(container.textContent).toContain("Compliance");
		});

		it("navigates to journeys tab on journey card click", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			const cards = container.querySelectorAll(".ft-stat-card");
			(cards[0] as HTMLElement).click();
			expect(navigateTo).toHaveBeenCalledWith("journeys");
		});
	});

	describe("mini pyramid", () => {
		it("renders 3 pyramid layers", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			const rows = container.querySelectorAll(".ft-tm-pyramid-row");
			expect(rows).toHaveLength(3);
		});

		it("shows E2E, Flow, Unit labels", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).toContain("E2E");
			expect(container.textContent).toContain("Flow");
			expect(container.textContent).toContain("Unit");
		});

		it("shows Test Pyramid heading", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).toContain("Test Pyramid");
		});
	});

	describe("recent runs", () => {
		it("renders recent run items", () => {
			const journeys = [
				makeJourney("A", { passed: 3, failed: 0, date: "2026-03-05T10:00:00Z" }),
				makeJourney("B", { passed: 2, failed: 1, date: "2026-03-04T10:00:00Z" }),
			];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			const items = container.querySelectorAll(".ft-tm-run-item");
			expect(items).toHaveLength(2);
		});

		it("shows Recent Runs heading", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).toContain("Recent Runs");
		});

		it("limits to 5 recent runs", () => {
			const journeys = Array.from({ length: 8 }, (_, i) =>
				makeJourney(`J${i}`, { passed: 3, failed: 0, date: `2026-03-0${i + 1}` }),
			);
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			const items = container.querySelectorAll(".ft-tm-run-item");
			expect(items).toHaveLength(5);
		});

		it("does not render recent runs when no runs exist", () => {
			const journeys = [makeJourney("A")]; // no lastRunResult
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).not.toContain("Recent Runs");
		});
	});

	describe("needs attention", () => {
		it("renders attention items for failing journeys", () => {
			const journeys = [
				makeJourney("Failing", { passed: 2, failed: 1 }),
				makeJourney("Passing", { passed: 3, failed: 0 }),
			];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).toContain("Needs Attention");
			expect(container.textContent).toContain("Failing");
		});

		it("does not render attention section when all passing", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			expect(container.textContent).not.toContain("Needs Attention");
		});

		it("navigates to journeys on attention item click", () => {
			const journeys = [makeJourney("Failing", { passed: 2, failed: 1 })];
			const dashboard = new TestManagementDashboard({
				testManagementService: createMockService(journeys),
				navigateTo,
			});
			dashboard.render(container);

			const item = container.querySelector(".ft-tm-attention-item") as HTMLElement;
			item?.click();
			expect(navigateTo).toHaveBeenCalledWith("journeys");
		});
	});
});
