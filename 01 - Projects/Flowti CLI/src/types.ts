/**
 * types.ts — Cross-cutting type definitions for the Flowti CLI.
 */

import type fs from "node:fs";

// ── File system abstraction ────────────────────────────────────────

export interface DirEntry {
	name: string;
	isDirectory(): boolean;
	isFile(): boolean;
}

export interface IFileSystem {
	readFileSync(path: string, encoding: BufferEncoding): string;
	writeFileSync(path: string, content: string, encoding: BufferEncoding): void;
	existsSync(path: string): boolean;
	mkdirSync(path: string, options?: fs.MakeDirectoryOptions): void;
	readdirSync(path: string): string[];
	readdirSync(path: string, options: { withFileTypes: true }): DirEntry[];
	copyFileSync(src: string, dest: string): void;
	rmSync(path: string, options?: fs.RmOptions): void;
	unlinkSync(path: string): void;
	statSync(path: string): fs.Stats;
}

// ── Shell execution abstraction ──────────────────────────────────────

export interface IShell {
	/** Run a command with inherited stdio, return exit code. */
	run(cmd: string, opts?: { cwd?: string; label?: string }): number;
	/** Run a command silently, return trimmed stdout or null on error. */
	runSilent(cmd: string, opts?: { cwd?: string }): string | null;
	/** Run a command and check if it succeeds (exit code 0). */
	check(cmd: string): boolean;
}

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

export interface ReportGenerator {
	label: string;
	command: string;
}

export interface SummaryThresholds {
	/** Minimum line coverage percentage (default: 80) */
	coverageLines?: number;
	/** Minimum branch coverage percentage (default: 70) */
	coverageBranches?: number;
	/** Maximum cyclomatic complexity per function (default: 15) */
	maxComplexity?: number;
	/** Maximum percentage of functions above complexity threshold (default: 5) */
	complexityAboveThresholdPct?: number;
	/** Maximum startup time in ms (default: 5000) */
	startupMs?: number;
	/** Maximum allowed eslint warnings (default: 0) */
	eslintWarnings?: number;
	/** Lint command to run for collecting warnings (default: "npm run lint") */
	lintCommand?: string;
}

export interface ReportsConfig {
	/** Relative path from project root to the reports directory (default: "docs/reports") */
	dir?: string;
	/** Command to generate all reports */
	allCommand?: string;
	/** Individual report generators */
	generators?: ReportGenerator[];
	/** Thresholds for the summary report analysis */
	thresholds?: SummaryThresholds;
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

export type MakeTemplateId = "hub" | "plugin" | "app" | "cli";

export interface MakeConfig {
	/** Which Make templates are available for this project */
	templates?: MakeTemplateId[];
}

export interface ProjectConfig {
	name: string;
	tools?: Partial<Record<FlowtiToolId, string>>;
	make?: MakeConfig;
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
