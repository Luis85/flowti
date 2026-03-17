/**
 * Layout abstraction layer types.
 *
 * All layouts are pure DOM — no Obsidian API dependency.
 * Layouts provide named regions that consumers mount content into.
 */

/** A named region within a layout that content can be mounted into. */
export interface LayoutRegion {
	/** The DOM element for this region. */
	readonly el: HTMLElement;
}

/** Map of region name → region object. */
export type RegionMap = Record<string, LayoutRegion>;

/**
 * Core layout interface.
 *
 * Every layout implementation must support:
 * - `mount(container)` — render into a parent element
 * - `getRegion(name)` — retrieve a named content region
 * - `dispose()` — tear down DOM and release resources
 */
export interface ILayout {
	/** Layout type identifier (e.g. "single", "split", "tabbed", "stacked"). */
	readonly type: string;
	/** Mount the layout into a container element. */
	mount(container: HTMLElement): void;
	/** Retrieve a named region. Returns null if region doesn't exist. */
	getRegion(name: string): LayoutRegion | null;
	/** Tear down all DOM nodes and release resources. */
	dispose(): void;
}

/** Configuration for creating a layout instance. */
export interface LayoutConfig {
	[key: string]: unknown;
}

/** Factory function that creates an ILayout from configuration. */
export type LayoutFactory = (config?: LayoutConfig) => ILayout;
