import type { ComponentMeta } from "./types";
import { DEFAULT_COMPONENTS } from "./componentManifest";

/**
 * Registry for UI component metadata.
 *
 * Provides lookup, validation, and discovery of registered components
 * from the component manifest. Read-only at runtime.
 */
export class ComponentRegistry {
	private readonly components: Map<string, ComponentMeta>;

	constructor(entries?: ComponentMeta[]) {
		this.components = new Map();
		const items = entries ?? DEFAULT_COMPONENTS;
		for (const entry of items) {
			this.components.set(entry.id, entry);
		}
	}

	/** Check whether a component ID is registered. */
	has(id: string): boolean {
		return this.components.has(id);
	}

	/** Get component metadata by ID. Returns null if not found. */
	get(id: string): ComponentMeta | null {
		return this.components.get(id) ?? null;
	}

	/** Get all registered components. */
	getAll(): ComponentMeta[] {
		return [...this.components.values()];
	}

	/** Get all components in a specific category. */
	getByCategory(category: string): ComponentMeta[] {
		return this.getAll().filter((c) => c.category === category);
	}

	/** Get the set of all registered component IDs. */
	getNameSet(): Set<string> {
		return new Set(this.components.keys());
	}

	/**
	 * Validate a component entry for required fields.
	 * Returns a list of validation issues (empty = valid).
	 */
	validate(entry: Partial<ComponentMeta>): string[] {
		const issues: string[] = [];
		if (!entry.id || typeof entry.id !== "string") issues.push("Missing or invalid 'id'");
		if (!entry.name || typeof entry.name !== "string") issues.push("Missing or invalid 'name'");
		if (!entry.category || typeof entry.category !== "string") issues.push("Missing or invalid 'category'");
		if (!entry.source || typeof entry.source !== "string") issues.push("Missing or invalid 'source'");
		if (!Array.isArray(entry.layouts)) issues.push("Missing or invalid 'layouts'");
		return issues;
	}
}
