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

export interface BackgroundProcess {
	/** Wait for a line matching the pattern in stdout/stderr; resolves with the matched line or null on timeout. */
	waitForOutput(pattern: RegExp, timeoutMs?: number): Promise<string | null>;
	/** Subscribe to live output lines. Returns an unsubscribe function. */
	onOutput(callback: (line: string) => void): () => void;
	/** Kill the background process. */
	kill(): void;
	/** Whether the process is still running. */
	readonly running: boolean;
	/** Collected output lines (stdout + stderr) for diagnostics. */
	readonly output: string[];
}

export interface IShell {
	/** Run a command with inherited stdio, return exit code. */
	run(cmd: string, opts?: { cwd?: string; label?: string; env?: Record<string, string> }): number;
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
	/** Run a command capturing stdout, stderr, and exit code separately. */
	runCaptureDetailed(cmd: string, opts?: { cwd?: string; timeout?: number; env?: Record<string, string> }): { stdout: string; stderr: string; exitCode: number };
	/** Spawn a command in the background with piped stdout/stderr. */
	spawnBackground(cmd: string, opts?: { cwd?: string; env?: Record<string, string> }): BackgroundProcess;
	/** Run a command asynchronously, return exit code and captured output. */
	runAsync(cmd: string, opts?: { cwd?: string; timeout?: number }): Promise<{ output: string; exitCode: number }>;
	/** Run multiple commands in parallel, return results in order. */
	runParallel(cmds: string[], opts?: { cwd?: string; timeout?: number }): Promise<{ output: string; exitCode: number }[]>;
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

// ── Path operations abstraction ──────────────────────────────────────

export interface IPaths {
	join(...segments: string[]): string;
	resolve(...segments: string[]): string;
	dirname(p: string): string;
	basename(p: string, ext?: string): string;
	relative(from: string, to: string): string;
	extname(p: string): string;
	isAbsolute(p: string): boolean;
	readonly sep: string;
}

// ── Clock abstraction ───────────────────────────────────────────────

export interface IClock {
	/** Current date/time. */
	now(): Date;
	/** Millisecond timestamp (like Date.now()). */
	ms(): number;
	/** ISO 8601 timestamp string. */
	iso(): string;
	/** Filename-safe timestamp (colons replaced with dashes). */
	safeIso(): string;
}

// ── User input abstraction ──────────────────────────────────────────

export interface IInput {
	ask(question: string, defaultValue?: string): Promise<string>;
	askYesNo(question: string, defaultNo?: boolean): Promise<boolean>;
	waitForEnter(): Promise<void>;
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
	selectedProduct?: string;
	selectedFeature?: string;
	selectedItemType?: EntityType;
}

// ── Per-project configuration ──────────────────────────────────────

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

/** Quality gate configuration for the Review platform. */
export interface ReviewGateConfig {
	coverage?: { requirementCoverage?: number; journeyCoverage?: number; statementCoverage?: number };
	security?: { required?: boolean; maxCritical?: number; maxHigh?: number };
	risk?: { criticalMustPass?: boolean; highMustPass?: boolean };
	release?: { allGatesMustPass?: boolean; requireApproval?: boolean };
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

	// ── Environment ──────────────────────────────────────────
	/** Project target type — determines which EnvironmentProvider is used. */
	target?: "cli" | "obsidian-vault" | "obsidian-plugin" | "typescript" | "webapp";
	/** Capability IDs required for E2E. */
	capabilities?: string[];

	// ── Execution ────────────────────────────────────────────
	/** Journey execution order strategy. Default: "chapter-order". */
	sequencer?: "alphabetical" | "risk-priority" | "chapter-order";
	/** Bail after N failures. 0 = never bail. Default: 0. */
	bail?: number;
	/** Default timeout for commands in milliseconds. Default: 30000. */
	timeout?: number;
	/** Default timeout for lifecycle hooks in milliseconds. */
	hookTimeout?: number;
	/** Enable parallel journey execution (future). Default: false. */
	parallel?: boolean;
	/** Step ID filter — only run matching steps. */
	stepFilter?: string;

