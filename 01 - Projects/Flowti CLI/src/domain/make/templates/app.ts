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

// Re-export stub templates from dedicated file
export { appObsidianStubTemplate, appEventBusTestTemplate } from "./app-stubs.js";

export function appGitignoreTemplate(): string {
	return gitignoreTemplate("app");
}
