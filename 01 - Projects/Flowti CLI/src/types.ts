/**
 * types.ts — Cross-cutting type definitions for the Flowti CLI.
 */

// ── CLI argument parsing ────────────────────────────────────────────

export interface ParsedArgs {
	command: string | null;
	flags: Record<string, string | boolean>;
}

// ── Menu system ─────────────────────────────────────────────────────

export type MenuResult = "main" | "quit" | void;

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

export interface CliState {
	selectedProject?: string;
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
	build?: { commands?: Record<string, string> };
	test?: { commands?: Record<string, string> };
	devtools?: { commands?: Record<string, string> };
	review?: { commands?: Record<string, string> };
	publish?: { commands?: Record<string, string> };
	reports?: {
		allCommand?: string;
		outputDir?: string;
		auditSubdir?: string;
		categories?: Array<{ dir: string; label: string }>;
		stableReports?: Array<{ file: string; label: string }>;
	};
	onboarding?: {
		nodeMinVersion?: number;
		pluginId?: string;
	};
}
