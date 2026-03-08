/**
 * app.ts — Scaffolding templates for DDD Application generation.
 *
 * Creates a full Obsidian plugin project with:
 *   - Working EventBus (typed pub-sub)
 *   - Type-safe event system
 *   - AppError base class
 *   - vitest + happy-dom + obsidian stubs
 *   - CSS pipeline via esbuild
 *   - Starter test suite
 */

import {
	manifestTemplate, packageTemplate, tsconfigTemplate,
	esbuildTemplate, vitestTemplate, gitignoreTemplate,
} from "./config.js";

export function appManifestTemplate(name: string, id: string, author: string): string {
	return manifestTemplate({ id, name, author });
}

export function appPackageTemplate(name: string, id: string): string {
	return packageTemplate("app", name, id);
}

export function appTsconfigTemplate(): string {
	return tsconfigTemplate("app");
}

export function appEsbuildTemplate(id: string): string {
	return esbuildTemplate(id);
}

export function appVitestTemplate(): string {
	return vitestTemplate("app");
}

export function appMainTemplate(name: string, pascal: string): string {
	return `import { Plugin } from "obsidian";
import { EventBus } from "./infrastructure/events/EventBus";
import type { IEventBus } from "./infrastructure/events/types";

export default class ${pascal}Plugin extends Plugin {
\tprivate eventBus!: IEventBus;

\tasync onload(): Promise<void> {
\t\tthis.eventBus = new EventBus();

\t\tlog(\`[${name}] loaded\`);
\t\tawait this.eventBus.emit("app.loaded", {});
\t}

\tasync onunload(): Promise<void> {
\t\tawait this.eventBus.emit("app.unloaded", {});
\t\tthis.eventBus.clear();

\t\tlog(\`[${name}] unloaded\`);
\t}
}
`;
}

export function appEventBusTemplate(): string {
	return `import type {
\tEventHandler,
\tEventPayload,
\tEventType,
\tFlowtiEvent,
\tFlowtiEvents,
\tIEventBus,
\tWildcardEventHandler,
} from "./types";

const WILDCARD = "*" as const;
type StoredHandler = EventHandler | WildcardEventHandler;

export class EventBus implements IEventBus {
\tprivate handlers: Map<EventType | typeof WILDCARD, Set<StoredHandler>>;

\tconstructor() {
\t\tthis.handlers = new Map();
\t}

\tasync emit<T extends EventType>(type: T, payload: EventPayload<T>): Promise<void> {
\t\tconst event: FlowtiEvent<T> = {
\t\t\ttype,
\t\t\tpayload,
\t\t\ttimestamp: new Date().toISOString(),
\t\t};

\t\tconst typeHandlers = this.handlers.get(type);
\t\tif (typeHandlers) {
\t\t\tfor (const handler of typeHandlers) {
\t\t\t\ttry {
\t\t\t\t\tawait (handler as EventHandler<T>)(event);
\t\t\t\t} catch (err) {
\t\t\t\t\tconsole.error(\`[EventBus] Error in "\${type}" handler:\`, err);
\t\t\t\t}
\t\t\t}
\t\t}

\t\tconst wildcardHandlers = this.handlers.get(WILDCARD);
\t\tif (wildcardHandlers) {
\t\t\tfor (const handler of wildcardHandlers) {
\t\t\t\ttry {
\t\t\t\t\tawait (handler as WildcardEventHandler)(event as FlowtiEvents);
\t\t\t\t} catch (err) {
\t\t\t\t\tconsole.error(\`[EventBus] Error in wildcard handler for "\${type}":\`, err);
\t\t\t\t}
\t\t\t}
\t\t}
\t}

\ton<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
\ton(type: "*", handler: WildcardEventHandler): () => void;
\ton<T extends EventType>(
\t\ttype: T | "*",
\t\thandler: EventHandler<T> | WildcardEventHandler
\t): () => void {
\t\tconst key = type as EventType | typeof WILDCARD;
\t\tif (!this.handlers.has(key)) {
\t\t\tthis.handlers.set(key, new Set());
\t\t}
\t\tthis.handlers.get(key)!.add(handler as StoredHandler);
\t\treturn () => this.off(type as T, handler as EventHandler<T>);
\t}

\tonce<T extends EventType>(type: T, handler: EventHandler<T>): () => void {
\t\tconst wrappedHandler: EventHandler<T> = async (event) => {
\t\t\tthis.off(type, wrappedHandler);
\t\t\tawait handler(event);
\t\t};
\t\treturn this.on(type, wrappedHandler);
\t}

\toff<T extends EventType>(type: T, handler: EventHandler<T>): void;
\toff(type: "*", handler: WildcardEventHandler): void;
\toff<T extends EventType>(
\t\ttype: T | "*",
\t\thandler: EventHandler<T> | WildcardEventHandler
\t): void {
\t\tconst key = type as EventType | typeof WILDCARD;
\t\tthis.handlers.get(key)?.delete(handler as StoredHandler);
\t}

\tclear(): void {
\t\tthis.handlers.clear();
\t}
}
`;
}

export function appEventTypesTemplate(): string {
	return `import type { AppEventMap } from "./events";

export type EventType = keyof AppEventMap;

export interface FlowtiEvent<
\tT extends EventType = EventType,
\tP = AppEventMap[T],
> {
\treadonly type: T;
\treadonly payload: P;
\treadonly timestamp: string;
}

export type FlowtiEvents = {
\t[K in EventType]: FlowtiEvent<K, AppEventMap[K]>;
}[EventType];

export type EventPayload<T extends EventType> = AppEventMap[T];

export type EventHandler<T extends EventType = EventType> = (
\tevent: FlowtiEvent<T, AppEventMap[T]>
) => void | Promise<void>;

export type WildcardEventHandler = (event: FlowtiEvents) => void | Promise<void>;

export interface IEventBus {
\temit<T extends EventType>(type: T, payload: EventPayload<T>): Promise<void>;
\ton<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
\ton(type: "*", handler: WildcardEventHandler): () => void;
\tonce<T extends EventType>(type: T, handler: EventHandler<T>): () => void;
\toff<T extends EventType>(type: T, handler: EventHandler<T>): void;
\toff(type: "*", handler: WildcardEventHandler): void;
\tclear(): void;
}
`;
}

export function appEventsTemplate(): string {
	return `/**
 * AppEventMap — all application events.
 *
 * Add new events here as the application grows.
 * Each domain can define its own EventMap interface and compose via \`extends\`.
 */
export interface AppEventMap {
\t/** Emitted when the plugin has loaded. */
\t"app.loaded": Record<string, never>;
\t/** Emitted when the plugin is unloading. */
\t"app.unloaded": Record<string, never>;
}
`;
}

export function appErrorTypesTemplate(): string {
	return `/**
 * AppError — base error class for application-level errors.
 *
 * Extends Error with a machine-readable \`code\` and optional \`context\`.
 */
export class AppError extends Error {
\treadonly code: string;
\treadonly context?: Record<string, unknown>;

\tconstructor(message: string, code: string, context?: Record<string, unknown>) {
\t\tsuper(message);
\t\tthis.name = "AppError";
\t\tthis.code = code;
\t\tthis.context = context;
\t}
}
`;
}

export function appCssTemplate(name: string): string {
	return `/* ── Base styles for ${name} ── */\n`;
}

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
import { log } from "../../infrastructure/logger.js";

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

export function appGitignoreTemplate(): string {
	return gitignoreTemplate("app");
}
