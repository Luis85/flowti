/**
 * Configure page for the ExportView wizard.
 * Split layout: settings form on the left, property grid on the right.
 */

import { Setting, setIcon } from "obsidian";
import type { ExportConflictStrategy, ExportFormat } from "../../domain/dataExchange/types";
import { STANDARD_FILE_PROPERTIES } from "../../domain/dataExchange/types";
import { swapOutputExtension, getOutputFolder, getOutputFilename, buildOutputPath } from "./exportUtils";
import type { ExportComponentDeps } from "./types";

export class ConfigurePage {
	constructor(
		private container: HTMLElement,
		private deps: ExportComponentDeps,
	) {}

	render(): void {
		const ws = this.container;
		ws.empty();

		const state = this.deps.getState();
		const split = ws.createDiv({ cls: "ft-config-split" });

		// ── Left panel: settings ──
		const panel = split.createDiv({ cls: "ft-config-panel" });
		panel.createEl("h3", {
			text: "Configure export",
			cls: "ft-heading ft-heading-sm ft-mb-2",
		});

		// Action bar
		const actions = panel.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-py-2 ft-mb-3" });
		actions.style.borderBottom = "1px solid var(--background-modifier-border)";

		if (state.sourceType === "base") {
			const backBtn = actions.createEl("span", { cls: "ft-nav-link" });
			setIcon(backBtn.createSpan(), "arrow-left");
			backBtn.appendText(" Views");
			backBtn.addEventListener("click", () => {
				this.deps.setState({ currentPage: "view-select" });
				this.deps.renderPage();
			});
		} else {
			const closeBtn = actions.createEl("span", { cls: "ft-nav-link" });
			setIcon(closeBtn.createSpan(), "x");
			closeBtn.appendText(" Close");
			closeBtn.addEventListener("click", () => this.deps.detachLeaf());
		}

		actions.createDiv({ cls: "ft-flex-1" });

		const previewBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm mod-cta" });
		setIcon(previewBtn.createSpan({ cls: "flowti-csv-btn-icon" }), "eye");
		previewBtn.appendText(" Preview");
		previewBtn.addEventListener("click", () => {
			this.deps.setState({ currentPage: "preview" });
			this.deps.renderPage();
		});

		// Unsaved changes reminder
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

		// Format
		new Setting(panel)
			.setName("Format")
			.setDesc("Output file format")
			.addDropdown((dd) =>
				dd
					.addOptions({
						csv: "CSV (comma-separated)",
						tab: "Tab-delimited (.txt)",
					})
					.setValue(state.format)
					.onChange((v) => {
						const oldFormat = state.format;
						const newFormat = v as ExportFormat;
						const newOutputPath = swapOutputExtension(state.outputPath, oldFormat, newFormat);
						this.deps.setState({ format: newFormat, outputPath: newOutputPath });
						this.deps.updateUnsavedHint();
						this.deps.renderPage();
					}),
			);

		// Output folder + filename (vault mode) or single path (external mode)
		if (state.isExternal) {
			const outputSetting = new Setting(panel)
				.setName("Output path")
				.setDesc("Saving to filesystem (absolute path)")
				.addText((text) =>
					text
						.setValue(state.outputPath)
						.setPlaceholder("C:\\path\\to\\output.csv")
						.onChange((v) => {
							this.deps.setState({ outputPath: v });
							this.deps.updateUnsavedHint();
						}),
				);
			outputSetting.addExtraButton((btn) =>
				btn
					.setIcon("hard-drive")
					.setTooltip("Browse filesystem")
					.onClick(() => void this.deps.openNativeSaveDialog()),
			);
			outputSetting.addExtraButton((btn) =>
				btn
					.setIcon("vault")
					.setTooltip("Switch to vault")
					.onClick(() => {
						const filename = getOutputFilename(state.outputPath);
						this.deps.setState({ isExternal: false, outputPath: filename });
						this.render();
					}),
			);
		} else {
			new Setting(panel)
				.setName("Output folder")
				.setDesc("Folder inside the vault")
				.addText((text) =>
					text
						.setValue(getOutputFolder(state.outputPath))
						// eslint-disable-next-line obsidianmd/ui/sentence-case
						.setPlaceholder("path/to/folder")
						.onChange((v) => {
							const filename = getOutputFilename(state.outputPath);
							this.deps.setState({ outputPath: buildOutputPath(v, filename) });
							this.deps.updateUnsavedHint();
						}),
				)
				.addExtraButton((btn) =>
					btn
						.setIcon("folder")
						.setTooltip("Browse vault folders")
						.onClick(() => this.deps.openFolderPicker()),
				);

			const ext = state.format === "tab" ? ".txt" : ".csv";
			const filenameSetting = new Setting(panel)
				.setName("Filename")
				.addText((text) =>
					text
						.setValue(getOutputFilename(state.outputPath))
						.setPlaceholder(`export${ext}`)
						.onChange((v) => {
							const folder = getOutputFolder(state.outputPath);
							this.deps.setState({ outputPath: buildOutputPath(folder, v) });
							this.deps.updateUnsavedHint();
						}),
				);
			filenameSetting.addExtraButton((btn) =>
				btn
					.setIcon("hard-drive")
					.setTooltip("Save to filesystem")
					.onClick(() => void this.deps.openNativeSaveDialog()),
			);
		}

		// Conflict strategy
		new Setting(panel)
			.setName("If file exists")
			.setDesc("How to handle an existing output file")
			.addDropdown((dd) =>
				dd
					.addOptions({
						overwrite: "Overwrite",
						skip: "Skip (do nothing)",
						append: "Append rows",
					})
					.setValue(state.conflictStrategy)
					.onChange((v) => {
						this.deps.setState({ conflictStrategy: v as ExportConflictStrategy });
						this.deps.updateUnsavedHint();
					}),
			);

		// Note type
		new Setting(panel)
			.setName("Note type")
			.setDesc("Associate this export with a type for TypeDoc creation (optional)")
			.addText((t) =>
				t
					.setValue(state.noteType)
					.setPlaceholder("Event, asset, service")
					.onChange((v) => {
						this.deps.setState({ noteType: v });
						this.deps.updateUnsavedHint();
					}),
			);

		// ── Right panel: all properties ──
		const content = split.createDiv({ cls: "ft-config-content" });

		if (state.resolvedColumns && state.resolvedColumns.length > 0) {
			// Read-only view columns for Base exports with resolved columns
			const header = content.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
			header.createEl("h3", { text: "View columns", cls: "ft-heading ft-heading-sm" });
			header.addClass("ft-flex-1");

			const info = content.createDiv({ cls: "ft-text-sm ft-text-muted ft-mb-3" });
			info.textContent = "Columns defined by base view (read-only)";

			const grid = content.createDiv({ cls: "ft-property-grid" });
			for (const rc of state.resolvedColumns) {
				const item = grid.createDiv({ cls: "ft-property-item" });
				const cb = item.createEl("input", { type: "checkbox" });
				cb.checked = true;
				cb.disabled = true;
				const label = item.createSpan({ text: rc.header });
				if (rc.source === "file") {
					label.createSpan({ text: " (file)", cls: "ft-text-muted ft-text-xs" });
				} else if (rc.source === "formula") {
					label.createSpan({ text: " (formula)", cls: "ft-text-muted ft-text-xs" });
				}
			}
		} else {
			// Legacy editable property grid for folder exports / base without order
			const header = content.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-3" });
			header.createEl("h3", { text: "Properties", cls: "ft-heading ft-heading-sm" });
			header.addClass("ft-flex-1");

			// Select all / deselect all
			if (state.availableColumns.length > 0) {
				const selectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				selectAllBtn.textContent = "All";
				selectAllBtn.addEventListener("click", () => {
					this.deps.setState({
						selectedColumns: [...state.availableColumns],
						selectedFileProperties: STANDARD_FILE_PROPERTIES.map((fp) => fp.key),
					});
					this.render();
				});

				const deselectAllBtn = header.createEl("span", { cls: "ft-nav-link ft-text-sm" });
				deselectAllBtn.textContent = "None";
				deselectAllBtn.addEventListener("click", () => {
					this.deps.setState({
						selectedColumns: [],
						selectedFileProperties: [],
					});
					this.render();
				});
			}

			// Search
			const search = content.createEl("input", {
				type: "text",
				cls: "ft-column-search",
			});
			search.placeholder = "Search properties...";
			search.value = state.propertySearchText;
			search.addEventListener("input", () => {
				this.deps.setState({ propertySearchText: search.value });
				this.renderPropertyGrid(gridContainer);
			});

			const gridContainer = content.createDiv();
			this.renderPropertyGrid(gridContainer);
		}
	}

