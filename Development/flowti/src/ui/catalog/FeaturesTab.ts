import { setIcon } from "obsidian";
import type { FeatureEntry, FeatureStage } from "../../domain/featureLifecycle/types";
import { FEATURE_STAGES, STAGE_LABELS, FRI_LEVEL_THRESHOLDS } from "../../domain/featureLifecycle/types";
import type { GateContext } from "../../domain/featureLifecycle/gateChecks";
import type { CatalogComponentDeps } from "./types";
import { FeatureDetailPanel } from "./FeatureDetailPanel";

/** Callback interface for feature data access. */
export interface FeaturesTabDeps {
	getFeatures: () => FeatureEntry[];
	getFeaturesByStage: () => Record<FeatureStage, FeatureEntry[]>;
	onFeatureSelect: (name: string) => void;
	onAdvanceStage?: (featureName: string, targetStage: FeatureStage, ctx: GateContext) => void;
	getGateContext?: (featureName: string) => GateContext;
}

/**
 * Features tab component for the Event Catalog view.
 * Renders a stage-grouped pipeline master list with detail panel.
 */
export class FeaturesTab {
	private selectedFeature: string | null = null;
	private collapsedStages = new Set<FeatureStage>();
	private detailPanel: FeatureDetailPanel;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
		private featureDeps: FeaturesTabDeps,
	) {
		this.detailPanel = new FeatureDetailPanel(detailEl, {
			getSelectedFeature: () => {
				if (!this.selectedFeature) return undefined;
				return this.featureDeps.getFeatures().find((f) => f.name === this.selectedFeature);
			},
			onAdvanceStage: featureDeps.onAdvanceStage,
			getGateContext: featureDeps.getGateContext,
			navigateToEvent: (event) => deps.navigation.navigateToEvent(event),
		});
	}

	// ── Public API ───────────────────────────────────────────

	getEntries(): FeatureEntry[] {
		return this.featureDeps.getFeatures();
	}

	getSelectedFeature(): string | null {
		return this.selectedFeature;
	}

	setSelectedFeature(name: string | null): void {
		this.selectedFeature = name;
	}

	render(): void {
		this.renderMaster();
		this.detailPanel.render();
	}

	getCountText(): string {
		const features = this.getEntries();
		const filterText = this.deps.getState().filterText;
		if (filterText) {
			const filtered = features.filter((f) =>
				f.name.toLowerCase().includes(filterText) ||
				f.domain.toLowerCase().includes(filterText));
			return `${filtered.length} / ${features.length} features`;
		}
		return `${features.length} features`;
	}

	// ── Master (left panel) ─────────────────────────────────

	private renderMaster(): void {
		this.masterEl.empty();

		const grouped = this.featureDeps.getFeaturesByStage();
		const filterText = this.deps.getState().filterText;

		for (const stage of FEATURE_STAGES) {
			let features = grouped[stage];
			if (filterText) {
				features = features.filter((f) =>
					f.name.toLowerCase().includes(filterText) ||
					f.domain.toLowerCase().includes(filterText));
			}

			const stageSection = this.masterEl.createDiv({ cls: "ft-master-group" });
			stageSection.dataset.stage = stage;

			// Stage header
			const header = stageSection.createDiv({ cls: "ft-master-group-header" });
			const chevron = header.createSpan({ cls: "ft-master-chevron" });
			setIcon(chevron, this.collapsedStages.has(stage) ? "chevron-right" : "chevron-down");
			header.createSpan({ text: `${STAGE_LABELS[stage]} (${features.length})`, cls: "ft-master-group-label" });

			header.addEventListener("click", () => {
				if (this.collapsedStages.has(stage)) {
					this.collapsedStages.delete(stage);
				} else {
					this.collapsedStages.add(stage);
				}
				this.renderMaster();
			});

			if (this.collapsedStages.has(stage)) continue;

			// Feature items
			for (const feature of features) {
				const item = stageSection.createDiv({
					cls: `ft-master-item${this.selectedFeature === feature.name ? " ft-master-item-selected" : ""}`,
				});
				item.dataset.featureName = feature.name;

				item.createSpan({ text: feature.name, cls: "ft-master-item-label" });

				// FRI badge
				if (feature.fri) {
					const badge = item.createSpan({ cls: "ft-badge ft-badge-sm" });
					const threshold = FRI_LEVEL_THRESHOLDS.find((t) => feature.fri!.total >= t.min);
					badge.textContent = `FRI ${feature.fri.total}`;
					if (threshold) {
						badge.classList.add(`ft-badge-${threshold.level}`);
					}
				}

				// Domain tag
				if (feature.domain && feature.domain !== "unknown") {
					item.createSpan({ text: feature.domain, cls: "ft-master-item-meta" });
				}

				item.addEventListener("click", () => {
					this.selectedFeature = feature.name;
					this.featureDeps.onFeatureSelect(feature.name);
					this.renderMaster();
					this.detailPanel.render();
				});
			}

			if (features.length === 0) {
				stageSection.createDiv({ text: "No features", cls: "ft-master-empty" });
			}
		}
	}
}
