/**
 * Detail panel component for the Domains tab.
 * Handles rendering of domain details, actions, events list, and related entities.
 */

import { setIcon } from "obsidian";
import {
	renderStat, renderRelatedSection,
	findRelatedFlows, findRelatedSystems, findRelatedActors,
	openFile,
} from "./helpers";
import { getArchitectureDocPathResolved } from "../eventDocTemplate";
import { ConfirmModal } from "../modals";
import type { CatalogComponentDeps, DomainEntry } from "./types";

export interface DomainDetailCallbacks {
	getSelectedDomain(): string | null;
	getEntries(): DomainEntry[];
	createDoc(name: string): void;
	deleteDoc(filePath: string): void;
	createArea(name: string): void;
	createArchitectureDoc(name: string): void;
}

export class DomainDetailPanel {
	constructor(
		private detailEl: HTMLElement,
		private deps: CatalogComponentDeps,
		private callbacks: DomainDetailCallbacks,
	) {}

	render(): void {
		this.detailEl.empty();

		const selectedDomain = this.callbacks.getSelectedDomain();
		if (!selectedDomain) {
			this.renderEmpty();
			return;
		}

		const domainData = this.callbacks.getEntries().find((d) => d.name === selectedDomain);
		if (!domainData) {
			this.renderEmpty();
			return;
		}

		this.renderDomainDetail(domainData);
	}

	private renderDomainDetail(domainData: DomainEntry): void {
		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: domainData.name, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({ text: `${domainData.events.length} events`, cls: "ft-badge ft-badge-muted" });
		if (domainData.isArea) {
			badges.createSpan({ text: "area", cls: "ft-badge ft-badge-area" });
		}
		if (domainData.isSystem) {
			badges.createSpan({ text: "system", cls: "ft-badge ft-badge-system" });
		} else if (domainData.filePath === null) {
			badges.createSpan({ text: "undocumented", cls: "ft-badge ft-badge-muted" });
		}

		// Description
		if (domainData.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
			descCard.createEl("p", {
				text: domainData.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Info card
		const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-2" });
		const grid = card.createDiv({ cls: "ft-detail-info-grid" });

		const addRow = (label: string, value: string) => {
			grid.createDiv({ text: label, cls: "ft-detail-info-label" });
			grid.createDiv({ text: value, cls: "ft-detail-info-value" });
		};

		addRow("Total Events", String(domainData.events.length));
		addRow("Configured", String(domainData.configuredCount));
		addRow("Visible in Log", `${domainData.visibleCount} / ${domainData.events.length}`);
		addRow("Categories", domainData.categories.join(", "));

		// Services — each clickable
		grid.createDiv({ text: "Services", cls: "ft-detail-info-label" });
		const svcVal = grid.createDiv({ cls: "ft-detail-info-value ft-flex ft-gap-1" });
		if (domainData.services.length > 0) {
			for (const svc of domainData.services) {
				const svcLink = svcVal.createEl("span", { text: svc, cls: "ft-nav-link" });
				svcLink.addEventListener("click", () => this.deps.navigation.navigateToService(svc));
			}
		} else {
			svcVal.createSpan({ text: "(none)", cls: "ft-text-muted" });
		}

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions" });

		// Open / create doc
		const docBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const docIcon = docBtn.createSpan();
		setIcon(docIcon, "file-text");
		docBtn.appendText(domainData.filePath ? " Open Doc" : " Create Doc");
		docBtn.addEventListener("click", () => {
			if (domainData.filePath) {
				void openFile(this.deps.workspace, domainData.filePath);
			} else {
				this.callbacks.createDoc(domainData.name);
			}
		});

		// Architecture Doc button
		const archBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const archIcon = archBtn.createSpan();
		setIcon(archIcon, "layout");
		const archDocPath = getArchitectureDocPathResolved(
			this.deps.getEntityFolder("domains"), domainData.name,
		);
		const archExists = !!this.deps.app.vault.getAbstractFileByPath(archDocPath);
		archBtn.appendText(archExists ? " Architecture Doc" : " Create Architecture Doc");
		archBtn.addEventListener("click", () => {
			this.callbacks.createArchitectureDoc(domainData.name);
		});

		// Mark as Area button
		const areaPath = `02 - Areas/${domainData.name}/${domainData.name}.md`;
		const areaExists = !!this.deps.app.vault.getAbstractFileByPath(areaPath);
		const areaBtn = actions.createEl("span", { cls: "ft-nav-link" });
		const areaIcon = areaBtn.createSpan();
		setIcon(areaIcon, areaExists ? "map-pin" : "map");
		areaBtn.appendText(areaExists ? " Open Area" : " Mark as Area");
		areaBtn.addEventListener("click", () => {
			this.callbacks.createArea(domainData.name);
		});

		// Delete button for documented domains (file-based only)
		if (domainData.filePath) {
			const delBtn = actions.createEl("button", { cls: "ft-btn ft-btn-ghost ft-text-sm" });
			delBtn.style.color = "var(--text-error)";
			const delIcon = delBtn.createSpan();
			setIcon(delIcon, "trash-2");
			delBtn.appendText(" Delete");
			delBtn.addEventListener("click", () => {
				new ConfirmModal(this.deps.app, {
					message: `Delete domain doc "${domainData.name}"?`,
					confirmLabel: "Delete",
					onConfirm: () => {
						this.callbacks.deleteDoc(domainData.filePath!);
					},
				}).open();
			});
		}

		// Events list
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		const sectionHeader = section.createDiv({ cls: "ft-detail-section-header" });
		sectionHeader.createSpan({
			text: `Events (${domainData.events.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		for (const entry of domainData.events) {
			const row = section.createDiv({ cls: "ft-catalog-row" });
			row.addClass("ft-cursor-pointer");

			row.createSpan({ text: entry.type, cls: "ft-event-type" });
			row.createSpan({ text: entry.category, cls: "ft-catalog-meta" });

			row.addEventListener("click", () => {
				this.deps.navigation.navigateToEvent(entry.type);
			});
		}

		// Related entities
		const state = this.deps.getState();
		const criteria = { domains: [domainData.name] };

		renderRelatedSection(
			this.detailEl, "Related Flows",
			findRelatedFlows(state.flowEntries, criteria).map((f) => ({
				name: f.name,
				onClick: () => this.deps.navigation.navigateToFlow(f.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Systems",
			findRelatedSystems(state.systemEntries, criteria).map((s) => ({
				name: s.name,
				onClick: () => this.deps.navigation.navigateToSystem(s.name),
			})),
		);
		renderRelatedSection(
			this.detailEl, "Related Actors",
			findRelatedActors(state.actorEntries, criteria).map((a) => ({
				name: a.name,
				onClick: () => this.deps.navigation.navigateToActor(a.name),
			})),
		);
	}

	private renderEmpty(): void {
		const entries = this.callbacks.getEntries();
		const empty = this.detailEl.createDiv({ cls: "ft-catalog-detail-empty" });

		const icon = empty.createDiv();
		setIcon(icon, "boxes");
		icon.addClass("ft-icon-subtle");

		empty.createEl("p", { text: "Select a domain to view details" });

		const stats = empty.createDiv({ cls: "ft-catalog-quick-stats" });
		renderStat(stats, `${entries.length}`, "domains");
		const totalEvents = entries.reduce((sum, d) => sum + d.events.length, 0);
		renderStat(stats, `${totalEvents}`, "events");
		const totalConfigured = entries.reduce((sum, d) => sum + d.configuredCount, 0);
		renderStat(stats, `${totalConfigured}`, "configured");
	}
}
