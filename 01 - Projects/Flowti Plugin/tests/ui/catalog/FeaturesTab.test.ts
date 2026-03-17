// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../../mocks/obsidian-stub";
import { FeaturesTab, type FeaturesTabDeps } from "../../../src/ui/catalog/FeaturesTab";
import type { FeatureEntry, FeatureStage } from "../../../src/domain/featureLifecycle/types";
import { FEATURE_STAGES, STAGE_LABELS } from "../../../src/domain/featureLifecycle/types";
import type { CatalogComponentDeps } from "../../../src/ui/catalog/types";

// ── Helpers ─────────────────────────────────────────────────

function createFeatureEntry(overrides: Partial<FeatureEntry> = {}): FeatureEntry {
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

function createFeatures(): FeatureEntry[] {
	return [
		createFeatureEntry({ name: "Feature A", stage: "idea", domain: "D1" }),
		createFeatureEntry({ name: "Feature B", stage: "idea", domain: "D2" }),
		createFeatureEntry({ name: "Feature C", stage: "draft", domain: "D1" }),
		createFeatureEntry({ name: "Feature D", stage: "approved", domain: "D1",
			fri: { dimensions: {} as any, total: 15, level: "conceptual", levelLabel: "Conceptual" },
		}),
		createFeatureEntry({ name: "Feature E", stage: "done", domain: "D2" }),
	];
}

function groupByStage(features: FeatureEntry[]): Record<FeatureStage, FeatureEntry[]> {
	const grouped: Record<FeatureStage, FeatureEntry[]> = {
		idea: [], draft: [], approved: [], "in-progress": [], review: [], done: [],
	};
	for (const f of features) grouped[f.stage].push(f);
	return grouped;
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

function createTab(features: FeatureEntry[], filterText = "") {
	const masterEl = document.createElement("div");
	const detailEl = document.createElement("div");
	const deps = createMockDeps(filterText);
	const onFeatureSelect = vi.fn();
	const featureDeps: FeaturesTabDeps = {
		getFeatures: () => features,
		getFeaturesByStage: () => groupByStage(features),
		onFeatureSelect,
	};
	const tab = new FeaturesTab(masterEl, detailEl, deps, featureDeps);
	return { tab, masterEl, detailEl, onFeatureSelect, deps };
}

// ── Tests ───────────────────────────────────────────────────

describe("FeaturesTab", () => {
	describe("getEntries", () => {
		it("returns features from deps", () => {
			const features = createFeatures();
			const { tab } = createTab(features);
			expect(tab.getEntries()).toHaveLength(5);
		});

		it("returns empty when no features", () => {
			const { tab } = createTab([]);
			expect(tab.getEntries()).toEqual([]);
		});
	});

	describe("selectedFeature", () => {
		it("defaults to null", () => {
			const { tab } = createTab([]);
			expect(tab.getSelectedFeature()).toBeNull();
		});

		it("can be set and retrieved", () => {
			const { tab } = createTab(createFeatures());
			tab.setSelectedFeature("Feature C");
			expect(tab.getSelectedFeature()).toBe("Feature C");
		});
	});

	describe("getCountText", () => {
		it("shows total count without filter", () => {
			const { tab } = createTab(createFeatures());
			expect(tab.getCountText()).toBe("5 features");
		});

		it("shows filtered count with filter", () => {
			const { tab } = createTab(createFeatures(), "feature a");
			expect(tab.getCountText()).toMatch(/1 \/ 5 features/);
		});

		it("filters by domain", () => {
			const { tab } = createTab(createFeatures(), "d1");
			expect(tab.getCountText()).toMatch(/3 \/ 5 features/);
		});
	});

	describe("render master", () => {
		it("renders stage groups", () => {
			const { tab, masterEl } = createTab(createFeatures());
			tab.render();
			const groups = masterEl.querySelectorAll(".ft-master-group");
			expect(groups.length).toBe(FEATURE_STAGES.length);
		});

		it("renders feature items in correct groups", () => {
			const { tab, masterEl } = createTab(createFeatures());
			tab.render();
			// idea group should have 2 items
			const ideaGroup = masterEl.querySelector('[data-stage="idea"]');
			expect(ideaGroup).not.toBeNull();
			const ideaItems = ideaGroup!.querySelectorAll(".ft-master-item");
			expect(ideaItems.length).toBe(2);
		});

		it("shows empty message for stages with no features", () => {
			const { tab, masterEl } = createTab(createFeatures());
			tab.render();
			const reviewGroup = masterEl.querySelector('[data-stage="review"]');
			const emptyMsg = reviewGroup?.querySelector(".ft-master-empty");
			expect(emptyMsg).not.toBeNull();
		});

		it("applies selected class to selected feature", () => {
			const { tab, masterEl } = createTab(createFeatures());
			tab.setSelectedFeature("Feature A");
			tab.render();
			const selected = masterEl.querySelector(".ft-master-item-selected");
			expect(selected).not.toBeNull();
			expect((selected as HTMLElement)?.dataset.featureName).toBe("Feature A");
		});

		it("shows FRI badge when feature has FRI", () => {
			const { tab, masterEl } = createTab(createFeatures());
			tab.render();
			const badges = masterEl.querySelectorAll(".ft-badge");
			// Feature D has FRI
			expect(badges.length).toBeGreaterThanOrEqual(1);
		});

		it("filters features by search text", () => {
			const { tab, masterEl } = createTab(createFeatures(), "feature a");
			tab.render();
			const items = masterEl.querySelectorAll(".ft-master-item");
			expect(items.length).toBe(1);
		});
	});

	describe("render detail", () => {
		it("shows placeholder when no feature selected", () => {
			const { tab, detailEl } = createTab(createFeatures());
			tab.render();
			expect(detailEl.querySelector(".ft-detail-placeholder")).not.toBeNull();
		});

		it("renders feature detail when selected", () => {
			const { tab, detailEl } = createTab(createFeatures());
			tab.setSelectedFeature("Feature D");
			tab.render();
			const header = detailEl.querySelector("h3");
			expect(header?.textContent).toBe("Feature D");
		});

		it("shows FRI section for scored feature", () => {
			const { tab, detailEl } = createTab(createFeatures());
			tab.setSelectedFeature("Feature D");
			tab.render();
			const friHeading = Array.from(detailEl.querySelectorAll("h4"))
				.find((h) => h.textContent?.includes("FRI"));
			expect(friHeading).toBeDefined();
		});

		it("shows placeholder for unknown feature", () => {
			const { tab, detailEl } = createTab(createFeatures());
			tab.setSelectedFeature("Nonexistent");
			tab.render();
			expect(detailEl.querySelector(".ft-detail-placeholder")).not.toBeNull();
		});
	});
});
