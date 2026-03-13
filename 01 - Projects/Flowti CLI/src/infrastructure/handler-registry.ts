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
	ListProviderHandler,
} from "./sitemap-types.js";

// ── Handler Registry ────────────────────────────────────────────────

export class HandlerRegistry {
	readonly #views = new Map<string, ViewHandler>();
	readonly #actions = new Map<string, ActionHandler>();
	readonly #conditions = new Map<string, ConditionHandler>();
	readonly #beforeRenders = new Map<string, BeforeRenderHandler>();
	readonly #listProviders = new Map<string, ListProviderHandler>();

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

	registerListProvider(id: string, handler: ListProviderHandler): void {
		if (this.#listProviders.has(id)) throw new Error(`Duplicate listProvider handler: "${id}"`);
		this.#listProviders.set(id, handler);
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

	getListProvider(id: string): ListProviderHandler {
		const h = this.#listProviders.get(id);
		if (!h) throw new Error(`Unknown listProvider handler: "${id}"`);
		return h;
	}

	// ── Query ───────────────────────────────────────────────────────

	hasView(id: string): boolean { return this.#views.has(id); }
	hasAction(id: string): boolean { return this.#actions.has(id); }
	hasCondition(id: string): boolean { return this.#conditions.has(id); }
	hasBeforeRender(id: string): boolean { return this.#beforeRenders.has(id); }
	hasListProvider(id: string): boolean { return this.#listProviders.has(id); }

	get viewCount(): number { return this.#views.size; }
	get actionCount(): number { return this.#actions.size; }
	get conditionCount(): number { return this.#conditions.size; }
	get listProviderCount(): number { return this.#listProviders.size; }

	viewIds(): string[] { return [...this.#views.keys()]; }
	actionIds(): string[] { return [...this.#actions.keys()]; }
	conditionIds(): string[] { return [...this.#conditions.keys()]; }
	listProviderIds(): string[] { return [...this.#listProviders.keys()]; }
}
