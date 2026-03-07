/**
 * types.ts — Cross-cutting type definitions for the Flowti CLI.
 */

// ── CLI argument parsing ────────────────────────────────────────────

export interface ParsedArgs {
	command: string | null;
	flags: Record<string, string | boolean>;
}

// ── Menu system ─────────────────────────────────────────────────────

export type MenuResult = "main" | "quit" | "start" | void;

export interface MenuItem {
	key: string;
	label: string;
	action: () => MenuResult | Promise<MenuResult>;
	disabled?: boolean | (() => boolean);
	disabledMessage?: string;
}

export interface MenuSeparator {
	separator: true;
}

export type MenuEntry = MenuItem | MenuSeparator;

export interface MenuOptions {
	defaultChoice?: string;
}

// ── Command dispatch ────────────────────────────────────────────────

export type CommandHandler = (
	flags: Record<string, string | boolean>,
	rawArgs: string[],
	command?: string,
) => void | Promise<void>;

// ── Persistent state ────────────────────────────────────────────────

export type ProjectSource = "projects" | "development";

export interface CliState {
	selectedProject?: string;
	projectSource?: ProjectSource;
}

// ── Per-project configuration ──────────────────────────────────────

export type FlowtiToolId = "build" | "reports" | "devtools";

export interface FlowtiToolDef {
	id: FlowtiToolId;
	key: string;
	label: string;
}

export const FLOWTI_TOOLS: FlowtiToolDef[] = [
	{ id: "devtools", key: "6", label: "Dev Tools" },
];

export interface PublishEndpoint {
	name: string;
	path: string;
	clean?: boolean;
}

export interface PublishConfig {
	build?: string;
	test?: string;
	outDir?: string;
	artifacts?: string[];
	endpoints?: PublishEndpoint[];
}

export interface ReviewConfig {
	journeysDir?: string;
	testVault?: string;
	runner?: string;
	build?: string;
	test?: string;
	teardown?: string;
	rebuild?: string;
}

export interface ReportsConfig {
	/** Relative path from project root to the reports directory (default: "docs/reports") */
	dir?: string;
	/** Command to generate all reports */
	allCommand?: string;
}

export interface DocGenerator {
	label: string;
	command: string;
}

export interface DocsConfig {
	/** Command to generate all documentation at once */
	allCommand?: string;
	/** Individual documentation generators */
	generators?: DocGenerator[];
}

export interface ProjectConfig {
	name: string;
	tools?: Partial<Record<FlowtiToolId, string>>;
	reports?: ReportsConfig;
	docs?: DocsConfig;
	publish?: PublishConfig;
	review?: ReviewConfig;
}

// ── CLI configuration ───────────────────────────────────────────────

export interface FlowtiCliConfig {
	projectsFolder?: string;
	subsystems?: {
		plugin?: {
			root?: string;
			config?: string;
			manifest?: string;
			package?: string;
			scripts?: string;
		};
	};
	capture?: Record<string, string>;
	onboarding?: {
		nodeMinVersion?: number;
		pluginId?: string;
	};
}
