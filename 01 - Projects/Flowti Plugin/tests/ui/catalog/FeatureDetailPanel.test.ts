// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import "../../mocks/obsidian-stub";
import { FeatureDetailPanel, type FeatureDetailPanelDeps } from "../../../src/ui/catalog/FeatureDetailPanel";
import type { FeatureEntry } from "../../../src/domain/featureLifecycle/types";
import { createDefaultGateContext, type GateContext } from "../../../src/domain/featureLifecycle/gateChecks";

// ── Helpers ─────────────────────────────────────────────────

function createEntry(overrides: Partial<FeatureEntry> = {}): FeatureEntry {
	return {
		name: "Test Feature",
		filePath: "docs/features/Test Feature/Test Feature PRD.md",
		stage: "idea",
		rawStage: "idea",
		domain: "Flowti",
		fri: null,
		prioritization: null,
		pbis: [],
		relatedEvents: [],
		maturity: null,
		...overrides,
	};
}

function createPanel(feature: FeatureEntry | undefined, extraDeps: Partial<FeatureDetailPanelDeps> = {}) {
	const detailEl = document.createElement("div");
	const deps: FeatureDetailPanelDeps = {
		getSelectedFeature: () => feature,
		...extraDeps,
	};
	const panel = new FeatureDetailPanel(detailEl, deps);
	return { panel, detailEl };
}

// ── Tests ───────────────────────────────────────────────────

