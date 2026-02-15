/**
 * Minimal stub for Obsidian module to allow unit testing.
 *
 * Obsidian extends HTMLElement.prototype with helper methods
 * (addClass, setText, empty, createDiv, createEl, createSpan).
 * We polyfill them here so tests that render UI work correctly.
 */

/* ── Type declarations for Obsidian's HTMLElement extensions ─ */
declare global {
	interface HTMLElement {
		addClass(...classes: string[]): void;
		removeClass(...classes: string[]): void;
		setText(text: string): void;
		empty(): void;
		createDiv(options?: { cls?: string; text?: string } | string): HTMLDivElement;
		createSpan(options?: { cls?: string; text?: string } | string): HTMLSpanElement;
		createEl<K extends keyof HTMLElementTagNameMap>(
			tag: K,
			options?: { cls?: string; text?: string; type?: string }
		): HTMLElementTagNameMap[K];
	}
}

/* ── HTMLElement polyfills (Obsidian DOM extensions) ─────── */

if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.addClass) {
	HTMLElement.prototype.addClass = function (...classes: string[]) {
		this.classList.add(
			...classes.flatMap((c) => c.split(/\s+/).filter(Boolean))
		);
	};

	HTMLElement.prototype.removeClass = function (...classes: string[]) {
		this.classList.remove(
			...classes.flatMap((c) => c.split(/\s+/).filter(Boolean))
		);
	};

	HTMLElement.prototype.setText = function (text: string) {
		this.textContent = text;
	};

	HTMLElement.prototype.empty = function () {
		this.innerHTML = "";
	};

	HTMLElement.prototype.createDiv = function (
		options?: { cls?: string; text?: string } | string
	): HTMLDivElement {
		const div = document.createElement("div");
		if (typeof options === "string") {
			div.className = options;
		} else if (options) {
			if (options.cls) div.className = options.cls;
			if (options.text) div.textContent = options.text;
		}
		this.appendChild(div);
		return div;
	};

	HTMLElement.prototype.createSpan = function (
		options?: { cls?: string; text?: string } | string
	): HTMLSpanElement {
		const span = document.createElement("span");
		if (typeof options === "string") {
			span.className = options;
		} else if (options) {
			if (options.cls) span.className = options.cls;
			if (options.text) span.textContent = options.text;
		}
		this.appendChild(span);
		return span;
	};

	HTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		options?: { cls?: string; text?: string; type?: string }
	): HTMLElementTagNameMap[K] {
		const el = document.createElement(tag);
		if (options) {
			if (options.cls) el.className = options.cls;
			if (options.text) el.textContent = options.text;
			if (options.type && "type" in el) {
				(el as HTMLInputElement).type = options.type;
			}
		}
		this.appendChild(el);
		return el;
	};
}

/* ── Obsidian API classes ───────────────────────────────── */

export class Notice {
	constructor(_message: string, _timeout?: number) {}
}

export class TAbstractFile {
	path: string = "";
}

export class TFile extends TAbstractFile {
	stat = { ctime: 0, mtime: 0, size: 0 };
	basename: string = "";
	extension: string = "";
}

export class TFolder extends TAbstractFile {
	children: TAbstractFile[] = [];
	isRoot(): boolean {
		return this.path === "/";
	}
}

export type EventRef = { id: string };

export class ItemView {
	file: TFile | null = null;
}

export class MarkdownView extends ItemView {}

export class WorkspaceLeaf {
	view: ItemView = new ItemView();
}

export class App {}

export class Plugin {
	app: App = new App();
	async loadData(): Promise<unknown> {
		return null;
	}
	async saveData(_data: unknown): Promise<void> {}
	registerEvent(_ref: EventRef): void {}
}

export class Modal {
	app: App;
	modalEl: HTMLElement = document.createElement("div");
	titleEl: HTMLElement = document.createElement("div");
	contentEl: HTMLElement = document.createElement("div");

	constructor(app: App) {
		this.app = app;
	}

	open(): void {}
	close(): void {}
	onOpen(): void {}
	onClose(): void {}
}

export class FuzzySuggestModal<T> extends Modal {
	getItems(): T[] { return []; }
	getItemText(_item: T): string { return ""; }
	onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void {}
}

export class PluginSettingTab {
	app: App;
	plugin: Plugin;
	containerEl: HTMLElement = document.createElement("div");

	constructor(app: App, plugin: Plugin) {
		this.app = app;
		this.plugin = plugin;
	}

	display(): void {}
}

export class Setting {
	constructor(_containerEl: HTMLElement) {}

	setName(_name: string): this {
		return this;
	}

	setDesc(_desc: string): this {
		return this;
	}

	addText(_cb: (text: TextComponent) => void): this {
		return this;
	}

	addToggle(_cb: (toggle: ToggleComponent) => void): this {
		return this;
	}

	addButton(_cb: (btn: ButtonComponent) => void): this {
		return this;
	}

	addDropdown(_cb: (dropdown: DropdownComponent) => void): this {
		return this;
	}

	addExtraButton(_cb: (btn: ExtraButtonComponent) => void): this {
		return this;
	}
}

export class TextComponent {
	setValue(_value: string): this {
		return this;
	}

	setPlaceholder(_placeholder: string): this {
		return this;
	}

	setDisabled(_disabled: boolean): this {
		return this;
	}

	onChange(_cb: (value: string) => void): this {
		return this;
	}
}

export class ToggleComponent {
	setValue(_value: boolean): this {
		return this;
	}

	onChange(_cb: (value: boolean) => void): this {
		return this;
	}
}

export class ButtonComponent {
	setButtonText(_text: string): this {
		return this;
	}

	setCta(): this {
		return this;
	}

	setWarning(): this {
		return this;
	}

	onClick(_cb: () => void): this {
		return this;
	}
}

export class DropdownComponent {
	addOption(_value: string, _display: string): this {
		return this;
	}

	setValue(_value: string): this {
		return this;
	}

	onChange(_cb: (value: string) => void): this {
		return this;
	}
}

export class ExtraButtonComponent {
	setIcon(_icon: string): this {
		return this;
	}

	setTooltip(_tooltip: string): this {
		return this;
	}

	onClick(_cb: () => void): this {
		return this;
	}
}

export function setIcon(_el: HTMLElement, _iconId: string): void {}

/**
 * Minimal parseYaml stub matching Obsidian's API.
 * Uses the yaml package (available as transitive dep from vite/typedoc).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const yamlPkg = require("yaml");
export function parseYaml(yaml: string): unknown {
	if (!yaml || !yaml.trim()) return null;
	return yamlPkg.parse(yaml);
}
