// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../../mocks/obsidian-stub";
import { ProcessesTab, type ProcessesTabDeps } from "../../../src/ui/catalog/ProcessesTab";
import type { ProcessDefinition, ValidationResult } from "../../../src/domain/process/types";
import type { CatalogComponentDeps } from "../../../src/ui/catalog/types";

// ── Helpers ─────────────────────────────────────────────────

function createProcess(name: string, nodeCount = 3, valid = true): ProcessDefinition {
	const nodes = Array.from({ length: nodeCount }, (_, i) => ({
		id: `n${i}`,
		type: i === 0 ? "start" as const : i === nodeCount - 1 ? "end" as const : "activity" as const,
		name: `Node ${i}`,
		metadata: { phase: i + 1 },
		x: i * 200,
		y: 0,
	}));
	const edges = nodes.slice(0, -1).map((n, i) => ({
		id: `e${i}`,
		fromNode: n.id,
		toNode: nodes[i + 1].id,
	}));
	return { name, filePath: `docs/processes/${name.toLowerCase()}.process.canvas`, nodes, edges };
}

function createValidation(valid = true, errorCount = 0, warningCount = 0): ValidationResult {
	return {
		findings: [],
		errorCount,
		warningCount,
		infoCount: 0,
		valid,
	};
}

function createMockDeps(filterText = ""): CatalogComponentDeps {
	return {
		app: {} as any,
		vaultQuery: {} as any,
		workspace: {} as any,
		eventBus: { emit: vi.fn(), on: vi.fn() } as any,
		getState: () => ({ filterText } as any),
		navigation: {
			navigateToTab: vi.fn(),
			navigateToEvent: vi.fn(),
			navigateToDomain: vi.fn(),
			navigateToService: vi.fn(),
			navigateToFlow: vi.fn(),
			navigateToSystem: vi.fn(),
			navigateToActor: vi.fn(),
			navigateToProduct: vi.fn(),
			openActivityLog: vi.fn(),
			openSubscriptionManager: vi.fn(),
		},
		scheduleRender: vi.fn(),
		getEntityFolder: vi.fn(() => ""),
		createEntity: vi.fn(),
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("ProcessesTab", () => {
	let masterEl: HTMLElement;
	let detailEl: HTMLElement;
	let deps: CatalogComponentDeps;
	let processDeps: ProcessesTabDeps;
	let processes: ProcessDefinition[];
	let tab: ProcessesTab;

	beforeEach(() => {
		masterEl = document.createElement("div");
		detailEl = document.createElement("div");
		deps = createMockDeps();
		processes = [
			createProcess("Dev Lifecycle", 10),
			createProcess("Release Process", 5),
		];
		processDeps = {
			getProcesses: () => processes,
			validateProcess: () => createValidation(true),
		};
		tab = new ProcessesTab(masterEl, detailEl, deps, processDeps);
	});

	describe("getEntries", () => {
		it("returns processes from deps", () => {
			expect(tab.getEntries()).toHaveLength(2);
		});
	});

	describe("getCountText", () => {
		it("shows total count without filter", () => {
			expect(tab.getCountText()).toBe("2 processes");
		});

		it("shows filtered count with filter", () => {
			deps = createMockDeps("dev");
			tab = new ProcessesTab(masterEl, detailEl, deps, processDeps);
			expect(tab.getCountText()).toBe("1 / 2 processes");
		});
	});

	describe("render master", () => {
		it("renders process items", () => {
			tab.render();
			const items = masterEl.querySelectorAll(".ft-master-event-item");
			expect(items).toHaveLength(2);
		});

		it("shows validation badge (Valid)", () => {
			tab.render();
			const badges = masterEl.querySelectorAll(".ft-badge");
			expect(badges[0].textContent).toBe("Valid");
		});

		it("shows error count in badge for invalid process", () => {
			processDeps.validateProcess = () => createValidation(false, 2);
			tab.render();
			const badge = masterEl.querySelector(".ft-badge");
			expect(badge?.textContent).toBe("2 errors");
		});

		it("shows warning count in badge when no errors", () => {
			processDeps.validateProcess = () => createValidation(false, 0, 3);
			tab.render();
			const badge = masterEl.querySelector(".ft-badge");
			expect(badge?.textContent).toBe("3 warnings");
		});

		it("shows node count metadata", () => {
			tab.render();
			const metas = masterEl.querySelectorAll(".ft-master-item-meta");
			expect(metas[0].textContent).toBe("10 nodes");
		});

		it("filters by name", () => {
			deps = createMockDeps("release");
			tab = new ProcessesTab(masterEl, detailEl, deps, processDeps);
			tab.render();
			const items = masterEl.querySelectorAll(".ft-master-event-item");
			expect(items).toHaveLength(1);
		});

		it("shows empty state when no processes", () => {
			processes = [];
			tab.render();
			const empty = masterEl.querySelector(".ft-master-empty");
			expect(empty).toBeTruthy();
			expect(empty?.textContent).toContain("No process definitions found");
		});

		it("shows no-match message when filter excludes all", () => {
			deps = createMockDeps("nonexistent");
			tab = new ProcessesTab(masterEl, detailEl, deps, processDeps);
			tab.render();
			const empty = masterEl.querySelector(".ft-master-empty");
			expect(empty?.textContent).toBe("No matching processes");
		});

		it("highlights selected process", () => {
			tab.setSelectedProcess("Dev Lifecycle");
			tab.render();
			const selected = masterEl.querySelector(".ft-master-event-selected");
			expect(selected).toBeTruthy();
			expect(selected?.querySelector(".ft-master-item-label")?.textContent).toBe("Dev Lifecycle");
		});
	});

	describe("render detail", () => {
		it("shows empty state when no process selected", () => {
			tab.render();
			const empty = detailEl.querySelector(".ft-catalog-detail-empty");
			expect(empty).toBeTruthy();
			expect(detailEl.textContent).toContain("Select a process to view details");
		});

		it("renders process header when selected", () => {
			tab.setSelectedProcess("Dev Lifecycle");
			tab.render();
			const title = detailEl.querySelector(".ft-detail-event-type");
			expect(title?.textContent).toBe("Dev Lifecycle");
		});

		it("renders node list", () => {
			tab.setSelectedProcess("Dev Lifecycle");
			tab.render();
			const nodes = detailEl.querySelectorAll(".ft-catalog-row");
			expect(nodes.length).toBeGreaterThanOrEqual(10);
		});

		it("renders validation badges", () => {
			tab.setSelectedProcess("Dev Lifecycle");
			tab.render();
			const badges = detailEl.querySelectorAll(".ft-badge");
			const badgeTexts = Array.from(badges).map((b) => b.textContent);
			expect(badgeTexts).toContain("VALID");
			expect(badgeTexts).toContain("10 nodes");
		});

		it("shows empty stats in detail empty state", () => {
			tab.render();
			const stats = detailEl.querySelectorAll(".ft-catalog-stat");
			expect(stats).toHaveLength(3);
		});
	});

	describe("selection", () => {
		it("get/set selected process", () => {
			expect(tab.getSelectedProcess()).toBeNull();
			tab.setSelectedProcess("Dev Lifecycle");
			expect(tab.getSelectedProcess()).toBe("Dev Lifecycle");
		});
	});
});