describe("FeatureDetailPanel", () => {
	describe("no selection", () => {
		it("shows placeholder when no feature selected", () => {
			const { panel, detailEl } = createPanel(undefined);
			panel.render();
			expect(detailEl.querySelector(".ft-detail-placeholder")).not.toBeNull();
			expect(detailEl.textContent).toContain("Select a feature");
		});
	});

	describe("header", () => {
		it("renders feature name and stage badge", () => {
			const { panel, detailEl } = createPanel(createEntry({ name: "Auth Feature", stage: "approved" }));
			panel.render();
			expect(detailEl.querySelector("h3")?.textContent).toBe("Auth Feature");
			const badge = detailEl.querySelector(".ft-badge");
			expect(badge?.textContent).toBe("Approved");
		});
	});

	describe("metadata", () => {
		it("renders domain and stage", () => {
			const { panel, detailEl } = createPanel(createEntry({ domain: "Auth" }));
			panel.render();
			const items = detailEl.querySelectorAll(".ft-detail-meta-list li");
			const texts = Array.from(items).map((li) => li.textContent);
			expect(texts).toContain("Domain: Auth");
		});

		it("shows maturity when present", () => {
			const { panel, detailEl } = createPanel(createEntry({ maturity: "L3" }));
			panel.render();
			const items = Array.from(detailEl.querySelectorAll("li")).map((li) => li.textContent);
			expect(items.some((t) => t?.includes("L3"))).toBe(true);
		});

		it("shows raw stage when different from normalized", () => {
			const { panel, detailEl } = createPanel(createEntry({ stage: "idea", rawStage: "new" }));
			panel.render();
			const items = Array.from(detailEl.querySelectorAll("li")).map((li) => li.textContent);
			expect(items.some((t) => t?.includes("new"))).toBe(true);
		});
	});

	describe("gate check section", () => {
		it("renders gate check section for non-done features", () => {
			const ctx: GateContext = {
				...createDefaultGateContext(),
				prdExists: true,
				hasProblemStatement: true,
				hasOutcome: true,
			};
			const { panel, detailEl } = createPanel(
				createEntry({ stage: "idea" }),
				{ getGateContext: () => ctx },
			);
			panel.render();
			const gateSection = detailEl.querySelector('[data-section="gate-check"]');
			expect(gateSection).not.toBeNull();
		});

		it("shows passing checks", () => {
			const ctx: GateContext = {
				...createDefaultGateContext(),
				prdExists: true,
				hasProblemStatement: true,
				hasOutcome: true,
			};
			const { panel, detailEl } = createPanel(
				createEntry({ stage: "idea" }),
				{ getGateContext: () => ctx },
			);
			panel.render();
			const passItems = detailEl.querySelectorAll(".ft-gate-pass");
			expect(passItems.length).toBeGreaterThan(0);
		});

		it("shows failing checks with reason", () => {
			const { panel, detailEl } = createPanel(
				createEntry({ stage: "idea" }),
				{ getGateContext: () => createDefaultGateContext() },
			);
			panel.render();
			const failItems = detailEl.querySelectorAll(".ft-gate-error");
			expect(failItems.length).toBeGreaterThan(0);
			const reasons = detailEl.querySelectorAll(".ft-gate-check-reason");
			expect(reasons.length).toBeGreaterThan(0);
		});

		it("does not render gate section for done features", () => {
			const { panel, detailEl } = createPanel(createEntry({ stage: "done" }));
			panel.render();
			const gateSection = detailEl.querySelector('[data-section="gate-check"]');
			expect(gateSection).toBeNull();
		});
	});

	describe("FRI section", () => {
		it("renders FRI dimensions", () => {
			const { panel, detailEl } = createPanel(createEntry({
				fri: {
					dimensions: {
						strategy: 5, scope: 4, architecture: 3,
						event_integration: 3, data_model: 3, ui_consistency: 2, validation_testing: 2,
					},
					total: 22,
					level: "technically-ready",
					levelLabel: "Technically ready",
				},
			}));
			panel.render();
			const friSection = detailEl.querySelector('[data-section="fri"]');
			expect(friSection).not.toBeNull();
			const heading = friSection?.querySelector("h4");
			expect(heading?.textContent).toContain("22/35");
		});

		it("does not render FRI when null", () => {
			const { panel, detailEl } = createPanel(createEntry({ fri: null }));
			panel.render();
			expect(detailEl.querySelector('[data-section="fri"]')).toBeNull();
		});
	});

	describe("prioritization section", () => {
		it("renders prioritization dimensions", () => {
			const { panel, detailEl } = createPanel(createEntry({
				prioritization: {
					dimensions: {
						business_value: 5, implementation_cost: 3, maintenance_cost: 2,
						discovery_cost: 1, design_cost: 2, test_cost: 3, priority: 2,
					},
					signal: 3,
				},
			}));
			panel.render();
			const section = detailEl.querySelector('[data-section="prioritization"]');
			expect(section).not.toBeNull();
			expect(section?.querySelector("h4")?.textContent).toContain("3");
		});
	});

	describe("advance button", () => {
		it("renders advance button for non-done features", () => {
			const onAdvance = vi.fn();
			const { panel, detailEl } = createPanel(
				createEntry({ stage: "idea" }),
				{ onAdvanceStage: onAdvance },
			);
			panel.render();
			const btn = detailEl.querySelector('[data-action="advance"]') as HTMLButtonElement;
			expect(btn).not.toBeNull();
			expect(btn?.textContent).toContain("Draft");
		});

		it("calls onAdvanceStage when clicked", () => {
			const onAdvance = vi.fn();
			const { panel, detailEl } = createPanel(
				createEntry({ stage: "idea" }),
				{ onAdvanceStage: onAdvance },
			);
			panel.render();
			const btn = detailEl.querySelector('[data-action="advance"]') as HTMLButtonElement;
			btn.click();
			expect(onAdvance).toHaveBeenCalledWith("Test Feature", "draft", expect.any(Object));
		});

		it("does not render advance button for done features", () => {
			const { panel, detailEl } = createPanel(
				createEntry({ stage: "done" }),
				{ onAdvanceStage: vi.fn() },
			);
			panel.render();
			expect(detailEl.querySelector('[data-action="advance"]')).toBeNull();
		});

		it("does not render advance button when no onAdvanceStage", () => {
			const { panel, detailEl } = createPanel(createEntry({ stage: "idea" }));
			panel.render();
			expect(detailEl.querySelector('[data-action="advance"]')).toBeNull();
		});
	});

	describe("related events", () => {
		it("renders event links", () => {
			const navigateToEvent = vi.fn();
			const { panel, detailEl } = createPanel(
				createEntry({ relatedEvents: ["feature.scored", "feature.stage.changed"] }),
				{ navigateToEvent },
			);
			panel.render();
			const links = detailEl.querySelectorAll(".ft-link");
			expect(links.length).toBe(2);
		});

		it("calls navigateToEvent on click", () => {
			const navigateToEvent = vi.fn();
			const { panel, detailEl } = createPanel(
				createEntry({ relatedEvents: ["feature.scored"] }),
				{ navigateToEvent },
			);
			panel.render();
			const link = detailEl.querySelector(".ft-link") as HTMLElement;
			link.click();
			expect(navigateToEvent).toHaveBeenCalledWith("feature.scored");
		});

		it("does not render events section when empty", () => {
			const { panel, detailEl } = createPanel(createEntry({ relatedEvents: [] }));
			panel.render();
			const headings = Array.from(detailEl.querySelectorAll("h4")).map((h) => h.textContent);
			expect(headings).not.toContain("Related events");
		});
	});

	describe("process compliance", () => {
		it("renders compliance section when data is available", () => {
			const compliance = {
				featureName: "Test Feature",
				processName: "Development Lifecycle",
				percentage: 80,
				steps: [
					{ phase: 1, name: "Feedback & Intake", satisfied: true },
					{ phase: 2, name: "Problem Discovery", satisfied: true },
					{ phase: 3, name: "Solution Design", satisfied: false },
				],
			};
			const { panel, detailEl } = createPanel(createEntry(), {
				getProcessCompliance: () => compliance,
			});
			panel.render();

			const section = detailEl.querySelector('[data-section="process-compliance"]');
			expect(section).not.toBeNull();
			expect(section?.querySelector("h4")?.textContent).toContain("Process: 80%");
		});

		it("applies green color for >= 80%", () => {
			const compliance = {
				featureName: "Test", processName: "Dev", percentage: 90,
				steps: [{ phase: 1, name: "Intake", satisfied: true }],
			};
			const { panel, detailEl } = createPanel(createEntry(), { getProcessCompliance: () => compliance });
			panel.render();

			const badge = detailEl.querySelector(".ft-compliance-green");
			expect(badge).not.toBeNull();
			expect(badge?.textContent).toBe("On track");
		});

		it("applies yellow color for 50-79%", () => {
			const compliance = {
				featureName: "Test", processName: "Dev", percentage: 60,
				steps: [{ phase: 1, name: "Intake", satisfied: true }],
			};
			const { panel, detailEl } = createPanel(createEntry(), { getProcessCompliance: () => compliance });
			panel.render();

			const badge = detailEl.querySelector(".ft-compliance-yellow");
			expect(badge).not.toBeNull();
			expect(badge?.textContent).toBe("Partial");
		});

		it("applies red color for < 50%", () => {
			const compliance = {
				featureName: "Test", processName: "Dev", percentage: 30,
				steps: [{ phase: 1, name: "Intake", satisfied: false }],
			};
			const { panel, detailEl } = createPanel(createEntry(), { getProcessCompliance: () => compliance });
			panel.render();

			const badge = detailEl.querySelector(".ft-compliance-red");
			expect(badge).not.toBeNull();
			expect(badge?.textContent).toBe("Behind");
		});

		it("renders step checklist with icons", () => {
			const compliance = {
				featureName: "Test", processName: "Dev", percentage: 50,
				steps: [
					{ phase: 1, name: "Intake", satisfied: true },
					{ phase: 2, name: "Discovery", satisfied: false },
				],
			};
			const { panel, detailEl } = createPanel(createEntry(), { getProcessCompliance: () => compliance });
			panel.render();

			const items = detailEl.querySelectorAll(".ft-step-done, .ft-step-pending");
			expect(items).toHaveLength(2);
			expect(items[0].classList.contains("ft-step-done")).toBe(true);
			expect(items[1].classList.contains("ft-step-pending")).toBe(true);
		});

		it("does not render when getProcessCompliance returns undefined", () => {
			const { panel, detailEl } = createPanel(createEntry(), {
				getProcessCompliance: () => undefined,
			});
			panel.render();

			expect(detailEl.querySelector('[data-section="process-compliance"]')).toBeNull();
		});

		it("does not render when getProcessCompliance is not provided", () => {
			const { panel, detailEl } = createPanel(createEntry());
			panel.render();
			expect(detailEl.querySelector('[data-section="process-compliance"]')).toBeNull();
		});
	});
});
