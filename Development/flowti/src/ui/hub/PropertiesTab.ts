/**
 * Properties tab component for the Data Exchange Hub.
 * Renders the data dictionary master list and property detail panel.
 */

import { Notice, TFile, setIcon } from "obsidian";
import { renderEmptyDetail, getEmptyDetailStats } from "./helpers";
import type { HubComponentDeps } from "./types";

export class PropertiesTab {
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
		let entries = state.dictionaryEntries;
		if (state.filterText) {
			entries = entries.filter((e) =>
				e.propertyName.toLowerCase().includes(state.filterText),
			);
		}

		const header = this.masterEl.createDiv({ cls: "ft-master-category-header" });
		header.createSpan({ text: "Properties" });
		header.createSpan({
			text: `${entries.length}`,
			cls: "ft-master-category-count",
		});

		if (entries.length === 0) {
			const empty = this.masterEl.createDiv({ cls: "ft-text-muted ft-p-3 ft-text-center ft-text-sm" });
			empty.textContent = state.filterText ? "No matching properties" : "No properties found in configs";
			return;
		}

		for (const entry of entries) {
			const isSelected = state.selectedDictProp === entry.propertyName;
			const item = this.masterEl.createDiv({
				cls: `ft-master-event-item${isSelected ? " ft-master-event-selected" : ""}`,
			});

			const iconEl = item.createSpan();
			setIcon(iconEl, "tag");
			iconEl.style.opacity = "0.5";
			iconEl.style.flexShrink = "0";

			item.createSpan({ text: entry.propertyName, cls: "ft-master-event-name" });

			if (state.documentedProperties.has(entry.propertyName)) {
				const docIcon = item.createSpan();
				setIcon(docIcon, "file-text");
				docIcon.style.opacity = "0.4";
				docIcon.style.flexShrink = "0";
				docIcon.setAttribute("aria-label", "Documented");
			}

			item.createSpan({
				text: `${entry.usedInConfigs.length} config${entry.usedInConfigs.length !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-muted",
			});

			item.addEventListener("click", () => {
				this.deps.setState({ selectedDictProp: entry.propertyName });
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

		if (!state.selectedDictProp) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "tag", "Select a property to view details", count, label);
			return;
		}

		const entry = state.dictionaryEntries.find(
			(e) => e.propertyName === state.selectedDictProp,
		);
		if (!entry) {
			const { count, label } = getEmptyDetailStats(this.deps);
			renderEmptyDetail(this.detailEl, "tag", "Property not found", count, label);
			return;
		}

		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-header" });
		const left = header.createDiv();
		left.createDiv({ text: entry.propertyName, cls: "ft-detail-event-type" });
		const badges = left.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
		badges.createSpan({
			text: `${entry.usedInConfigs.length} config${entry.usedInConfigs.length !== 1 ? "s" : ""}`,
			cls: "ft-badge ft-badge-muted",
		});
		if (entry.typeNames && entry.typeNames.length > 0) {
			for (const typeName of entry.typeNames) {
				const chip = badges.createSpan({
					text: typeName,
					cls: "ft-badge",
				});
				chip.style.cursor = "pointer";
				chip.addEventListener("click", () => {
					this.deps.setState({ selectedTypeName: typeName });
					this.deps.navigation.navigateTo("types");
				});
			}
		}

		// Description from PropertyDoc frontmatter
		const hasDoc = state.documentedProperties.has(entry.propertyName);
		if (hasDoc) {
			const docPath = this.deps.dataExchangeService.getPropertyDocPath(entry.propertyName);
			const docFile = this.deps.app.vault.getAbstractFileByPath(docPath);
			if (docFile instanceof TFile) {
				const cache = this.deps.app.metadataCache.getFileCache(docFile);
				const description = cache?.frontmatter?.description;
				if (description && String(description).trim()) {
					left.createDiv({
						text: String(description),
						cls: "ft-detail-description ft-mt-1",
					});
				}
			}
		}

		// CSV column names
		if (entry.csvColumnNames.length > 0) {
			const card = this.detailEl.createDiv({ cls: "ft-card ft-mt-3" });
			card.createDiv({ text: "CSV Columns", cls: "ft-detail-section-header" });
			const chips = card.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const col of entry.csvColumnNames) {
				chips.createSpan({ text: col, cls: "ft-badge ft-badge-muted" });
			}
		}

		// Configs using this property
		if (entry.usedInConfigs.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: "Used In Configs", cls: "ft-detail-section-header" });

			for (const ref of entry.usedInConfigs) {
				const item = section.createDiv({ cls: "ft-master-event-item" });
				const iconEl = item.createSpan();
				setIcon(iconEl, ref.configType === "import" ? "file-input" : "file-output");
				iconEl.style.opacity = "0.5";
				iconEl.style.flexShrink = "0";

				item.createSpan({ text: ref.configName, cls: "ft-master-event-name" });
				item.createSpan({
					text: ref.configType === "import" ? "Import" : "Export",
					cls: `ft-operation-badge ft-operation-badge-${ref.configType}`,
				});

				item.addEventListener("click", () => {
					if (ref.configType === "import") {
						this.deps.setState({ selectedImportId: ref.configId });
						this.deps.navigation.navigateTo("imports");
					} else {
						this.deps.setState({ selectedExportId: ref.configId });
						this.deps.navigation.navigateTo("exports");
					}
				});
			}
		}

		// Sample values
		if (entry.sampleValues.length > 0) {
			const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-mt-3" });
			section.createDiv({ text: "Sample Values", cls: "ft-detail-section-header" });
			const chips = section.createDiv({ cls: "ft-flex ft-gap-1 ft-mt-1" });
			chips.style.flexWrap = "wrap";
			for (const val of entry.sampleValues) {
				chips.createSpan({ text: val, cls: "ft-badge ft-badge-muted" });
			}
		}

		// Actions: Create / Open documentation
		const actions = this.detailEl.createDiv({ cls: "ft-detail-actions ft-mt-3" });

		if (hasDoc) {
			const openLink = actions.createEl("span", { cls: "ft-nav-link" });
			const openIcon = openLink.createSpan();
			setIcon(openIcon, "file-text");
			openLink.appendText(" Open Documentation");
			openLink.addEventListener("click", () => {
				const docPath = this.deps.dataExchangeService.getPropertyDocPath(entry.propertyName);
				void this.deps.app.workspace.openLinkText(docPath, "", false);
			});
		} else {
			const createLink = actions.createEl("span", { cls: "ft-nav-link" });
			const createIcon = createLink.createSpan();
			setIcon(createIcon, "file-plus");
			createLink.appendText(" Create Documentation");
			createLink.addEventListener("click", () => {
				void this.deps.dataExchangeService.createPropertyDoc(entry.propertyName).then((docPath) => {
					new Notice(`Created property doc: ${entry.propertyName}`);
					void this.deps.app.workspace.openLinkText(docPath, "", false);
				});
			});
		}
	}
}
