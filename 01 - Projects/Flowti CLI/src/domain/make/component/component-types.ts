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

/** An event handler the component emits (e.g. onClick, onChange). */
export interface ComponentAction {
	name: string;
	description?: string;
}

/** A named preset of property values rendered as an individual Storybook story. */
export interface ComponentVariant {
	name: string;
	label?: string;
	/** Property overrides for this variant. */
	props: Record<string, string | number | boolean>;
}

/** An image associated with the component (screenshot, mockup, diagram, etc.). */
export interface ComponentImage {
	src: string;
	alt?: string;
	role?: "screenshot" | "mockup" | "diagram" | "photo" | "icon";
}

/** An interactive state the component can be in (e.g. hover, loading, error). */
export interface ComponentState {
	name: string;
	label?: string;
	description?: string;
	/** Property overrides that represent this state. */
	props: Record<string, string | number | boolean>;
}

/** A reference to a child component composed into this component. */
export interface ComponentChild {
	/** Name of the child component (must match an existing component id). */
	name: string;
	/** Slot or region where the child is placed (e.g. "header", "sidebar", "content"). */
	slot?: string;
	/** Whether the child is optional. */
	optional?: boolean;
}

/** A store (state management) dependency for a component. */
export interface ComponentStore {
	/** Store name (e.g. "useAuthStore", "useCartStore"). */
	name: string;
	/** Store technology (e.g. "pinia", "vuex", "ngrx", "redux", "zustand"). */
	technology?: string;
	/** Brief description of what this store provides. */
	description?: string;
}

export interface ComponentDefinition {
	id: string;
	kind: ComponentKind;
	label: string;
	description: string;
	/** Business domain this component belongs to (e.g. "auth", "checkout", "analytics"). */
	domain?: string;
	/** Icon identifier (e.g. "lock", "cart", "chart-bar"). */
	icon?: string;
	/** Primary hero image for documentation and Storybook. */
	heroImage?: string;
	/** Additional images (screenshots, mockups, diagrams). */
	images?: ComponentImage[];
	prompts: ComponentPrompt[];
	files: ComponentFileMapping[];
	metadata: Record<string, unknown>;
	properties: ComponentProperty[];
	actions: ComponentAction[];
	variants: ComponentVariant[];
	states: ComponentState[];
	/** Child components composed into this component. */
	children?: ComponentChild[];
	/** Stores (state management) this component depends on. */
	stores?: ComponentStore[];
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

import type { Document } from "../../../infrastructure/document.js";
import type { CliDeps } from "../../../infrastructure/deps.js";

export type ComponentTemplateDeps = Pick<CliDeps, "clock">;

export type ComponentTemplateFn = (vars: ComponentVariables, def: ComponentDefinition, deps: ComponentTemplateDeps) => string | Document;

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
	/** Names of child components (computed from containedBy). */
	contains?: string[];
	/** Business domain this component is grouped under (e.g. "auth", "checkout"). */
	domain?: string;
	/** True when the definition JSON is newer than one or more generated sibling files. */
	isDirty?: boolean;
}
