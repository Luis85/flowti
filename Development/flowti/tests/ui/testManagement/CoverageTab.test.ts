// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { CoverageTab } from "../../../src/ui/testManagement/CoverageTab";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { CoverageEntry, CoverageStatus } from "../../../src/domain/testManagement/types";
import type { PrdInfo } from "../../../src/domain/testManagement/coverageCalculator";

// ── Helpers ──────────────────────────────────────────────

function makePrd(name: string, stage = "done", domain = "Flowti"): PrdInfo {
	return { name, stage, domain };
}

function makeEntry(
	prdName: string,
	status: CoverageStatus = "covered",
	opts: Partial<CoverageEntry> = {},
): CoverageEntry {
	return {
		prdName,
		prdStage: opts.prdStage ?? "done",
		domain: opts.domain ?? "Flowti",
		journeyCount: opts.journeyCount ?? (status === "uncovered" ? 0 : 1),
		journeyNames: opts.journeyNames ?? (status === "uncovered" ? [] : [`${prdName} Journey`]),
		status,
		...opts,
	};
}

function createMockService(prds: PrdInfo[] = [], entries: CoverageEntry[] = []): TestManagementService {
	return {
		getPrds: vi.fn(() => prds),
		getCoverage: vi.fn(() => entries),
		getJourneys: vi.fn(() => []),
		getJourneyByName: vi.fn(() => undefined),
		getPyramid: vi.fn(() => ({ e2e: { count: 0, passRate: 0, trend: "stable" as const }, flow: { count: 0, passRate: 0, trend: "stable" as const }, unit: { count: 0, passRate: 0, trend: "stable" as const } })),
		getPyramidWithTrends: vi.fn(() => ({ e2e: { count: 0, passRate: 0, trend: "stable" as const }, flow: { count: 0, passRate: 0, trend: "stable" as const }, unit: { count: 0, passRate: 0, trend: "stable" as const } })),
		getBaseline: vi.fn(() => undefined),
		setBaseline: vi.fn(),
		getCompliance: vi.fn(() => []),
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

describe("CoverageTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let eventBus: IEventBus;

	beforeEach(() => {
		({ masterEl, detailEl } = createElements());
		eventBus = createMockEventBus();
	});

	// ── Master list ────────────────────────────────────────

	describe("master list", () => {
		it("renders a row for each coverage entry", () => {
			const entries = [makeEntry("Analytics Hub"), makeEntry("Event System"), makeEntry("Settings")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelectorAll(".ft-list-item")).toHaveLength(3);
		});

		it("shows coverage status badge", () => {
			const entries = [makeEntry("A", "covered"), makeEntry("B", "uncovered")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(masterEl.querySelector(".ft-tm-coverage-badge--covered")).not.toBeNull();
			expect(masterEl.querySelector(".ft-tm-coverage-badge--uncovered")).not.toBeNull();
		});

		it("shows PRD name in each row", () => {
			const entries = [makeEntry("Analytics Hub")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("Analytics Hub");
		});

		it("shows stage badge", () => {
			const entries = [makeEntry("A", "covered", { prdStage: "in-progress" })];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("in-progress");
		});

		it("shows journey count", () => {
			const entries = [makeEntry("A", "covered", { journeyCount: 3 })];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(masterEl.textContent).toContain("3 journeys");
		});

		it("filters by PRD name", () => {
			const entries = [makeEntry("Analytics Hub"), makeEntry("Event System")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("analytics");

			expect(masterEl.querySelectorAll(".ft-list-item")).toHaveLength(1);
			expect(masterEl.textContent).toContain("Analytics Hub");
		});

		it("filters by domain", () => {
			const entries = [
				makeEntry("A", "covered", { domain: "Analytics" }),
				makeEntry("B", "covered", { domain: "Settings" }),
			];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("settings");

			expect(masterEl.querySelectorAll(".ft-list-item")).toHaveLength(1);
			expect(masterEl.textContent).toContain("B");
		});
	});

	// ── Selection ──────────────────────────────────────────

	describe("selection", () => {
		it("auto-selects first entry", () => {
			const entries = [makeEntry("Alpha"), makeEntry("Beta")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Alpha");
			const active = masterEl.querySelector(".ft-list-item-active");
			expect(active).not.toBeNull();
		});

		it("click changes selection", () => {
			const entries = [makeEntry("Alpha"), makeEntry("Beta")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			const rows = masterEl.querySelectorAll(".ft-list-item");
			(rows[1] as HTMLElement).click();

			expect(detailEl.textContent).toContain("Beta");
		});

		it("highlights active row", () => {
			const entries = [makeEntry("Alpha"), makeEntry("Beta")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			const rows = masterEl.querySelectorAll(".ft-list-item");
			expect(rows[0].classList.contains("ft-list-item-active")).toBe(true);
			expect(rows[1].classList.contains("ft-list-item-active")).toBe(false);
		});

		it("resetSelection clears selected entry", () => {
			const entries = [makeEntry("Alpha"), makeEntry("Beta")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");
			tab.resetSelection();
			tab.render("");

			// Should re-select first
			expect(detailEl.textContent).toContain("Alpha");
		});
	});

	// ── Detail panel ───────────────────────────────────────

	describe("detail panel", () => {
		it("shows PRD name as heading", () => {
			const entries = [makeEntry("Analytics Hub")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			const h3 = detailEl.querySelector("h3");
			expect(h3?.textContent).toBe("Analytics Hub");
		});

		it("shows linked journey names", () => {
			const entries = [makeEntry("A", "covered", { journeyNames: ["Login Journey", "Checkout Journey"], journeyCount: 2 })];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Login Journey");
			expect(detailEl.textContent).toContain("Checkout Journey");
			expect(detailEl.textContent).toContain("Linked journeys (2)");
		});

		it("shows 'no journeys linked' when uncovered", () => {
			const entries = [makeEntry("A", "uncovered")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("No journeys linked");
		});

		it("shows domain coverage summary with bars", () => {
			const entries = [
				makeEntry("A", "covered", { domain: "Analytics" }),
				makeEntry("B", "uncovered", { domain: "Analytics" }),
				makeEntry("C", "covered", { domain: "Settings" }),
			];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Domain coverage");
			expect(detailEl.querySelectorAll(".ft-tm-domain-row").length).toBeGreaterThanOrEqual(2);
			expect(detailEl.textContent).toContain("1/2"); // Analytics: 1 covered of 2
			expect(detailEl.textContent).toContain("1/1"); // Settings: 1 covered of 1
		});

		it("shows coverage gaps", () => {
			const entries = [
				makeEntry("A", "covered"),
				makeEntry("B", "uncovered", { prdStage: "in-progress" }),
				makeEntry("C", "uncovered", { prdStage: "done" }),
			];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("Coverage gaps");
			expect(detailEl.querySelectorAll(".ft-tm-gap-row")).toHaveLength(2);
		});
	});

	// ── Empty state ────────────────────────────────────────

	describe("empty state", () => {
		it("shows empty state when no PRDs found", () => {
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], []),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("No PRDs found");
		});

		it("shows empty state when filter matches nothing", () => {
			const entries = [makeEntry("Analytics Hub")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("nonexistent");

			expect(detailEl.textContent).toContain("No PRDs found");
		});
	});

	// ── Domain summary ─────────────────────────────────────

	describe("domain summary", () => {
		it("shows all-covered message when no gaps", () => {
			const entries = [makeEntry("A", "covered"), makeEntry("B", "covered")];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			expect(detailEl.textContent).toContain("All active PRDs have test coverage");
		});

		it("shows gap list for uncovered in-progress PRDs", () => {
			const entries = [
				makeEntry("A", "covered"),
				makeEntry("B", "uncovered", { prdStage: "in-progress" }),
			];
			const tab = new CoverageTab(masterEl, detailEl, {
				testManagementService: createMockService([], entries),
				eventBus,
			});
			tab.render("");

			const gaps = detailEl.querySelectorAll(".ft-tm-gap-row");
			expect(gaps).toHaveLength(1);
			expect(gaps[0].textContent).toContain("B");
		});
	});
});
