/**
 * Compliance tab — ISO compliance visualization for the Test Management Hub.
 *
 * Master panel: 3 standard cards (ISO 9001, 27001, 25010) with scores.
 * Detail panel: characteristic list with coverage status, guidance, tag management.
 */

import { setIcon } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../../domain/testManagement/TestManagementService";
import type { ComplianceScore, ComplianceCharacteristic, IsoStandard } from "../../domain/testManagement/types";
import { getCharacteristicsByStandard } from "../../domain/testManagement/complianceDefinitions";

// ── Types ───────────────────────────────────────────────────

export interface ComplianceTabDeps {
	testManagementService: TestManagementService;
	eventBus: IEventBus;
}

interface StandardDef {
	id: IsoStandard;
	label: string;
	subtitle: string;
	icon: string;
}

const STANDARDS: StandardDef[] = [
	{ id: "iso-9001", label: "ISO 9001", subtitle: "Quality Management", icon: "shield-check" },
	{ id: "iso-27001", label: "ISO 27001", subtitle: "Information Security", icon: "lock" },
	{ id: "iso-25010", label: "ISO 25010", subtitle: "Software Quality", icon: "gem" },
];

// ── Component ───────────────────────────────────────────────

export class ComplianceTab {
	private selectedStandard: IsoStandard = "iso-9001";
	private expandedCharacteristic: string | null = null;
	private showJourneyListFor: string | null = null;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: ComplianceTabDeps,
	) {}

	resetSelection(): void {
		this.selectedStandard = "iso-9001";
		this.expandedCharacteristic = null;
		this.showJourneyListFor = null;
	}

	render(filterText: string): void {
		const scores = this.deps.testManagementService.getCompliance();

		this.masterEl.empty();
		this.detailEl.empty();

		this.renderStandardCards(scores);
		this.renderCharacteristicList(filterText, scores);
	}

	// ── Master panel — Standard cards ───────────────────────

	private renderStandardCards(scores: ComplianceScore[]): void {
		const container = this.masterEl.createDiv({ cls: "ft-tm-pyramid-cards" });

		for (const def of STANDARDS) {
			const score = scores.find((s) => s.standard === def.id);
			this.renderStandardCard(container, def, score);
		}
	}

	private renderStandardCard(container: HTMLElement, def: StandardDef, score?: ComplianceScore): void {
		const isActive = def.id === this.selectedStandard;
		const card = container.createDiv({
			cls: `ft-tm-compliance-card${isActive ? " ft-tm-compliance-card--active" : ""}`,
		});
		card.dataset.standardId = def.id;

		// Icon
		const iconEl = card.createDiv({ cls: "ft-tm-compliance-card-icon" });
		setIcon(iconEl, def.icon);

		// Info
		const info = card.createDiv({ cls: "ft-tm-compliance-card-info" });
		info.createDiv({ text: `${def.label} — ${def.subtitle}`, cls: "ft-tm-compliance-card-label" });

		const covered = score?.covered ?? 0;
		const total = score?.total ?? 0;
		const pct = score?.percentage ?? 0;
		info.createDiv({
			text: `${covered}/${total} covered · ${pct}%`,
			cls: "ft-tm-compliance-card-stats",
		});

		// Progress bar
		const barBg = card.createDiv({ cls: "ft-tm-domain-bar-bg" });
		const bar = barBg.createDiv({ cls: "ft-tm-domain-bar" });
		bar.style.width = `${pct}%`;

		card.addEventListener("click", () => {
			this.selectedStandard = def.id;
			this.expandedCharacteristic = null;
			this.showJourneyListFor = null;
			const scores = this.deps.testManagementService.getCompliance();
			this.detailEl.empty();
			this.renderCharacteristicList("", scores);
			this.highlightActiveCard();
		});
	}

	private highlightActiveCard(): void {
		const cards = Array.from(this.masterEl.querySelectorAll(".ft-tm-compliance-card"));
		for (const card of cards) {
			const el = card as HTMLElement;
			if (el.dataset.standardId === this.selectedStandard) {
				el.classList.add("ft-tm-compliance-card--active");
			} else {
				el.classList.remove("ft-tm-compliance-card--active");
			}
		}
	}

	// ── Detail panel — Characteristic list ──────────────────

	private renderCharacteristicList(filterText: string, scores: ComplianceScore[]): void {
		const score = scores.find((s) => s.standard === this.selectedStandard);
		const characteristics = getCharacteristicsByStandard(this.selectedStandard);
		const gapSet = new Set(score?.gaps ?? []);

		// Filter
		const filtered = this.applyFilter(characteristics, filterText);

		if (filtered.length === 0) {
			this.renderEmptyState();
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-tm-detail-header" });
		const def = STANDARDS.find((s) => s.id === this.selectedStandard)!;
		header.createEl("h3", { text: `${def.label} — ${def.subtitle}` });
		const meta = header.createDiv({ cls: "ft-tm-detail-meta" });
		meta.createSpan({ text: `${score?.covered ?? 0}/${score?.total ?? 0} characteristics covered` });
		meta.createSpan({ text: `${score?.percentage ?? 0}%`, cls: "ft-tm-type-badge" });

		// Characteristic rows
		const section = this.detailEl.createDiv({ cls: "ft-tm-detail-section" });
		for (const char of filtered) {
			const isCovered = !gapSet.has(char.id);
			this.renderCharacteristicRow(section, char, isCovered);
		}
	}

	private renderCharacteristicRow(container: HTMLElement, char: ComplianceCharacteristic, isCovered: boolean): void {
		const isExpanded = this.expandedCharacteristic === char.id;

		const row = container.createDiv({
			cls: `ft-tm-compliance-row${isExpanded ? " ft-tm-compliance-row--expanded" : ""}`,
		});
		row.dataset.characteristicId = char.id;

		// Header line
		const headerLine = row.createDiv({ cls: "ft-tm-compliance-row-header" });
		headerLine.createDiv({
			cls: `ft-tm-coverage-badge ft-tm-coverage-badge--${isCovered ? "covered" : "uncovered"}`,
		});
		headerLine.createDiv({ text: char.name, cls: "ft-tm-compliance-row-name" });

		headerLine.addEventListener("click", () => {
			this.expandedCharacteristic = isExpanded ? null : char.id;
			this.showJourneyListFor = null;
			// Re-render detail
			const scores = this.deps.testManagementService.getCompliance();
			this.detailEl.empty();
			this.renderCharacteristicList("", scores);
		});

		// Expanded detail
		if (isExpanded) {
			const detail = row.createDiv({ cls: "ft-tm-compliance-row-detail" });

			// Description
			detail.createDiv({ text: char.description, cls: "ft-text-sm" });

			// Guidance
			detail.createDiv({ text: char.guidance, cls: "ft-tm-compliance-guidance" });

			if (isCovered) {
				this.renderTaggedJourneys(detail, char.id);
			} else {
				this.renderTagJourneyAction(detail, char.id);
			}
		}
	}

	// ── Tag management ──────────────────────────────────────

	private renderTaggedJourneys(container: HTMLElement, characteristicId: string): void {
		const journeys = this.deps.testManagementService.getJourneys();
		const tagged = journeys.filter((j) => j.complianceTags.includes(characteristicId));

		if (tagged.length === 0) return;

		const tagContainer = container.createDiv({ cls: "ft-tm-compliance-tags" });
		for (const journey of tagged) {
			const tag = tagContainer.createDiv({ cls: "ft-tm-compliance-tag" });
			tag.createSpan({ text: journey.name });
			const removeBtn = tag.createSpan({ text: "×", cls: "ft-tm-compliance-tag-remove" });
			removeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.deps.testManagementService.removeComplianceTag(journey.name, characteristicId);
				this.render("");
			});
		}
	}

	private renderTagJourneyAction(container: HTMLElement, characteristicId: string): void {
		const isShowingList = this.showJourneyListFor === characteristicId;

		const btn = container.createEl("button", {
			text: "Tag journey",
			cls: "mod-cta ft-text-sm ft-mt-1",
		});
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.showJourneyListFor = isShowingList ? null : characteristicId;
			const scores = this.deps.testManagementService.getCompliance();
			this.detailEl.empty();
			this.renderCharacteristicList("", scores);
		});

		if (isShowingList) {
			const journeys = this.deps.testManagementService.getJourneys();
			if (journeys.length === 0) {
				container.createDiv({ text: "No journeys registered", cls: "ft-text-sm ft-text-muted" });
				return;
			}

			const list = container.createDiv({ cls: "ft-tm-compliance-journey-list" });
			for (const journey of journeys) {
				const option = list.createDiv({
					text: journey.name,
					cls: "ft-tm-compliance-journey-option",
				});
				option.addEventListener("click", (e) => {
					e.stopPropagation();
					this.deps.testManagementService.addComplianceTag(journey.name, characteristicId);
					this.showJourneyListFor = null;
					this.render("");
				});
			}
		}
	}

	// ── Empty state ─────────────────────────────────────────

	private renderEmptyState(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-tm-empty" });
		const iconEl = empty.createDiv({ cls: "ft-tm-empty-icon" });
		setIcon(iconEl, "shield");
		empty.createDiv({ text: "No characteristics match your search", cls: "ft-heading ft-heading-sm ft-mb-1" });
	}

	// ── Filtering ───────────────────────────────────────────

	private applyFilter(chars: ComplianceCharacteristic[], filterText: string): ComplianceCharacteristic[] {
		if (!filterText) return chars;
		const lower = filterText.toLowerCase();
		return chars.filter((c) =>
			c.name.toLowerCase().includes(lower)
			|| c.description.toLowerCase().includes(lower),
		);
	}
}
