/**
 * tui-handler-registry.ts — Registry for TUI action, form, condition, and data source handlers.
 *
 * Implements IConditionRegistry so sitemap-conditions can evaluate conditions
 * against either the legacy HandlerRegistry or this TUI-specific one.
 */

import type { ConditionFn, IConditionRegistry } from "../../infrastructure/condition-registry.js";
import type {
	TuiActionHandler,
	TuiFormHandler,
	TuiConditionHandler,
	TuiDataSourceHandler,
} from "./tui-handler-types.js";

export class TuiHandlerRegistry implements IConditionRegistry {
	readonly #handlers = new Map<string, TuiActionHandler>();
	readonly #formHandlers = new Map<string, TuiFormHandler>();
	readonly #conditions = new Map<string, TuiConditionHandler>();
	readonly #dataSources = new Map<string, TuiDataSourceHandler>();

	registerHandler(id: string, handler: TuiActionHandler): void {
		if (this.#handlers.has(id)) throw new Error(`Duplicate TUI handler: ${id}`);
		this.#handlers.set(id, handler);
	}

	getHandler(id: string): TuiActionHandler {
		const h = this.#handlers.get(id);
		if (!h) throw new Error(`TUI handler not found: ${id}`);
		return h;
	}

	hasHandler(id: string): boolean {
		return this.#handlers.has(id);
	}

	registerFormHandler(id: string, handler: TuiFormHandler): void {
		if (this.#formHandlers.has(id)) throw new Error(`Duplicate TUI form handler: ${id}`);
		this.#formHandlers.set(id, handler);
	}

	getFormHandler(id: string): TuiFormHandler {
		const h = this.#formHandlers.get(id);
		if (!h) throw new Error(`TUI form handler not found: ${id}`);
		return h;
	}

	hasFormHandler(id: string): boolean {
		return this.#formHandlers.has(id);
	}

	registerCondition(id: string, handler: TuiConditionHandler): void {
		if (this.#conditions.has(id)) throw new Error(`Duplicate TUI condition: ${id}`);
		this.#conditions.set(id, handler);
	}

	getCondition(id: string): ConditionFn {
		const h = this.#conditions.get(id);
		if (!h) throw new Error(`TUI condition not found: ${id}`);
		return h as ConditionFn;
	}

	hasCondition(id: string): boolean {
		return this.#conditions.has(id);
	}

	registerDataSource(id: string, handler: TuiDataSourceHandler): void {
		if (this.#dataSources.has(id)) throw new Error(`Duplicate TUI data source: ${id}`);
		this.#dataSources.set(id, handler);
	}

	getDataSource(id: string): TuiDataSourceHandler {
		const h = this.#dataSources.get(id);
		if (!h) throw new Error(`TUI data source not found: ${id}`);
		return h;
	}

	hasDataSource(id: string): boolean {
		return this.#dataSources.has(id);
	}
}