	// ── Evidence ─────────────────────────────────────────────
	/** Evidence storage directory (relative to project root). Default: "docs/evidence". */
	evidenceDir?: string;
	/** Capture screenshots during E2E. Default: true. */
	screenshots?: boolean;
	/** Collect execution logs. Default: true. */
	logs?: boolean;
	/** Collect API traces. Default: false. */
	traces?: boolean;
	/** Number of evidence runs to retain. Default: 10. */
	retainRuns?: number;

	// ── Quality Gates ────────────────────────────────────────
	/** Quality gate configuration. */
	gates?: ReviewGateConfig;
}

export interface ReportGenerator {
	/** Generator ID — resolved via the internal registry. */
	id?: string;
	label: string;
	/** External command — used when no internal generator is registered for the ID. */
	command?: string;
	/** Commands to run before this generator (e.g. "npm run test:coverage"). */
	prerequisites?: string[];
	/** IDs of other generators that must complete before this one. */
	dependencies?: string[];
}

/** Successful generator result — output written, metrics collected. */
export interface GeneratorSuccess {
	success: true;
	outputPath: string;
	metrics: Record<string, string | number>;
	/** Non-fatal issues surfaced in the Report Run Summary. */
	warnings?: string[];
}

/** Failed generator result — may still contain partial output. */
export interface GeneratorFailure {
	success: false;
	outputPath: string;
	metrics: Record<string, string | number>;
	/** Non-fatal issues surfaced in the Report Run Summary. */
	warnings?: string[];
	/** Error message describing the failure cause. */
	error?: string;
}

/**
 * Result returned by an internal report generator function.
 * Discriminated union on `success` — enables exhaustive matching
 * and type narrowing after `if (output.success)` checks.
 */
export type GeneratorOutput = GeneratorSuccess | GeneratorFailure;

/**
 * A callable report generator function.
 * Receives infrastructure deps for testability (no singleton imports).
 * The optional third parameter provides pipeline context when
 * running inside a pipeline (for accessing prior results, command outputs, etc.).
 */
export type GeneratorFn = (projectPath: string, deps: import("./deps.js").ReportDeps, ctx?: import("./pipeline/pipeline-types.js").PipelineContext) => GeneratorOutput;

export interface SummaryThresholds {
	/** Minimum line coverage percentage (default: 80) */
	coverageLines?: number;
	/** Minimum branch coverage percentage (default: 70) */
	coverageBranches?: number;
	/** Maximum cyclomatic complexity per function (default: 15) */
	maxComplexity?: number;
	/** Maximum decision points per file before flagging (default: 50) */
	maxFileDecisionPoints?: number;
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
	/** Relative path from project root to reports data directory — where prerequisites write JSON (default: "reports"). */
	dir?: string;
	/** Relative path from project root to reports output directory. When set, generated markdown goes here instead of `dir`. */
	outputDir?: string;
	/** Command to generate all reports */
	allCommand?: string;
	/** Individual report generators */
	generators?: ReportGenerator[];
	/** Thresholds for the summary report analysis */
	thresholds?: SummaryThresholds;
}

export interface DocGenerator { label: string; command: string }

/** Per-project reference configuration — declares which references to generate and their source files. */
export interface ReferenceConfig {
	/** Generator ID from the registry (e.g. "cli-reference", "event-catalog"). */
	id: string;
	/** Display label for menu and pipeline output. */
	label: string;
	/** Source file path relative to the project root (overrides hardcoded defaults). */
	source?: string;
}

export interface BookConfig { title?: string; enabled?: boolean; filename?: string }

export interface DocsConfig {
	allCommand?: string;
	generators?: DocGenerator[];
	referenceDir?: string;
	references?: ReferenceConfig[];
	book?: BookConfig;
}

export type MakeTemplateId = "journey" | "component";

export interface MakeConfig {
	/** Which Make templates are available for this project */
	templates?: MakeTemplateId[];
}

/** UI framework target for component scaffolding and Storybook. */
export type ComponentFramework = "html" | "angular" | "react" | "vue";

export const COMPONENT_FRAMEWORKS: readonly ComponentFramework[] = ["html", "angular", "react", "vue"] as const;

export interface ComponentsConfig {
	/** Whether Storybook is enabled for this project */
	storybook?: boolean;
	/** Directory for components and Storybook (default: "components") */
	storybookDir?: string;
	/** UI framework target (default: "html") */
	framework?: ComponentFramework;
}

export type QualityGateOperator = ">=" | "<=" | "==";

export interface QualityGateRule {
	metric: string;
	operator: QualityGateOperator;
	value: number;
}

export interface QualityGateConfig {
	enabled?: boolean;
	minScore?: number;
	rules?: QualityGateRule[];
}

export interface HealthConfig {
	thresholds?: {
		coverage?: { min?: number; target?: number };
		lint?: { maxErrors?: number; maxWarnings?: number };
		tests?: { minPassed?: number };
	};
	qualityGates?: QualityGateConfig;
}

// ── Resource Management ─────────────────────────────────────────────

export type ResourceType = "human" | "material" | "role" | "budget";

export interface ResourcesConfig {
	/** Directory for resource files relative to project root (default: "docs/resources"). */
	dir?: string;
}

// ── Time-Log ────────────────────────────────────────────────────────

export interface TimeLogConfig {
	/** Directory for time-log entries relative to project root (default: "docs/timelog"). */
	dir?: string;
}

// ── Deliverables ────────────────────────────────────────────────────

export type DeliverableStatus = "planned" | "in-progress" | "review" | "done" | "blocked";

export interface DeliverablesConfig {
	/** Directory for deliverable files relative to project root (default: "docs/deliverables"). */
	dir?: string;
}

// ── RAID Log ────────────────────────────────────────────────────────

export type RAIDItemType = "risk" | "assumption" | "issue" | "dependency" | "decision";
export type RAIDStatus = "open" | "mitigated" | "closed" | "accepted" | "resolved" | "deferred";

export interface RAIDConfig {
	/** Directory for RAID items relative to project root (default: "docs/raid"). */
	dir?: string;
}

// ── Requirements ────────────────────────────────────────────────────

export type RequirementType = "functional" | "non-functional" | "constraint";
export type MoSCoWPriority = "must" | "should" | "could" | "wont";

export interface RequirementsConfig {
	/** Directory for requirements relative to project root (default: "docs/requirements"). */
	dir?: string;
}

// ── CAPA (Corrective and Preventive Action) ─────────────────────────

export type CAPAType = "corrective" | "preventive";
export type CAPAStatus = "open" | "investigating" | "action-planned" | "implementing" | "verification" | "closed" | "rejected";

export interface CAPAConfig {
	/** Directory for CAPA items relative to project root (default: "docs/capa"). */
	dir?: string;
}

// ── Lifecycle Engine ────────────────────────────────────────────────

export type EntityType = "project" | "product" | "feature";

export type ProjectLifecycleState = "inception" | "planning" | "execution" | "monitoring" | "closing" | "archived";
export type ProductLifecycleState = "concept" | "development" | "launch" | "growth" | "maturity" | "decline" | "sunset";
export type FeatureLifecycleState = "ideation" | "specification" | "development" | "testing" | "release" | "deprecated";

export type LifecycleState = ProjectLifecycleState | ProductLifecycleState | FeatureLifecycleState;

export interface LifecycleTransitionRecord {
	date: string;
	from: string;
	to: string;
	reason: string;
}

export interface LifecycleConfig {
	/** Directory for nested features relative to project root (default: "docs/features"). */
	featuresDir?: string;
	/** Directory for nested products relative to project root (default: "docs/products"). */
	productsDir?: string;
}

export type IterationStatus = "planned" | "in-progress" | "in-review" | "completed" | "cancelled";
export interface IterationsConfig { dir?: string; durationDays?: number; }

// ── Project Management (aggregated) ─────────────────────────────────
export interface ManagementConfig {
	resources?: ResourcesConfig;
	timelog?: TimeLogConfig;
	deliverables?: DeliverablesConfig;
	raid?: RAIDConfig;
	requirements?: RequirementsConfig;
	capa?: CAPAConfig;
	lifecycle?: LifecycleConfig;
	iterations?: IterationsConfig;
}

// ── Entity Templates ────────────────────────────────────────────────

export interface TemplatesConfig {
	/** Directory for user entity templates relative to project root (default: "docs/templates"). */
	dir?: string;
}

// ── Project type discrimination ─────────────────────────────────────

/** The four project archetypes the CLI can manage. */
export type ProjectTarget = "project" | "typescript" | "typescript-cli" | "obsidian-plugin";

// ── Named command maps ──────────────────────────────────────────────

/** Named build modes (e.g., fast, increment, full, watch, distribute). */
export interface BuildConfig {
	/** Named build commands keyed by mode. */
	commands?: Record<string, string>;
}

/** Named test presets (e.g., unit, flows, e2e, increment). */
export interface TestConfig {
	/** Named test commands keyed by preset. */
	commands?: Record<string, string>;
}

/** Configurable lint thresholds for ESLint rules. */
export interface LintThresholds {
	/** Cyclomatic complexity warn threshold (default: 10). */
	maxComplexity?: number;
	/** Max lines per file, excluding blanks and comments (default: 300). */
	maxLines?: number;
}

/** Named devtools commands (e.g., reload, console, check, lint). */
export interface DevToolsConfig {
	/** Named devtools commands keyed by action. */
	commands?: Record<string, string>;
	/** Configurable lint thresholds applied by ESLint. */
	thresholds?: LintThresholds;
}

/** Project-specific path mappings for non-standard layouts. */
export interface PathsConfig {
	/** Root of plugin source (relative to vault root). */
	pluginRoot?: string;
	/** Plugin output directory (relative to vault root). */
	pluginOutput?: string;
	/** Reports output directory (relative to project root). */
	reports?: string;
	/** E2E test vault path (absolute, or relative to vault root). */
	e2eVault?: string;
}

// ── Project configuration ───────────────────────────────────────────

export interface ProjectConfig {
	name: string;
	/** Project archetype — drives feature availability and scaffold selection. */
	type?: ProjectTarget;
	/** Named build commands by mode. */
	build?: BuildConfig;
	/** Named test commands by preset. */
	test?: TestConfig;
	/** Named devtools commands by action. */
	devtools?: DevToolsConfig;
	/** Project-specific path mappings. */
	paths?: PathsConfig;
	make?: MakeConfig;
	components?: ComponentsConfig;
	reports?: ReportsConfig;
	docs?: DocsConfig;
	publish?: PublishConfig;
	review?: ReviewConfig;
	health?: HealthConfig;
	management?: ManagementConfig;
	templates?: TemplatesConfig;
}

// ── CLI configuration ───────────────────────────────────────────────

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

/** Test vault configuration. */
export interface TestingConfig { vault?: string; }

export interface FlowtiCliConfig {
	version?: string;
	/** Relative path from vault root to CLI source project. */
	source?: string;
	defaultAuthor?: string;
	projectsFolder?: string;
	productsFolder?: string;
	featuresFolder?: string;
	subsystems?: {
		plugin?: SubsystemPluginConfig;
	};
	capture?: Record<string, string>;
	onboarding?: OnboardingConfig;
	testing?: TestingConfig;
}
