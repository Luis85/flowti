/**
 * template-registry.ts — Template function registry for scaffold definitions.
 *
 * Maps template IDs to pure functions that produce file content.
 * The registry is the bridge between JSON definitions and TypeScript templates.
 */

import type { TemplateFn } from "../scaffold-types.js";

export interface TemplateRegistry {
	register(id: string, fn: TemplateFn): void;
	resolve(id: string): TemplateFn | undefined;
	has(id: string): boolean;
	ids(): string[];
}

export function createTemplateRegistry(): TemplateRegistry {
	const map = new Map<string, TemplateFn>();

	return {
		register(id: string, fn: TemplateFn): void {
			map.set(id, fn);
		},
		resolve(id: string): TemplateFn | undefined {
			return map.get(id);
		},
		has(id: string): boolean {
			return map.has(id);
		},
		ids(): string[] {
			return [...map.keys()];
		},
	};
}

/** Convenience: register multiple templates at once. */
export function registerAll(registry: TemplateRegistry, entries: Record<string, TemplateFn>): void {
	for (const [id, fn] of Object.entries(entries)) {
		registry.register(id, fn);
	}
}
