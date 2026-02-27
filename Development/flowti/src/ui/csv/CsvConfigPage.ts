/**
 * Config page for the CsvActionView import wizard.
 * Split layout: left panel (form), right panel (column mapping + custom properties).
 */

import { Setting, setIcon } from "obsidian";
import type { CsvComponentDeps } from "./types";
import { getBaseFilename } from "./csvUtils";

export class CsvConfigPage {
	constructor(
		private container: HTMLElement,
		private deps: CsvComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();

		if (state.parseError) {
			const alert = ws.createDiv({ cls: "ft-alert-error ft-p-3 ft-m-3" });
			alert.createEl("strong", { text: "Parse error: " });
			alert.createSpan({ text: state.parseError });
			const actions = ws.createDiv({ cls: "ft-detail-actions ft-p-3" });
			const cancelBtn = actions.createEl("span", { cls: "ft-nav-link" });
			setIcon(cancelBtn.createSpan(), "arrow-left");
			cancelBtn.appendText(" Back to CSV");
			cancelBtn.addEventListener("click", () => {
				this.deps.resetImportState();
				this.deps.setState({ currentPage: "landing" });
				this.deps.renderContent();
			});
			return;
		}

		if (!state.parsedCsv) return;

		const split = ws.createDiv({ cls: "ft-config-split" });

		// ── Left panel: config form ──
		const panel = split.createDiv({ cls: "ft-config-panel" });

		panel.createEl("h3", { text: "Configure import", cls: "ft-heading ft-heading-sm ft-mb-2" });

		// Action bar
		const actions = panel.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-2 ft-mb-3" });
		actions.style.borderBottom = "1px solid var(--background-modifier-border)";

		const csvDetailBtn = actions.createEl("span", { cls: "ft-nav-link" });
		setIcon(csvDetailBtn.createSpan(), "file-spreadsheet");
		csvDetailBtn.appendText(" CSV Detail");
		csvDetailBtn.addEventListener("click", () => {
			this.deps.resetImportState();
			this.deps.setState({ currentPage: "landing" });
			this.deps.renderContent();
		});

		actions.createDiv({ cls: "ft-flex-1" });

		const nextBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(nextBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "eye");
		nextBtn.appendText(" Preview");
		nextBtn.addEventListener("click", () => {
			this.deps.setState({ currentPage: "preview" });
			this.deps.renderContent();
		});

		// Unsaved changes reminder (always present, visibility toggled)
		const reminder = panel.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		reminder.style.padding = "0.35rem 0.5rem";
		reminder.style.borderRadius = "var(--radius-s, 4px)";
		reminder.style.background = "var(--background-modifier-message)";
		reminder.style.display = this.deps.hasUnsavedChanges() ? "flex" : "none";
		const warnIcon = reminder.createSpan();
		setIcon(warnIcon, "alert-triangle");
		warnIcon.style.opacity = "0.6";
		warnIcon.addClass("ft-flex-shrink-0");
		reminder.createSpan({
			text: "Config has unsaved changes",
			cls: "ft-text-sm ft-text-muted",
		});
		this.deps.setUnsavedHintEl(reminder);

		// Target folder
		const targetSetting = new Setting(panel)
			.setName("Target folder")
			.setDesc("Vault folder where notes will be created")
			.addText((text) =>
				text
					.setValue(state.targetFolder)
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("path/to/folder")
					.onChange((v) => { this.deps.setState({ targetFolder: v }); this.deps.updateUnsavedHint(); }),
			);
		targetSetting.addExtraButton((btn) =>
			btn
				.setIcon("folder")
				.setTooltip("Browse vault folders")
				.onClick(() => this.deps.openFolderPicker()),
		);

		// Name column
		new Setting(panel)
			.setName("Name column")
			.setDesc("CSV column used as the note filename")
			.addDropdown((dropdown) => {
				for (const h of state.parsedCsv!.headers) {
					dropdown.addOption(h, h);
				}
				dropdown.setValue(state.nameColumn);
				dropdown.onChange((v) => { this.deps.setState({ nameColumn: v }); this.render(); });
			});

		// Name prefix / suffix
		new Setting(panel)
			.setName("Filename prefix")
			.setDesc("Prepended to each filename")
			.addText((text) =>
				text
					.setValue(state.namePrefix)
					// eslint-disable-next-line obsidianmd/ui/sentence-case
				.setPlaceholder("e.g. PROJ-")
					.onChange((v) => { this.deps.setState({ namePrefix: v }); this.deps.updateUnsavedHint(); }),
			);

		new Setting(panel)
			.setName("Filename suffix")
			.setDesc("Appended to each filename (before .md)")
			.addText((text) =>
				text
					.setValue(state.nameSuffix)
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("e.g. -draft")
					.onChange((v) => { this.deps.setState({ nameSuffix: v }); this.deps.updateUnsavedHint(); }),
			);

		// Conflict strategy
		new Setting(panel)
			.setName("Existing notes")
			.setDesc("What to do when a note already exists")
			.addDropdown((dropdown) => {
				dropdown.addOption("skip", "Skip");
				dropdown.addOption("update", "Update frontmatter");
				dropdown.addOption("overwrite", "Overwrite entire note");
				dropdown.setValue(state.conflictStrategy);
				dropdown.onChange((v) => {
					this.deps.setState({ conflictStrategy: v as typeof state.conflictStrategy });
					this.deps.updateUnsavedHint();
				});
			});

		// ── Create .base view option ───────────────────────
		const file = this.deps.getFile();
		let basePath = state.basePath;
		if (!basePath) {
			const baseFilename = getBaseFilename(file?.path ?? "imported.csv");
			basePath = state.targetFolder
				? `${state.targetFolder}/${baseFilename}`
				: baseFilename;
			this.deps.setState({ basePath });
		}
		let baseCheckPath = basePath.trim();
		if (baseCheckPath && !baseCheckPath.endsWith(".base")) baseCheckPath += ".base";
		const baseExists = !!this.deps.app.vault.getAbstractFileByPath(baseCheckPath);

		new Setting(panel)
			.setName("Create .base view")
			.setDesc(baseExists ? "A .base view already exists (will not be overwritten)" : "Generate a table view for imported notes")
			.addToggle((toggle) =>
				toggle
					.setValue(state.createBase || baseExists)
					.onChange((v) => {
						this.deps.setState({ createBase: v });
						this.render();
					}),
			);

		if (state.createBase || baseExists) {
			const baseSetting = new Setting(panel)
				.setName("Base file path")
				.setDesc("Where to save the .base view file")
				.addText((text) =>
					text
						.setValue(state.basePath)
						.setPlaceholder("path/to/view.base")
						.onChange((v) => { this.deps.setState({ basePath: v }); this.deps.updateUnsavedHint(); }),
				);
			baseSetting.addExtraButton((btn) =>
				btn
					.setIcon("folder")
					.setTooltip("Browse vault folders")
					.onClick(() => this.deps.openBaseFolderPicker()),
			);

			if (baseExists) {
				const baseRow = panel.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mt-1" });
				const baseLink = baseRow.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				const baseIcon = baseLink.createSpan();
				setIcon(baseIcon, "file-code");
				baseLink.appendText(` Open ${baseCheckPath}`);
				baseLink.addEventListener("click", () => {
					void this.deps.app.workspace.openLinkText(baseCheckPath, "", false);
				});
			}
		}

		// ── Right panel: column mapping + custom properties ──
		const content = split.createDiv({ cls: "ft-config-content" });

		const header = content.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
		const headerTitle = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		headerTitle.addClass("ft-flex-1");
		headerTitle.createEl("h3", { text: "Column mapping", cls: "ft-heading ft-heading-sm" });
		const customPropCount = Object.keys(state.customProperties).length;
		if (customPropCount > 0) {
			headerTitle.createSpan({
				text: `${customPropCount} custom prop${customPropCount !== 1 ? "s" : ""}`,
				cls: "ft-badge ft-badge-muted",
			});
		}

		// Select all / deselect all
		const selectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		selectAllBtn.textContent = "All";
		selectAllBtn.addEventListener("click", () => {
			for (const m of state.columnMappings) m.included = true;
			this.render();
		});

		const deselectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
		deselectAllBtn.textContent = "None";
		deselectAllBtn.addEventListener("click", () => {
			for (const m of state.columnMappings) m.included = false;
			this.render();
		});

		// Search
		const search = content.createEl("input", {
			type: "text",
			cls: "ft-column-search",
		});
		search.placeholder = "Search columns...";
		search.value = state.columnSearchText;
		search.addEventListener("input", () => {
			this.deps.setState({ columnSearchText: search.value });
			this.renderMappingTable(tableContainer);
		});

		// Mapping table
		const tableContainer = content.createDiv();
		this.renderMappingTable(tableContainer);

		// Custom Properties (below mappings)
		content.createEl("h4", {
			text: "Custom properties",
			cls: "ft-heading ft-heading-sm ft-mt-3 ft-mb-1",
		});
		content.createEl("p", {
			text: "Extra frontmatter key-value pairs added to every imported note.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		const propsContainer = content.createDiv({ cls: "ft-custom-props" });
		this.renderCustomProperties(propsContainer, headerTitle);

		// Sync top bar Save button visibility after every render
		this.deps.updateUnsavedHint();
	}

	private renderCustomProperties(container: HTMLElement, badgeHost?: HTMLElement): void {
		container.empty();
		const state = this.deps.getState();
		const entries = Object.entries(state.customProperties);

		const updateBadge = (): void => {
			if (!badgeHost) return;
			const existing = badgeHost.querySelector(".ft-custom-prop-badge");
			if (existing) existing.remove();
			const count = Object.keys(this.deps.getState().customProperties).length;
			if (count > 0) {
				const badge = badgeHost.createSpan({
					text: `${count} custom prop${count !== 1 ? "s" : ""}`,
					cls: "ft-badge ft-badge-muted ft-custom-prop-badge",
				});
				badgeHost.appendChild(badge);
			}
		};

		for (const [key, value] of entries) {
			const row = container.createDiv({ cls: "ft-custom-prop-row" });
			const keyInput = row.createEl("input", { type: "text", cls: "ft-custom-prop-key" });
			keyInput.placeholder = "Key";
			keyInput.value = key;
			const valInput = row.createEl("input", { type: "text", cls: "ft-custom-prop-value" });
			valInput.placeholder = "Value";
			valInput.value = value;
			const removeBtn = row.createEl("span", { cls: "ft-nav-link ft-text-sm" });
			setIcon(removeBtn, "x");
			removeBtn.addClass("ft-cursor-pointer");

			const origKey = key;
			keyInput.addEventListener("change", () => {
				const newKey = keyInput.value.trim();
				const curProps = { ...this.deps.getState().customProperties };
				if (newKey && newKey !== origKey) {
					delete curProps[origKey];
					curProps[newKey] = valInput.value;
				}
				this.deps.setState({ customProperties: curProps });
				this.deps.updateUnsavedHint();
			});
			valInput.addEventListener("change", () => {
				const k = keyInput.value.trim() || origKey;
				const curProps = { ...this.deps.getState().customProperties };
				curProps[k] = valInput.value;
				this.deps.setState({ customProperties: curProps });
				this.deps.updateUnsavedHint();
			});
			removeBtn.addEventListener("click", () => {
				const curProps = { ...this.deps.getState().customProperties };
				delete curProps[origKey];
				this.deps.setState({ customProperties: curProps });
				this.renderCustomProperties(container, badgeHost);
				updateBadge();
				this.deps.updateUnsavedHint();
			});
		}

		const addLink = container.createEl("span", { cls: "ft-nav-link ft-text-sm ft-mt-1" });
		setIcon(addLink.createSpan(), "plus");
		addLink.appendText(" Add Property");
		addLink.addClass("ft-cursor-pointer");
		addLink.addEventListener("click", () => {
			const curProps = { ...this.deps.getState().customProperties };
			const newKey = `property${entries.length + 1}`;
			curProps[newKey] = "";
			this.deps.setState({ customProperties: curProps });
			this.renderCustomProperties(container, badgeHost);
			updateBadge();
			this.deps.updateUnsavedHint();
			// Scroll the right panel to show the new property
			const scrollParent = container.closest(".ft-config-content");
			if (scrollParent) scrollParent.scrollTop = scrollParent.scrollHeight;
		});
	}

	private renderMappingTable(container: HTMLElement): void {
		container.empty();

		const state = this.deps.getState();
		if (!state.parsedCsv) return;

		const searchLower = state.columnSearchText.toLowerCase();
		const filteredMappings = state.columnMappings.filter((m) => {
			if (searchLower && !m.csvColumn.toLowerCase().includes(searchLower) &&
				!m.frontmatterKey.toLowerCase().includes(searchLower)) return false;
			return true;
		});

		const table = container.createEl("table", { cls: "ft-mapping-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Include" }).style.width = "60px";
		headerRow.createEl("th", { text: "CSV column" });
		headerRow.createEl("th").style.width = "30px"; // arrow
		headerRow.createEl("th", { text: "Frontmatter key" });

		const tbody = table.createEl("tbody");

		for (const mapping of filteredMappings) {
			const isNameCol = mapping.csvColumn === state.nameColumn;
			const tr = tbody.createEl("tr");

			// Include checkbox
			const tdCheck = tr.createEl("td");
			tdCheck.style.textAlign = "center";
			const cb = tdCheck.createEl("input", { type: "checkbox" });
			cb.checked = mapping.included;
			cb.addEventListener("change", () => { mapping.included = cb.checked; this.deps.updateUnsavedHint(); });

			// CSV column + filename badge
			const tdCol = tr.createEl("td", { cls: "ft-text-sm" });
			tdCol.appendText(mapping.csvColumn);
			if (isNameCol) {
				tdCol.createSpan({
					text: "filename",
					cls: "ft-badge ft-badge-accent",
				}).style.marginLeft = "0.5rem";
			}

			// Arrow
			tr.createEl("td", { text: "\u2192", cls: "ft-text-muted" }).style.textAlign = "center";

			// Frontmatter key
			const tdKey = tr.createEl("td");
			const input = tdKey.createEl("input", { type: "text" });
			input.value = mapping.frontmatterKey;
			input.addEventListener("input", () => { mapping.frontmatterKey = input.value; this.deps.updateUnsavedHint(); });
		}

		if (filteredMappings.length === 0) {
			const emptyRow = tbody.createEl("tr");
			const td = emptyRow.createEl("td");
			td.colSpan = 4;
			td.textContent = state.columnSearchText ? "No matching columns" : "No columns available";
			td.className = "ft-text-muted ft-text-center ft-p-3";
		}
	}
}
