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
		appendText(text: string): void;
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

	HTMLElement.prototype.appendText = function (text: string) {
		this.appendChild(document.createTextNode(text));
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

export interface ViewStateResult {
	history: boolean;
}

export class ItemView {
	file: TFile | null = null;
	containerEl!: HTMLElement;
	contentEl!: HTMLElement;
	leaf: WorkspaceLeaf | null = null;
	app: App = new App();

	constructor(leaf?: WorkspaceLeaf) {
		if (leaf) {
			this.leaf = leaf;
		}
		// Guard for non-DOM environments (e.g. EventBridge tests without happy-dom)
		if (typeof document !== "undefined") {
			this.containerEl = document.createElement("div");
			this.contentEl = document.createElement("div");
		}
	}

	getViewType(): string { return ""; }
	getDisplayText(): string { return ""; }
	getIcon(): string { return ""; }
	getState(): Record<string, unknown> { return {}; }
	async setState(_state: Record<string, unknown>, _result: ViewStateResult): Promise<void> {}
	async onOpen(): Promise<void> {}
	async onClose(): Promise<void> {}
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
	settingEl: HTMLElement;
	infoEl: HTMLElement;
	controlEl: HTMLElement;

	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv({ cls: "setting-item" });
		this.infoEl = this.settingEl.createDiv({ cls: "setting-item-info" });
		this.controlEl = this.settingEl.createDiv({ cls: "setting-item-control" });
	}

	setName(name: string): this {
		let nameEl = this.infoEl.querySelector(".setting-item-name") as HTMLElement | null;
		if (!nameEl) nameEl = this.infoEl.createDiv({ cls: "setting-item-name" });
		nameEl.textContent = name;
		return this;
	}

	setDesc(_desc: string): this {
		return this;
	}

	addText(cb: (text: TextComponent) => void): this {
		const comp = new TextComponent(this.controlEl);
		cb(comp);
		return this;
	}

	addToggle(cb: (toggle: ToggleComponent) => void): this {
		cb(new ToggleComponent());
		return this;
	}

	addButton(cb: (btn: ButtonComponent) => void): this {
		const btn = new ButtonComponent(this.controlEl);
		cb(btn);
		return this;
	}

	addDropdown(cb: (dropdown: DropdownComponent) => void): this {
		const comp = new DropdownComponent(this.controlEl);
		cb(comp);
		return this;
	}

	addExtraButton(cb: (btn: ExtraButtonComponent) => void): this {
		cb(new ExtraButtonComponent());
		return this;
	}

	addTextArea(cb: (area: TextAreaComponent) => void): this {
		cb(new TextAreaComponent());
		return this;
	}
}

export class TextComponent {
	inputEl: HTMLInputElement;

	constructor(containerEl?: HTMLElement) {
		this.inputEl = document.createElement("input");
		this.inputEl.type = "text";
		containerEl?.appendChild(this.inputEl);
	}

	setValue(value: string): this {
		this.inputEl.value = value;
		return this;
	}

	setPlaceholder(placeholder: string): this {
		this.inputEl.placeholder = placeholder;
		return this;
	}

	setDisabled(disabled: boolean): this {
		this.inputEl.disabled = disabled;
		return this;
	}

	onChange(cb: (value: string) => void): this {
		this.inputEl.addEventListener("input", () => cb(this.inputEl.value));
		return this;
	}
}

export class TextAreaComponent {
	inputEl: HTMLTextAreaElement = document.createElement("textarea");

	setValue(_value: string): this {
		return this;
	}

	setPlaceholder(_placeholder: string): this {
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
	buttonEl: HTMLButtonElement;

	constructor(containerEl?: HTMLElement) {
		this.buttonEl = document.createElement("button");
		containerEl?.appendChild(this.buttonEl);
	}

	setButtonText(text: string): this {
		this.buttonEl.textContent = text;
		return this;
	}

	setCta(): this {
		return this;
	}

	setWarning(): this {
		return this;
	}

	onClick(cb: () => void): this {
		this.buttonEl.addEventListener("click", cb);
		return this;
	}
}

export class DropdownComponent {
	selectEl: HTMLSelectElement;

	constructor(containerEl?: HTMLElement) {
		this.selectEl = document.createElement("select");
		containerEl?.appendChild(this.selectEl);
	}

	addOption(value: string, display: string): this {
		const option = document.createElement("option");
		option.value = value;
		option.textContent = display;
		this.selectEl.appendChild(option);
		return this;
	}

	setValue(value: string): this {
		this.selectEl.value = value;
		return this;
	}

	onChange(cb: (value: string) => void): this {
		this.selectEl.addEventListener("change", () => cb(this.selectEl.value));
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
 * Creates a mock TFile with read-only properties set via defineProperty.
 */
export function createMockTFile(path: string, basename: string, ext = "md"): TFile {
	const file = new TFile();
	Object.defineProperty(file, "path", { value: path, writable: false });
	Object.defineProperty(file, "basename", { value: basename, writable: false });
	Object.defineProperty(file, "extension", { value: ext, writable: false });
	return file;
}

/**
 * Creates a mock TFolder with read-only properties set via defineProperty.
 */
export function createMockTFolder(path: string, children: (TFile | TFolder)[] = []): TFolder {
	const folder = new TFolder();
	Object.defineProperty(folder, "path", { value: path, writable: false });
	Object.defineProperty(folder, "children", { value: children, writable: false });
	return folder;
}

/* ── requestUrl stub ──────────────────────────────────── */

export interface RequestUrlParam {
	url: string;
	method?: string;
	headers?: Record<string, string>;
	body?: string;
}

export interface RequestUrlResponse {
	status: number;
	headers: Record<string, string>;
	json: unknown;
	text: string;
}

export async function requestUrl(_request: RequestUrlParam): Promise<RequestUrlResponse> {
	throw new Error("requestUrl not implemented in test stub — mock via vi.mock");
}

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
