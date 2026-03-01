import type { CanvasData } from "obsidian/canvas";

/** Metadata and generator for a canvas template. */
export interface CanvasTemplate {
	/** Unique template identifier. */
	readonly id: string;
	/** Display name shown in the template picker. */
	readonly name: string;
	/** Short description of the template's purpose. */
	readonly description: string;
	/** Obsidian icon name for the picker UI. */
	readonly icon: string;
	/** Template category for grouping. */
	readonly category: CanvasTemplateCategory;
	/** Generates a fresh CanvasData with unique IDs on each call. */
	generate(): CanvasData;
}

export type CanvasTemplateCategory = "design" | "planning" | "reflection" | "ideation";
