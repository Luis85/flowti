/**
 * scaffold-types.ts — Type definitions for the declarative scaffold domain.
 *
 * A ScaffoldDefinition is a JSON-serializable blueprint for an entire project.
 * Template functions resolve file content at scaffold time.
 */

// ── Variables ────────────────────────────────────────────────────────

/** Variables available for template interpolation. Auto-derived from name. */
export interface ScaffoldVariables {
	/** Human-readable project name (e.g., "My App") */
	name: string;
	/** kebab-case ID (e.g., "my-app") */
	id: string;
	/** PascalCase (e.g., "MyApp") */
	pascal: string;
	/** camelCase (e.g., "myApp") */
	camel: string;
	/** Author name */
	author: string;
}

// ── Prompts ──────────────────────────────────────────────────────────

/** A prompt for user input during interactive scaffolding. */
export interface ScaffoldPrompt {
	/** Variable name to bind the answer to. */
	variable: string;
	/** Prompt text shown to the user. */
	label: string;
	/** Default value. Supports {{cliConfig.defaultAuthor}} interpolation. */
	default?: string;
	/** Whether a non-empty answer is required. */
	required?: boolean;
}

// ── File mapping ─────────────────────────────────────────────────────

/** A single file to create during scaffolding. */
export interface ScaffoldFileMapping {
	/** Relative path, supports {{variable}} interpolation. */
	path: string;
	/** Template ID referencing a registered template function. */
	templateId: string;
}

// ── Package shape ────────────────────────────────────────────────────

/** Package.json shape embedded in the definition. */
export interface ScaffoldPackage {
	type?: "module" | "commonjs";
	main?: string;
	scripts: Record<string, string>;
	devDependencies: Record<string, string>;
}

// ── Flowti config ────────────────────────────────────────────────────

/** Partial flowti.config.json to pre-populate. */
export interface ScaffoldFlowtiConfig {
	publish?: {
		build?: string;
		test?: string;
		outDir?: string;
		artifacts?: string[];
	};
	review?: {
		build?: string;
		test?: string;
		journeysDir?: string;
		runner?: string;
	};
	reports?: {
		dir?: string;
		allCommand?: string;
	};
}

// ── Definition ───────────────────────────────────────────────────────

/** The declarative scaffold definition — single source of truth for a project type. */
export interface ScaffoldDefinition {
	/** Unique scaffold ID (e.g., "flowti-project"). */
	id: string;
	/** Menu display label. */
	label: string;
	/** Short description of what this scaffold creates. */
	description: string;
	/** User prompts beyond the auto-derived variables. */
	prompts: ScaffoldPrompt[];
	/** Package.json contents. */
	package: ScaffoldPackage;
	/** Pre-populated flowti.config.json. */
	flowtiConfig: ScaffoldFlowtiConfig;
	/** Directories to create (empty ones get .gitkeep). */
	directories: string[];
	/** File mappings: path → templateId. */
	files: ScaffoldFileMapping[];
	/** Post-scaffold instructions shown to the user. */
	nextSteps: string[];
}

// ── Template function ────────────────────────────────────────────────

/** A template function receives variables and the definition, returns file content. */
export type TemplateFn = (vars: ScaffoldVariables, def: ScaffoldDefinition) => string;

// ── Plan output ──────────────────────────────────────────────────────

/** A file to write during scaffolding. */
export interface FileEntry {
	path: string;
	content: string;
}

// ── Context ──────────────────────────────────────────────────────────

/** Full context for building a scaffold plan. */
export interface ScaffoldContext {
	vars: ScaffoldVariables;
	outputPath: string;
	definition: ScaffoldDefinition;
}
