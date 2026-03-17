import type { ILayout, LayoutConfig, LayoutFactory } from "./types";

/**
 * Registry for layout factories.
 *
 * Provides registration, resolution, and validation of layout types by name.
 */
export class LayoutRegistry {
	private factories: Map<string, LayoutFactory> = new Map();

	/** Register a layout factory under a given type name. */
	register(type: string, factory: LayoutFactory): void {
		this.factories.set(type, factory);
	}

	/** Resolve a layout by type name, returning a new instance. Returns null if type is unknown. */
	resolve(type: string, config?: LayoutConfig): ILayout | null {
		const factory = this.factories.get(type);
		if (!factory) return null;
		return factory(config);
	}

	/** Check whether a layout type is registered. */
	has(type: string): boolean {
		return this.factories.has(type);
	}

	/** Get all registered layout type names. */
	getRegisteredTypes(): string[] {
		return [...this.factories.keys()];
	}
}
