/**
 * app-stubs.ts — Obsidian stub and EventBus test templates for DDD Application generation.
 */

export function appObsidianStubTemplate(): string {
	return `/**
 * Minimal stub for Obsidian module to allow unit testing.
 *
 * Obsidian extends HTMLElement.prototype with helper methods.
 * We polyfill them here so tests that render UI work correctly.
 */

declare global {
\tinterface HTMLElement {
\t\taddClass(...classes: string[]): void;
\t\tremoveClass(...classes: string[]): void;
\t\tsetText(text: string): void;
\t\tempty(): void;
\t\tcreateDiv(options?: { cls?: string; text?: string } | string): HTMLDivElement;
\t\tcreateSpan(options?: { cls?: string; text?: string } | string): HTMLSpanElement;
\t\tcreateEl<K extends keyof HTMLElementTagNameMap>(
\t\t\ttag: K,
\t\t\toptions?: { cls?: string; text?: string; type?: string }
\t\t): HTMLElementTagNameMap[K];
\t}
}

if (typeof HTMLElement !== "undefined" && !HTMLElement.prototype.addClass) {
\tHTMLElement.prototype.addClass = function (...classes: string[]) {
\t\tthis.classList.add(...classes.flatMap((c) => c.split(/\\s+/).filter(Boolean)));
\t};

\tHTMLElement.prototype.removeClass = function (...classes: string[]) {
\t\tthis.classList.remove(...classes.flatMap((c) => c.split(/\\s+/).filter(Boolean)));
\t};

\tHTMLElement.prototype.setText = function (text: string) {
\t\tthis.textContent = text;
\t};

\tHTMLElement.prototype.empty = function () {
\t\tthis.innerHTML = "";
\t};

\tHTMLElement.prototype.createDiv = function (
\t\toptions?: { cls?: string; text?: string } | string
\t): HTMLDivElement {
\t\tconst div = document.createElement("div");
\t\tif (typeof options === "string") {
\t\t\tdiv.className = options;
\t\t} else if (options) {
\t\t\tif (options.cls) div.className = options.cls;
\t\t\tif (options.text) div.textContent = options.text;
\t\t}
\t\tthis.appendChild(div);
\t\treturn div;
\t};

\tHTMLElement.prototype.createSpan = function (
\t\toptions?: { cls?: string; text?: string } | string
\t): HTMLSpanElement {
\t\tconst span = document.createElement("span");
\t\tif (typeof options === "string") {
\t\t\tspan.className = options;
\t\t} else if (options) {
\t\t\tif (options.cls) span.className = options.cls;
\t\t\tif (options.text) span.textContent = options.text;
\t\t}
\t\tthis.appendChild(span);
\t\treturn span;
\t};

\tHTMLElement.prototype.createEl = function <K extends keyof HTMLElementTagNameMap>(
\t\ttag: K,
\t\toptions?: { cls?: string; text?: string; type?: string }
\t): HTMLElementTagNameMap[K] {
\t\tconst el = document.createElement(tag);
\t\tif (options) {
\t\t\tif (options.cls) el.className = options.cls;
\t\t\tif (options.text) el.textContent = options.text;
\t\t\tif (options.type && "type" in el) {
\t\t\t\t(el as HTMLInputElement).type = options.type;
\t\t\t}
\t\t}
\t\tthis.appendChild(el);
\t\treturn el;
\t};
}

/* ── Obsidian API stubs ───────────────────────────────── */

export class Plugin {
\tapp = {};
\tasync loadData(): Promise<unknown> { return null; }
\tasync saveData(_data: unknown): Promise<void> {}
}

export class Modal {
\tapp: unknown;
\tmodalEl: HTMLElement = document.createElement("div");
\ttitleEl: HTMLElement = document.createElement("div");
\tcontentEl: HTMLElement = document.createElement("div");
\tconstructor(app: unknown) { this.app = app; }
\topen(): void {}
\tclose(): void {}
}

export class Setting {
\tsettingEl: HTMLElement;
\tconstructor(containerEl: HTMLElement) {
\t\tthis.settingEl = containerEl.createDiv({ cls: "setting-item" });
\t}
\tsetName(_name: string): this { return this; }
\tsetDesc(_desc: string): this { return this; }
\taddText(_cb: (text: unknown) => void): this { return this; }
\taddToggle(_cb: (toggle: unknown) => void): this { return this; }
\taddButton(_cb: (btn: unknown) => void): this { return this; }
}

export function setIcon(_el: HTMLElement, _iconId: string): void {}
`;
}

export function appEventBusTestTemplate(): string {
	return `import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
describe("EventBus", () => {
\tlet bus: IEventBus;

\tbeforeEach(() => {
\t\tbus = new EventBus();
\t});

\tit("should emit to a registered handler", async () => {
\t\tlet called = false;
\t\tbus.on("app.loaded", () => { called = true; });

\t\tawait bus.emit("app.loaded", {});

\t\texpect(called).toBe(true);
\t});

\tit("should pass the correct payload", async () => {
\t\tlet receivedType = "";
\t\tbus.on("app.loaded", (event) => { receivedType = event.type; });

\t\tawait bus.emit("app.loaded", {});

\t\texpect(receivedType).toBe("app.loaded");
\t});

\tit("should unsubscribe when calling the returned function", async () => {
\t\tlet callCount = 0;
\t\tconst unsub = bus.on("app.loaded", () => { callCount++; });

\t\tawait bus.emit("app.loaded", {});
\t\tunsub();
\t\tawait bus.emit("app.loaded", {});

\t\texpect(callCount).toBe(1);
\t});

\tit("should remove all handlers on clear()", async () => {
\t\tlet callCount = 0;
\t\tbus.on("app.loaded", () => { callCount++; });
\t\tbus.on("app.unloaded", () => { callCount++; });

\t\tbus.clear();
\t\tawait bus.emit("app.loaded", {});
\t\tawait bus.emit("app.unloaded", {});

\t\texpect(callCount).toBe(0);
\t});
});
`;
}
