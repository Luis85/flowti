/**
 * component-types.ts — Type definitions for the Component system.
 *
 * Components are the building blocks of a project. Each component
 * has documentation (Markdown), a test file, and a machine-readable
 * definition (JSON). C4 architecture entities are specialized components.
 */

// ── Component kinds ─────────────────────────────────────────────────

export type ComponentKind =
	| "component" | "layout" | "page" | "ui-component"
	| "system" | "container" | "c4-component" | "person";

export const COMPONENT_KINDS: ComponentKind[] = [
	"component", "layout", "page", "ui-component",
	"system", "container", "c4-component", "person",
];

// ── Component definition (JSON blueprint) ───────────────────────────

export interface ComponentPrompt {
	variable: string;
	label: string;
	default?: string;
	required?: boolean;
}

export interface ComponentFileMapping {
	/** Relative path from project root, supports {{variable}} interpolation. */
	path: string;
	/** Template ID referencing a registered component template function. */
	templateId: string;
}

export interface ComponentProperty {
	key: string;
	type: "string" | "number" | "boolean";
	default?: string | number | boolean;
	description?: string;
}

export interface ComponentDefinition {
	id: string;
	kind: ComponentKind;
	label: string;
	description: string;
	prompts: ComponentPrompt[];
	files: ComponentFileMapping[];
	metadata: Record<string, unknown>;
	properties: ComponentProperty[];
	nextSteps: string[];
}

// ── Template variables ──────────────────────────────────────────────

export interface ComponentVariables {
	name: string;
	kebab: string;
	pascal: string;
	camel: string;
	[key: string]: string;
}

// ── Template function signature ─────────────────────────────────────

export type ComponentTemplateFn = (vars: ComponentVariables, def: ComponentDefinition) => string;

// ── Project component (read from existing project) ──────────────────

export interface ProjectComponent {
	name: string;
	kind: ComponentKind;
	status: string;
	path: string;
	/** C4 level (1=System, 2=Container, 3=Component, 0=Person). */
	c4Level?: number;
	/** Name of the parent component (C4 containment relationship). */
	containedBy?: string;
}
