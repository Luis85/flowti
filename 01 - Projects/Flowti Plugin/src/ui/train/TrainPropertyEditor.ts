/**
 * Train Property Editor — inline frontmatter property editor for thought notes.
 *
 * Renders existing frontmatter as key-value pairs. Built-in properties
 * (type, train, direction, order, parent) are read-only with lock icon.
 * User can edit values inline and add new properties.
 *
 * Reads via metadataCache, writes via processFrontMatter (debounced 500ms).
 */

import { setIcon } from "obsidian";
import type { App, CachedMetadata } from "obsidian";

export interface TrainPropertyEditorDeps {
	app: App;
	thoughtPath: string;
}

/** Properties managed by the train system — read-only in the editor. */
const BUILT_IN_KEYS = new Set(["type", "train", "direction", "order", "parent", "prev", "next", "up", "down", "merge-target", "merged-from"]);

const WRITE_DEBOUNCE_MS = 500;

export class TrainPropertyEditor {
	private el: HTMLElement;
	private deps: TrainPropertyEditorDeps;
	private writeTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(el: HTMLElement, deps: TrainPropertyEditorDeps) {
		this.el = el;
		this.deps = deps;
	}

	render(): void {
		this.el.empty();

		const section = this.el.createDiv({ cls: "ft-section ft-train-property-editor" });

		// Header
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-justify-between ft-mb-2" });
		const titleRow = header.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		const icon = titleRow.createSpan();
		setIcon(icon, "file-code");
		titleRow.createSpan({ text: "Properties", cls: "ft-heading-xs" });

		// Add property button
		const addBtn = header.createEl("button", {
			cls: "ft-btn ft-btn-ghost ft-btn-xs ft-train-property-add-btn",
		});
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.appendText(" Add");
		addBtn.addEventListener("click", () => this.addNewProperty(section));

		// Read frontmatter
		const properties = this.readFrontmatter();

		if (!properties || Object.keys(properties).length === 0) {
			section.createDiv({
				text: "No properties",
				cls: "ft-text-muted ft-text-sm ft-train-property-empty",
			});
			return;
		}

		// Render properties
		const list = section.createDiv({ cls: "ft-train-property-list" });
		for (const [key, value] of Object.entries(properties)) {
			if (key === "position") continue; // Obsidian internal
			this.renderProperty(list, key, value);
		}
	}

	destroy(): void {
		if (this.writeTimer) {
			clearTimeout(this.writeTimer);
			this.writeTimer = null;
		}
	}

	private readFrontmatter(): Record<string, unknown> | null {
		const cache: CachedMetadata | null =
			this.deps.app.metadataCache?.getCache(this.deps.thoughtPath) ?? null;
		if (!cache?.frontmatter) return null;

		// Clone to avoid mutating cache; strip position key
		const fm = { ...cache.frontmatter };
		delete fm.position;
		return fm;
	}

	private renderProperty(container: HTMLElement, key: string, value: unknown): void {
		const row = container.createDiv({ cls: "ft-train-property-row ft-flex ft-items-center ft-gap-2" });
		row.dataset.propertyKey = key;

		const isBuiltIn = BUILT_IN_KEYS.has(key);

		// Lock icon for built-in
		if (isBuiltIn) {
			const lockIcon = row.createSpan({ cls: "ft-train-property-lock" });
			setIcon(lockIcon, "lock");
		}

		// Key
		row.createSpan({ text: key, cls: "ft-train-property-key ft-text-sm" });

		// Value
		const displayValue = this.formatValue(value);

		if (isBuiltIn) {
			row.createSpan({
				text: displayValue,
				cls: "ft-train-property-value ft-text-sm ft-text-muted",
			});
		} else {
			const valueEl = row.createSpan({
				text: displayValue,
				cls: "ft-train-property-value ft-text-sm ft-cursor-pointer",
			});
			valueEl.addEventListener("click", () => {
				this.editPropertyValue(valueEl, key, value);
			});
		}
	}

	private editPropertyValue(valueEl: HTMLElement, key: string, currentValue: unknown): void {
		const currentStr = this.formatValue(currentValue);
		valueEl.empty();

		const input = valueEl.createEl("input", {
			cls: "ft-train-property-input",
			type: "text",
		});
		input.value = currentStr;
		input.focus();
		input.select();

		const commit = (): void => {
			const newValue = input.value.trim();
			valueEl.empty();
			valueEl.setText(newValue || "(empty)");
			if (newValue !== currentStr) {
				this.debouncedWrite(key, this.parseValue(newValue));
			}
		};

		input.addEventListener("blur", commit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				input.blur();
			} else if (e.key === "Escape") {
				valueEl.empty();
				valueEl.setText(currentStr);
			}
		});
	}

	private addNewProperty(section: HTMLElement): void {
		// Remove empty state message if present
		const empty = section.querySelector(".ft-train-property-empty");
		if (empty) empty.remove();

		// Ensure list container exists
		let list = section.querySelector(".ft-train-property-list") as HTMLElement;
		if (!list) {
			list = section.createDiv({ cls: "ft-train-property-list" });
		}

		const row = list.createDiv({ cls: "ft-train-property-row ft-train-property-new ft-flex ft-items-center ft-gap-2" });

		const keyInput = row.createEl("input", {
			cls: "ft-train-property-input ft-train-property-key-input",
			type: "text",
		});
		keyInput.placeholder = "Key";

		const valueInput = row.createEl("input", {
			cls: "ft-train-property-input ft-train-property-value-input",
			type: "text",
		});
		valueInput.placeholder = "Value";

		keyInput.focus();

		const commit = (): void => {
			const key = keyInput.value.trim();
			const value = valueInput.value.trim();
			if (!key) {
				row.remove();
				return;
			}
			if (BUILT_IN_KEYS.has(key)) {
				row.remove();
				return;
			}
			row.remove();
			this.renderProperty(list, key, value);
			this.debouncedWrite(key, this.parseValue(value));
		};

		valueInput.addEventListener("blur", commit);
		valueInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				valueInput.blur();
			} else if (e.key === "Escape") {
				row.remove();
			}
		});

		keyInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				valueInput.focus();
			} else if (e.key === "Escape") {
				row.remove();
			}
		});
	}

	private debouncedWrite(key: string, value: unknown): void {
		if (this.writeTimer) clearTimeout(this.writeTimer);
		this.writeTimer = setTimeout(() => {
			this.writeFrontmatter(key, value);
			this.writeTimer = null;
		}, WRITE_DEBOUNCE_MS);
	}

	private writeFrontmatter(key: string, value: unknown): void {
		const file = this.deps.app.vault?.getAbstractFileByPath(this.deps.thoughtPath);
		if (!file || !("extension" in file)) return;

		void this.deps.app.fileManager.processFrontMatter(
			file as import("obsidian").TFile,
			(fm) => {
				fm[key] = value;
			},
		);
	}

	private formatValue(value: unknown): string {
		if (value === null || value === undefined) return "(empty)";
		if (Array.isArray(value)) return value.join(", ");
		return String(value);
	}

	private parseValue(str: string): unknown {
		if (str === "" || str === "(empty)") return "";
		if (str === "true") return true;
		if (str === "false") return false;
		const num = Number(str);
		if (!isNaN(num) && str.trim() !== "") return num;
		return str;
	}
}
