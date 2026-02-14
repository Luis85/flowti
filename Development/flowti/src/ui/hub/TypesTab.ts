/**
 * Types tab component for the Data Exchange Hub.
 * Renders the master list of TypeDoc entries and the detail panel with lifecycle events.
 */

import { TFile, setIcon } from "obsidian";
import { ConfirmModal, InputModal } from "../modals";
import { renderEmptyDetail, openEventInCatalog, getEmptyDetailStats } from "./helpers";
import type { HubComponentDeps } from "./types";

export class TypesTab {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: HubComponentDeps,
	) {}

	// ─────────────────────────────────────────────────────────
	// Master list
	// ─────────────────────────────────────────────────────────

	renderMaster(): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		let entries = state.typeEntries;
		if (state.filterText) {
			entries = entries.filter((e) =>
				e.name.toLowerCase().includes(state.filterText) ||
				e.description.toLowerCase().includes(state.filterText),
			);
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Note Types" });
		header.createSpan({
			text: `${entries.length}`,
			cls: "ft-master-category-count",
		});
		const headerSpacer = header.createDiv();
		headerSpacer.style.flex = "1";
		const addBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.setAttr("aria-label", "New Type");
		addBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			new InputModal(this.deps.app, {
				title: "New Note Type",
				placeholder: "e.g. Event, Asset, Service",
				onSubmit: (name) => {
					if (!name.trim()) return;
					void this.deps.dataExchangeService
						.createOrUpdateTypeDoc(name.trim())
						.then(() => {
							setTimeout(() => {
								this.deps.setState({ selectedTypeName: name.trim() });
								this.deps.scheduleRender();
							}, 500);
						});
				},
			}).open();
		});

		if (entries.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText ? "No matching types" : "No note types found";
			return;
		}

		for (const entry of entries) {
			const isSelected = state.selectedTypeName === entry.name;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});
			item.style.alignItems = "flex-start";

			const iconEl = item.createSpan();
			setIcon(iconEl, "shapes");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";
			iconEl.style.marginTop = "0.125rem";

			const textBlock = item.createDiv({ cls: "ft-master-event-name" });
			textBlock.style.minWidth = "0";
			textBlock.createDiv({ text: entry.name });
			const sub = textBlock.createDiv({ cls: "ft-text-muted ft-text-sm" });
			sub.style.whiteSpace = "nowrap";
			sub.style.overflow = "hidden";
			sub.style.textOverflow = "ellipsis";
			sub.textContent = `${entry.properties.length} field${entry.properties.length !== 1 ? "s" : ""} · ${entry.pipelineCount} config${entry.pipelineCount !== 1 ? "s" : ""}`;

			const docIcon = item.createSpan();
			setIcon(docIcon, "file-text");
			docIcon.style.opacity = "0.4";
			docIcon.style.flexShrink = "0";
			docIcon.setAttribute("aria-label", "TypeDoc");

			item.addEventListener("click", () => {
				this.deps.setState({ selectedTypeName: entry.name });
				this.renderMaster();
				this.renderDetail();
			});
		}
	}

	// ─────────────────────────────────────────────────────────
	// Detail panel
	// ─────────────────────────────────────────────────────────

	renderDetail(): void {
		this.detailEl.empty();
		const state = this.deps.getState();

		if (!state.selectedTypeName) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "shapes", "Select a type to view details", count, label);
			return;
		}

		const entry = state.typeEntries.find((e) => e.name === state.selectedTypeName);
		if (!entry) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "shapes", "Type not found", count, label);
			return;
		}

		const typeName = entry.name;
		const lowerType = typeName.toLowerCase();

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: typeName, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({
			text: `${entry.properties.length} field${entry.properties.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});

		// Actions
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-2" });

		const openLink = actions.createEl("span", { cls: "ft-nav-link" });
		const openIcon = openLink.createSpan();
		setIcon(openIcon, "file-text");
		openLink.appendText(" Open Doc");
		openLink.addEventListener("click", () => {
			void this.deps.app.workspace.openLinkText(entry.filePath, "", false);
		});

		const deleteLink = actions.createEl("span", { cls: "ft-nav-link" });
		deleteLink.style.color = "var(--text-error)";
		const delIcon = deleteLink.createSpan();
		setIcon(delIcon, "trash-2");
		deleteLink.appendText(" Delete");
		deleteLink.addEventListener("click", () => {
			new ConfirmModal(this.deps.app, {
				message: `Delete type "${typeName}" and its documentation?`,
				confirmLabel: "Delete",
				onConfirm: () => {
					const file = this.deps.app.vault.getAbstractFileByPath(entry.filePath);
					if (file instanceof TFile) {
						void this.deps.app.vault.delete(file).then(() => {
							this.deps.setState({ selectedTypeName: null });
							setTimeout(() => this.deps.scheduleRender(), 300);
						});
					}
				},
			}).open();
		});

		// Description
		if (entry.description) {
			const descCard = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			descCard.createDiv({ text: entry.description, cls: "ft-text-muted ft-p-2" });
		}

		// Created by (imports / pipelines that produce this type)
		const producers = [
			...state.pipelineConfigs.filter((p) => p.noteType === typeName),
			...state.importConfigs.filter((c) => c.noteType === typeName),
		];
		if (producers.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Created by", cls: "ft-detail-section-header" });

			for (const cfg of producers) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const isPipeline = "sources" in cfg;
				const cfgIcon = item.createSpan();
				setIcon(cfgIcon, isPipeline ? "layers" : "file-input");
				cfgIcon.style.opacity = "0.5";
				cfgIcon.style.flexShrink = "0";

				item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
				item.createSpan({
					text: isPipeline ? "Pipeline" : "Import",
					cls: "ft-badge ft-badge-muted",
				});

				item.addEventListener("click", () => {
					if (isPipeline) {
						this.deps.setState({ selectedPipelineId: cfg.id });
						this.deps.navigation.navigateTo("pipelines");
					} else {
						this.deps.setState({ selectedImportId: cfg.id });
						this.deps.navigation.navigateTo("imports");
					}
				});
			}
		}

		// Consumed by (exports that read this type)
		const consumers = state.exportConfigs.filter((c) => c.noteType === typeName);
		if (consumers.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Consumed by", cls: "ft-detail-section-header" });

			for (const cfg of consumers) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const cfgIcon = item.createSpan();
				setIcon(cfgIcon, "file-output");
				cfgIcon.style.opacity = "0.5";
				cfgIcon.style.flexShrink = "0";

				item.createSpan({ text: cfg.name, cls: "ft-master-event-name" });
				item.createSpan({
					text: "Export",
					cls: "ft-badge ft-badge-muted",
				});

				item.addEventListener("click", () => {
					this.deps.setState({ selectedExportId: cfg.id });
					this.deps.navigation.navigateTo("exports");
				});
			}
		}

		// Events (CRUD lifecycle)
		const crudEvents = [
			{ event: `${lowerType}.created`, label: "Created", icon: "plus-circle", desc: `A new ${typeName} was added` },
			{ event: `${lowerType}.read`, label: "Read", icon: "eye", desc: `A ${typeName} was viewed or queried` },
			{ event: `${lowerType}.updated`, label: "Updated", icon: "edit", desc: `An existing ${typeName} was modified` },
			{ event: `${lowerType}.deleted`, label: "Deleted", icon: "trash", desc: `A ${typeName} was removed` },
		];

		const eventsSection = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
		eventsSection.createDiv({ text: "Lifecycle Events", cls: "ft-detail-section-header" });

		for (const ev of crudEvents) {
			const row = eventsSection.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-py-1" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			const evIcon = row.createSpan();
			setIcon(evIcon, ev.icon);
			evIcon.style.opacity = "0.5";
			evIcon.style.flexShrink = "0";

			const textBlock = row.createDiv();
			textBlock.style.flex = "1";
			textBlock.style.minWidth = "0";
			const nameEl = textBlock.createDiv({ cls: "ft-text-sm" });
			nameEl.createEl("code", { text: ev.event });
			textBlock.createDiv({ text: ev.desc, cls: "ft-text-muted ft-text-sm" });

			// Open EventDoc
			const docBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			docBtn.style.flexShrink = "0";
			const docBtnIcon = docBtn.createSpan();
			setIcon(docBtnIcon, "file-text");
			docBtn.title = "Open event doc";
			docBtn.addEventListener("click", () => {
				const docPath = this.deps.dataExchangeService.getEventDocPath(ev.event);
				void this.deps.app.workspace.openLinkText(docPath, "", false);
			});

			// Show in Event Catalog
			const catalogBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			catalogBtn.style.flexShrink = "0";
			const catIcon = catalogBtn.createSpan();
			setIcon(catIcon, "list");
			catalogBtn.title = "Show in Event Catalog";
			catalogBtn.addEventListener("click", () => {
				openEventInCatalog(this.deps, ev.event);
			});
		}

		// Fields (expected properties)
		if (entry.properties.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			section.createDiv({ text: "Fields", cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			chips.style.padding = "0.25rem 0.5rem";
			for (const prop of entry.properties) {
				const chip = chips.createSpan({ text: prop, cls: "ft-badge ft-badge-muted" });
				chip.style.cursor = "pointer";
				chip.addEventListener("click", () => {
					this.deps.setState({ selectedDictProp: prop });
					this.deps.navigation.navigateTo("properties");
				});
			}
		}
	}
}
