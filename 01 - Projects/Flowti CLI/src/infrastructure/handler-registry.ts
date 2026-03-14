/**
 * handler-registry.ts — Registry for sitemap view, action, condition, and beforeRender handlers.
 *
 * Handlers are registered at startup alongside the existing CommandRegistry.
 * The SitemapRouter resolves handler IDs from the sitemap JSON to these functions.
 */

import type {
	ViewHandler,
	ActionHandler,
	ConditionHandler,
	BeforeRenderHandler,
} from "./sitemap-types.js";
import type { RouterContext } from "./sitemap-types.js";
import type { MenuEntry } from "./types.js";
import type { FormData } from "./form-runner.js";

/** Handles a form submission — receives collected form data + context. */
export type FormHandler = (ctx: RouterContext & { readonly formData: FormData }) => Promise<void>;

/** Returns dynamic menu entries at runtime. */
export type DataSourceHandler = (ctx: RouterContext, params?: Readonly<Record<string, unknown>>) => MenuEntry[];

// ── Handler Registry ────────────────────────────────────────────────

export class HandlerRegistry {
	readonly #views = new Map<string, ViewHandler>();
	readonly #actions = new Map<string, ActionHandler>();
	readonly #conditions = new Map<string, ConditionHandler>();
	readonly #beforeRenders = new Map<string, BeforeRenderHandler>();
	readonly #formHandlers = new Map<string, FormHandler>();
	readonly #dataSources = new Map<string, DataSourceHandler>();

	// ── Registration ────────────────────────────────────────────────

	registerView(id: string, handler: ViewHandler): void {
		if (this.#views.has(id)) throw new Error(`Duplicate view handler: "${id}"`);
		this.#views.set(id, handler);
	}

	registerAction(id: string, handler: ActionHandler): void {
		if (this.#actions.has(id)) throw new Error(`Duplicate action handler: "${id}"`);
		this.#actions.set(id, handler);
	}

	registerCondition(id: string, handler: ConditionHandler): void {
		if (this.#conditions.has(id)) throw new Error(`Duplicate condition handler: "${id}"`);
		this.#conditions.set(id, handler);
	}

	registerBeforeRender(id: string, handler: BeforeRenderHandler): void {
		if (this.#beforeRenders.has(id)) throw new Error(`Duplicate beforeRender handler: "${id}"`);
		this.#beforeRenders.set(id, handler);
	}

	registerFormHandler(id: string, handler: FormHandler): void {
		if (this.#formHandlers.has(id)) throw new Error(`Duplicate form handler: "${id}"`);
		this.#formHandlers.set(id, handler);
	}

	registerDataSource(id: string, handler: DataSourceHandler): void {
		if (this.#dataSources.has(id)) throw new Error(`Duplicate data source handler: "${id}"`);
		this.#dataSources.set(id, handler);
	}

	// ── Lookup ──────────────────────────────────────────────────────

	getView(id: string): ViewHandler {
		const h = this.#views.get(id);
		if (!h) throw new Error(`Unknown view handler: "${id}"`);
		return h;
	}

	getAction(id: string): ActionHandler {
		const h = this.#actions.get(id);
		if (!h) throw new Error(`Unknown action handler: "${id}"`);
		return h;
	}

	getCondition(id: string): ConditionHandler {
		const h = this.#conditions.get(id);
		if (!h) throw new Error(`Unknown condition handler: "${id}"`);
		return h;
	}

	getBeforeRender(id: string): BeforeRenderHandler {
		const h = this.#beforeRenders.get(id);
		if (!h) throw new Error(`Unknown beforeRender handler: "${id}"`);
		return h;
	}

	getFormHandler(id: string): FormHandler {
		const h = this.#formHandlers.get(id);
		if (!h) throw new Error(`Unknown form handler: "${id}"`);
		return h;
	}

	getDataSource(id: string): DataSourceHandler {
		const h = this.#dataSources.get(id);
		if (!h) throw new Error(`Unknown data source handler: "${id}"`);
		return h;
	}

	// ── Query ───────────────────────────────────────────────────────

	hasView(id: string): boolean { return this.#views.has(id); }
	hasAction(id: string): boolean { return this.#actions.has(id); }
	hasCondition(id: string): boolean { return this.#conditions.has(id); }
	hasBeforeRender(id: string): boolean { return this.#beforeRenders.has(id); }
	hasFormHandler(id: string): boolean { return this.#formHandlers.has(id); }
	hasDataSource(id: string): boolean { return this.#dataSources.has(id); }

	get viewCount(): number { return this.#views.size; }
	get actionCount(): number { return this.#actions.size; }
	get conditionCount(): number { return this.#conditions.size; }
	get formHandlerCount(): number { return this.#formHandlers.size; }
	get dataSourceCount(): number { return this.#dataSources.size; }

	viewIds(): string[] { return [...this.#views.keys()]; }
	actionIds(): string[] { return [...this.#actions.keys()]; }
	conditionIds(): string[] { return [...this.#conditions.keys()]; }
	formHandlerIds(): string[] { return [...this.#formHandlers.keys()]; }
	dataSourceIds(): string[] { return [...this.#dataSources.keys()]; }
}
