/**
 * Minimal stub for Obsidian module to allow unit testing.
 *
 * Obsidian extends HTMLElement.prototype with helper methods.
 * We polyfill them here so tests that render UI work correctly.
 */

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

if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.addClass) {
	HTMLElement.prototype.addClass = function (...classes: string[]) {
		this.classList.add(...classes.flatMap((c) => c.split(/\s+/).filter(Boolean)));
	};

	HTMLElement.prototype.removeClass = function (...classes: string[]) {
		this.classList.remove(...classes.flatMap((c) => c.split(/\s+/).filter(Boolean)));
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

/* ── Obsidian API stubs ───────────────────────────────── */

export class Plugin {
	app = {};
	async loadData(): Promise<unknown> { return null; }
	async saveData(_data: unknown): Promise<void> {}
}

export class Modal {
	app: unknown;
	modalEl: HTMLElement = document.createElement("div");
	titleEl: HTMLElement = document.createElement("div");
	contentEl: HTMLElement = document.createElement("div");
	constructor(app: unknown) { this.app = app; }
	open(): void {}
	close(): void {}
}

export class Setting {
	settingEl: HTMLElement;
	constructor(containerEl: HTMLElement) {
		this.settingEl = containerEl.createDiv({ cls: "setting-item" });
	}
	setName(_name: string): this { return this; }
	setDesc(_desc: string): this { return this; }
	addText(_cb: (text: unknown) => void): this { return this; }
	addToggle(_cb: (toggle: unknown) => void): this { return this; }
	addButton(_cb: (btn: unknown) => void): this { return this; }
}

export function setIcon(_el: HTMLElement, _iconId: string): void {}
