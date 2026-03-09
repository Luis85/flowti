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
	/** Run an executable file with args, return trimmed stdout or null on error. */
	execFile(cmd: string, args: string[], opts?: { timeout?: number; stdio?: string }): string | null;
	/** Run a command capturing both stdout and stderr, return combined output. */
	runCapture(cmd: string, opts?: { cwd?: string; timeout?: number }): string;
	/** Run a command capturing output and exit code. */
	runCaptureStatus(cmd: string, opts?: { cwd?: string; timeout?: number }): { output: string; exitCode: number };
}

// ── Process abstraction ──────────────────────────────────────────────

export interface IProcess {
	/** Terminate the process with exit code. */
	exit(code: number): never;
	/** Command-line arguments (process.argv.slice(2)). */
	argv(): string[];
	/** Current working directory. */
	cwd(): string;
	/** Environment variables. */
	env(): Record<string, string | undefined>;
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

/** Resolved project context passed to non-interactive command handlers. */
export interface ProjectContext {
	path: string;
	pkg: { name?: string; version?: string; scripts?: Record<string, string> } | null;
	config: ProjectConfig;
	scripts: Record<string, string>;
	/** Non-fatal config validation warnings (present if config has issues). */
	configWarnings?: string[];
}

export type CommandHandler = (
	flags: Record<string, string | boolean>,
	rawArgs: string[],
	command?: string,
	project?: ProjectContext,
) => void | Promise<void>;

// ── Persistent state ────────────────────────────────────────────────

export interface CliState {
	selectedProject?: string;
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
	/** Directory containing journey test definitions (relative to project root) */
	journeysDir?: string;
	/** Path to the E2E test vault (absolute, or relative to vault root) */
	testVault?: string;
	/** Plugin ID for Obsidian plugin testing */
	pluginId?: string;
	/** Review runner command */
	runner?: string;
	/** Build command for review cycle */
	build?: string;
	/** Test command for review cycle */
	test?: string;
	/** E2E teardown command */
	teardown?: string;
	/** E2E rebuild command */
	rebuild?: string;
}

export interface ReportGenerator {
	/** Generator ID — resolved via the internal registry. */
	id?: string;
	label: string;
	/** External command — used when no internal generator is registered for the ID. */
	command?: string;
	/** Commands to run before this generator (e.g. "npm run test:coverage"). */
	prerequisites?: string[];
}

/** Result returned by an internal report generator function. */
export interface GeneratorOutput {
	success: boolean;
	outputPath: string;
	metrics: Record<string, string | number>;
	/** Non-fatal issues surfaced in the Report Run Summary. */
	warnings?: string[];
}

/** A callable report generator function. */
export type GeneratorFn = (projectPath: string) => GeneratorOutput;

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
	/** TypeDoc command to run for collecting warnings (default: "npm run typedoc") */
	typedocCommand?: string;
	/** Maximum allowed TypeDoc warnings (default: 0) */
	typedocWarnings?: number;
}

export interface ReportsConfig {
	/** Relative path from project root to the reports directory (default: "reports") */
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
	/** Directory for reference documents (default: "docs/reference") */
	referenceDir?: string;
}

export type MakeTemplateId = "journey" | "component";

export interface MakeConfig {
	/** Which Make templates are available for this project */
	templates?: MakeTemplateId[];
}

export interface ComponentsConfig {
	/** Whether Storybook is enabled for this project */
	storybook?: boolean;
	/** Directory name for the Storybook component library (default: "component-library") */
	storybookDir?: string;
}

export interface HealthConfig {
	thresholds?: {
		coverage?: { min?: number; target?: number };
		lint?: { maxErrors?: number; maxWarnings?: number };
		tests?: { minPassed?: number };
	};
}

export interface ProjectConfig {
	name: string;
	tools?: Partial<Record<FlowtiToolId, string>>;
	make?: MakeConfig;
	components?: ComponentsConfig;
	reports?: ReportsConfig;
	docs?: DocsConfig;
	publish?: PublishConfig;
	review?: ReviewConfig;
	health?: HealthConfig;
}

// ── CLI configuration ───────────────────────────────────────────────

// ── CLI configuration ───────────────────────────────────────────

export interface SubsystemPluginConfig {
	root?: string;
	config?: string;
	manifest?: string;
	package?: string;
	scripts?: string;
}

export interface OnboardingConfig {
	nodeMinVersion?: number;
	pluginId?: string;
}

export interface TestingConfig {
	/** Name of the test vault directory (created as sibling to vault root). */
	vault?: string;
}

export interface FlowtiCliConfig {
	version?: string;
	/** Relative path from vault root to CLI source project. */
	source?: string;
	defaultAuthor?: string;
	projectsFolder?: string;
	subsystems?: {
		plugin?: SubsystemPluginConfig;
	};
	capture?: Record<string, string>;
	onboarding?: OnboardingConfig;
	testing?: TestingConfig;
}