	private renderPropertyGrid(container: HTMLElement): void {
		container.empty();

		const state = this.deps.getState();
		const searchLower = state.propertySearchText.toLowerCase();

		// ── File Properties section ──
		const filteredFileProps = STANDARD_FILE_PROPERTIES.filter((fp) =>
			!searchLower || fp.label.toLowerCase().includes(searchLower) || fp.key.toLowerCase().includes(searchLower),
		);
		if (filteredFileProps.length > 0) {
			container.createEl("h4", { text: "File properties", cls: "ft-mt-2 ft-heading ft-heading-sm ft-mb-1" });
			const fileGrid = container.createDiv({ cls: "ft-property-grid" });
			for (const fp of filteredFileProps) {
				const item = fileGrid.createDiv({ cls: "ft-property-item" });
				const cb = item.createEl("input", { type: "checkbox" });
				cb.checked = state.selectedFileProperties.includes(fp.key);
				const key = fp.key;
				cb.addEventListener("change", () => {
					const current = this.deps.getState().selectedFileProperties;
					if (cb.checked) {
						if (!current.includes(key)) {
							this.deps.setState({ selectedFileProperties: [...current, key] });
						}
					} else {
						this.deps.setState({
							selectedFileProperties: current.filter((p) => p !== key),
						});
					}
					this.deps.updateUnsavedHint();
				});
				item.createSpan({ text: fp.label });
			}
		}

		// ── Note Properties section ──
		const filteredCols = state.availableColumns.filter((col) =>
			!searchLower || col.toLowerCase().includes(searchLower),
		);
		if (filteredCols.length > 0) {
			container.createEl("h4", { text: "Note properties", cls: "ft-mt-3 ft-heading ft-heading-sm ft-mb-1" });
			const noteGrid = container.createDiv({ cls: "ft-property-grid" });
			for (const col of filteredCols) {
				const item = noteGrid.createDiv({ cls: "ft-property-item" });
				const cb = item.createEl("input", { type: "checkbox" });
				cb.checked = state.selectedColumns.includes(col);
				cb.addEventListener("change", () => {
					const current = this.deps.getState().selectedColumns;
					if (cb.checked) {
						if (!current.includes(col)) {
							this.deps.setState({ selectedColumns: [...current, col] });
						}
					} else {
						this.deps.setState({
							selectedColumns: current.filter((c) => c !== col),
						});
					}
					this.deps.updateUnsavedHint();
				});
				item.createSpan({ text: col });
			}
		}

		if (filteredFileProps.length === 0 && filteredCols.length === 0) {
			container.createEl("p", {
				text: state.propertySearchText ? "No matching properties" : "No properties available",
				cls: "ft-text-muted ft-text-sm ft-p-3",
			});
		}
	}
}
