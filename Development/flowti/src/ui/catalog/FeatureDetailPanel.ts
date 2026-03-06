import { setIcon } from "obsidian";
import type { FeatureEntry, FeatureStage } from "../../domain/featureLifecycle/types";
import { STAGE_LABELS, FRI_DIMENSION_LABELS, PRIORITIZATION_LABELS, GATE_LABELS, STAGE_GATE_MAP } from "../../domain/featureLifecycle/types";
import { getNextStage } from "../../domain/featureLifecycle/FeatureLifecycleService";
import type { GateContext } from "../../domain/featureLifecycle/gateChecks";
import { runGateCheck, createDefaultGateContext } from "../../domain/featureLifecycle/gateChecks";

/** Callbacks for the feature detail panel. */
export interface FeatureDetailPanelDeps {
	/** Get the currently selected feature entry. */
	getSelectedFeature: () => FeatureEntry | undefined;
	/** Called when user clicks "Advance to [stage]". */
	onAdvanceStage?: (featureName: string, targetStage: FeatureStage, ctx: GateContext) => void;
	/** Get gate context for a feature (extracted from vault). Returns default if not available. */
	getGateContext?: (featureName: string) => GateContext;
	/** Navigate to an event type in the Events tab. */
	navigateToEvent?: (eventType: string) => void;
}

/**
 * Feature detail panel — renders full feature information
 * including metadata, gate checks, FRI breakdown, prioritization, and advance button.
 */
export class FeatureDetailPanel {
	constructor(
		private detailEl: HTMLElement,
		private deps: FeatureDetailPanelDeps,
	) {}

	render(): void {
		this.detailEl.empty();

		const feature = this.deps.getSelectedFeature();
		if (!feature) {
			this.detailEl.createDiv({ text: "Select a feature to view details", cls: "ft-detail-placeholder" });
			return;
		}

		this.renderHeader(feature);
		this.renderMetadata(feature);
		this.renderGateCheck(feature);
		this.renderFRI(feature);
		this.renderPrioritization(feature);
		this.renderRelatedEvents(feature);
		this.renderAdvanceButton(feature);
	}

	private renderHeader(feature: FeatureEntry): void {
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		header.createEl("h3", { text: feature.name });
		const stageBadge = header.createSpan({ cls: "ft-badge" });
		stageBadge.textContent = STAGE_LABELS[feature.stage];
		stageBadge.dataset.stage = feature.stage;
	}

	private renderMetadata(feature: FeatureEntry): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.createEl("h4", { text: "Metadata" });
		const list = section.createEl("ul", { cls: "ft-detail-meta-list" });
		list.createEl("li", { text: `Domain: ${feature.domain}` });
		list.createEl("li", { text: `Stage: ${STAGE_LABELS[feature.stage]}` });
		if (feature.maturity) {
			list.createEl("li", { text: `Maturity: ${feature.maturity}` });
		}
		if (feature.rawStage !== feature.stage) {
			list.createEl("li", { text: `Raw stage: ${feature.rawStage}` });
		}
	}

	private renderGateCheck(feature: FeatureEntry): void {
		const nextStage = getNextStage(feature.stage);
		if (!nextStage) return; // "done" — no next gate

		const gateName = STAGE_GATE_MAP[nextStage];
		if (!gateName) return;

		const ctx = this.deps.getGateContext?.(feature.name) ?? createDefaultGateContext();
		const gateResult = runGateCheck(feature, nextStage, ctx);
		if (!gateResult) return;

		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.dataset.section = "gate-check";
		const heading = section.createEl("h4");
		const gateIcon = heading.createSpan();
		setIcon(gateIcon, gateResult.passed ? "check-circle" : "alert-triangle");
		heading.appendText(` ${GATE_LABELS[gateName]}: ${gateResult.passed ? "Ready" : "Not ready"}`);

		const checkList = section.createEl("ul", { cls: "ft-detail-gate-checks" });
		for (const check of gateResult.checks) {
			const li = checkList.createEl("li", {
				cls: `ft-gate-check-item ft-gate-${check.passed ? "pass" : check.severity}`,
			});
			const icon = li.createSpan({ cls: "ft-gate-check-icon" });
			setIcon(icon, check.passed ? "check" : check.severity === "error" ? "x" : "alert-triangle");
			li.createSpan({ text: check.label });
			if (!check.passed && check.reason) {
				li.createSpan({ text: ` — ${check.reason}`, cls: "ft-gate-check-reason" });
			}
		}
	}

	private renderFRI(feature: FeatureEntry): void {
		if (!feature.fri) return;

		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.dataset.section = "fri";
		section.createEl("h4", { text: `FRI: ${feature.fri.total}/35 — ${feature.fri.levelLabel}` });

		const list = section.createEl("ul", { cls: "ft-detail-meta-list" });
		for (const [dim, score] of Object.entries(feature.fri.dimensions)) {
			const label = FRI_DIMENSION_LABELS[dim as keyof typeof FRI_DIMENSION_LABELS] ?? dim;
			list.createEl("li", { text: `${label}: ${score}/5` });
		}
	}

	private renderPrioritization(feature: FeatureEntry): void {
		if (!feature.prioritization) return;

		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.dataset.section = "prioritization";
		section.createEl("h4", { text: `Priority signal: ${feature.prioritization.signal ?? "N/A"}` });

		const list = section.createEl("ul", { cls: "ft-detail-meta-list" });
		for (const [dim, score] of Object.entries(feature.prioritization.dimensions)) {
			const label = PRIORITIZATION_LABELS[dim as keyof typeof PRIORITIZATION_LABELS] ?? dim;
			list.createEl("li", { text: `${label}: ${score ?? "—"}` });
		}
	}

	private renderRelatedEvents(feature: FeatureEntry): void {
		if (feature.relatedEvents.length === 0) return;

		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.createEl("h4", { text: "Related events" });
		const list = section.createEl("ul", { cls: "ft-detail-meta-list" });
		for (const event of feature.relatedEvents) {
			const li = list.createEl("li");
			const link = li.createEl("a", { text: event, cls: "ft-link" });
			link.addEventListener("click", () => {
				this.deps.navigateToEvent?.(event);
			});
		}
	}

	private renderAdvanceButton(feature: FeatureEntry): void {
		const nextStage = getNextStage(feature.stage);
		if (!nextStage || !this.deps.onAdvanceStage) return;

		const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-detail-actions" });
		const btn = section.createEl("button", {
			text: `Advance to ${STAGE_LABELS[nextStage]}`,
			cls: "ft-btn ft-btn-primary",
		});
		btn.dataset.action = "advance";

		btn.addEventListener("click", () => {
			const ctx = this.deps.getGateContext?.(feature.name) ?? createDefaultGateContext();
			this.deps.onAdvanceStage!(feature.name, nextStage, ctx);
		});
	}
}
