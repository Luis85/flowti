/**
 * NewQueryModal — prompts for a query name and source selection.
 *
 * Extends Obsidian Modal. Shows a name input, a searchable grouped source
 * list (CSV files, Base views, CSV folders), and Create/Cancel buttons.
 * Create is disabled until name is non-empty and at least one source is selected.
 */

import { Modal } from "obsidian";
import type { App } from "obsidian";
import type { AnalyticsCsvEntry, AnalyticsBaseEntry, AnalyticsFolderEntry } from "./types";

export interface NewQuerySource {
	path: string;
	alias: string;
	sourceType: "csv" | "base" | "csv-folder";
	viewIndex?: number;
}

export interface NewQueryModalOptions {
	csvFiles: AnalyticsCsvEntry[];
	baseFiles: AnalyticsBaseEntry[];
	csvFolders: AnalyticsFolderEntry[];
	onConfirm: (name: string, sources: NewQuerySource[]) => void;
}

export class NewQueryModal extends Modal {
	private readonly options: NewQueryModalOptions;
	private selectedPaths = new Set<string>();
	private searchText = "";

	constructor(app: App, options: NewQueryModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.style.minWidth = "400px";

		contentEl.createEl("h3", { text: "New Query" });
		contentEl.createDiv({
			text: "Name your query and select one or more data sources.",
			cls: "ft-text-muted ft-text-sm",
		});

		// ── Name input ──────────────────────────────
		const nameInput = contentEl.createEl("input", { type: "text" });
		nameInput.placeholder = "Query name";
		nameInput.style.cssText = "width:100%;margin-top:0.75rem;margin-bottom:0.75rem";

		// ── Source search ────────────────────────────
		const searchInput = contentEl.createEl("input", { type: "text" });
		searchInput.placeholder = "Search sources...";
		searchInput.style.cssText = "width:100%;margin-bottom:0.5rem;font-size:var(--font-ui-small)";

		// ── Source list ──────────────────────────────
		const listContainer = contentEl.createDiv();
		listContainer.style.cssText = "max-height:250px;overflow-y:auto;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);margin-bottom:0.75rem";

		// ── Actions ──────────────────────────────────
		const btnRow = contentEl.createDiv({ cls: "ft-flex ft-gap-1" });
		btnRow.style.justifyContent = "flex-end";

		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const createBtn = btnRow.createEl("button", { text: "Create", cls: "mod-cta" });
		createBtn.disabled = true;

		const updateCreateBtn = () => {
			createBtn.disabled = nameInput.value.trim().length === 0 || this.selectedPaths.size === 0;
		};

		nameInput.addEventListener("input", updateCreateBtn);

		searchInput.addEventListener("input", () => {
			this.searchText = searchInput.value.trim().toLowerCase();
			this.renderSourceList(listContainer, updateCreateBtn);
		});

		this.renderSourceList(listContainer, updateCreateBtn);

		const submit = (): void => {
			const name = nameInput.value.trim();
			if (name.length === 0 || this.selectedPaths.size === 0) return;
			const sources = this.buildSelectedSources();
			this.options.onConfirm(name, sources);
			this.close();
		};

		createBtn.addEventListener("click", submit);
		nameInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") { e.preventDefault(); submit(); }
		});

		setTimeout(() => nameInput.focus(), 50);
	}

	private renderSourceList(container: HTMLElement, onChange: () => void): void {
		container.empty();
		const { csvFiles, baseFiles, csvFolders } = this.options;
		const search = this.searchText;

		const filteredCsv = search ? csvFiles.filter((f) => f.displayName.toLowerCase().includes(search)) : csvFiles;
		const filteredBase = search ? baseFiles.filter((f) => f.displayName.toLowerCase().includes(search)) : baseFiles;
		const filteredFolders = search ? csvFolders.filter((f) => f.displayName.toLowerCase().includes(search)) : csvFolders;

		if (filteredCsv.length > 0) {
			this.renderGroup(container, "CSV Files", filteredCsv.map((f) => ({ path: f.path, label: f.displayName, sourceType: "csv" as const })), onChange);
		}
		if (filteredBase.length > 0) {
			this.renderGroup(container, "Base Views", filteredBase.map((f) => ({ path: f.path, label: f.displayName, sourceType: "base" as const })), onChange);
		}
		if (filteredFolders.length > 0) {
			this.renderGroup(container, "Folders", filteredFolders.map((f) => ({ path: f.path, label: `${f.displayName} (${f.fileCount} files)`, sourceType: "csv-folder" as const })), onChange);
		}

		if (filteredCsv.length === 0 && filteredBase.length === 0 && filteredFolders.length === 0) {
			container.createDiv({ text: search ? "No sources match your search." : "No data sources found in vault.", cls: "ft-text-muted ft-text-sm" }).style.padding = "0.75rem";
		}
	}

	private renderGroup(
		container: HTMLElement,
		title: string,
		items: Array<{ path: string; label: string; sourceType: "csv" | "base" | "csv-folder" }>,
		onChange: () => void,
	): void {
		const header = container.createDiv({ text: title, cls: "ft-text-xs ft-text-muted" });
		header.style.cssText = "padding:0.35rem 0.5rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;background:var(--background-secondary);border-bottom:1px solid var(--background-modifier-border)";

		for (const item of items) {
			const row = container.createEl("label", { cls: "ft-flex ft-items-center ft-gap-2" });
			row.style.cssText = "padding:0.35rem 0.5rem;cursor:pointer;border-bottom:1px solid var(--background-modifier-border)";

			const checkbox = row.createEl("input", { type: "checkbox" });
			checkbox.checked = this.selectedPaths.has(item.path);
			checkbox.addEventListener("change", () => {
				if (checkbox.checked) {
					this.selectedPaths.add(item.path);
				} else {
					this.selectedPaths.delete(item.path);
				}
				onChange();
			});

			row.createSpan({ text: item.label, cls: "ft-text-sm" });
		}
	}

	private buildSelectedSources(): NewQuerySource[] {
		const { csvFiles, baseFiles, csvFolders } = this.options;
		const sources: NewQuerySource[] = [];

		for (const path of this.selectedPaths) {
			const csv = csvFiles.find((f) => f.path === path);
			if (csv) {
				sources.push({ path: csv.path, alias: csv.displayName.replace(/\.csv$/i, ""), sourceType: "csv" });
				continue;
			}
			const base = baseFiles.find((f) => f.path === path);
			if (base) {
				sources.push({ path: base.path, alias: base.displayName.replace(/\.base$/i, ""), sourceType: "base", viewIndex: 0 });
				continue;
			}
			const folder = csvFolders.find((f) => f.path === path);
			if (folder) {
				sources.push({ path: folder.path, alias: folder.displayName, sourceType: "csv-folder" });
			}
		}

		return sources;
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
