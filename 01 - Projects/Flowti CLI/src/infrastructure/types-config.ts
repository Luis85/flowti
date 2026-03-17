/**
 * types-config.ts — Configuration type definitions for the Flowti CLI.
 *
 * All per-project and vault-level config interfaces live here.
 * Re-exported from types.ts for backward compatibility.
 */

import type { EntityType } from "./types.js";

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
	journeysDir?: string;
	testVault?: string;
	pluginId?: string;
	runner?: string;
	build?: string;
	test?: string;
	teardown?: string;
	rebuild?: string;
	target?: "cli" | "obsidian-vault" | "obsidian-plugin" | "typescript" | "webapp";
	capabilities?: string[];
	sequencer?: "alphabetical" | "risk-priority" | "chapter-order";
	bail?: number;
	timeout?: number;
	hookTimeout?: number;
	parallel?: boolean;
	stepFilter?: string;
	evidenceDir?: string;
	screenshots?: boolean;
	logs?: boolean;
	traces?: boolean;
	retainRuns?: number;
	gates?: ReviewGateConfig;
}

export interface ReportGenerator {
	id?: string;
	label: string;
	command?: string;
	prerequisites?: string[];
	dependencies?: string[];
}

export interface GeneratorSuccess {
	success: true;
	outputPath: string;
	metrics: Record<string, string | number>;
	warnings?: string[];
}

export interface GeneratorFailure {
	success: false;
	outputPath: string;
	metrics: Record<string, string | number>;
	warnings?: string[];
	error?: string;
}

export type GeneratorOutput = GeneratorSuccess | GeneratorFailure;

export type GeneratorFn = (projectPath: string, deps: import("./deps.js").ReportDeps, ctx?: import("./pipeline/pipeline-types.js").PipelineContext) => GeneratorOutput;

export interface SummaryThresholds {
	coverageLines?: number;
	coverageBranches?: number;
	maxComplexity?: number;
	maxFileDecisionPoints?: number;
	complexityAboveThresholdPct?: number;
	startupMs?: number;
	eslintWarnings?: number;
	lintCommand?: string;
	typedocCommand?: string;
	typedocWarnings?: number;
}

export interface ReportsConfig {
	dir?: string;
	outputDir?: string;
	allCommand?: string;
	generators?: ReportGenerator[];
	thresholds?: SummaryThresholds;
}

export interface DocGenerator { label: string; command: string }

export interface ReferenceConfig {
	id: string;
	label: string;
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
	templates?: MakeTemplateId[];
}

export type ComponentFramework = "html" | "angular" | "react" | "vue";

export const COMPONENT_FRAMEWORKS: readonly ComponentFramework[] = ["html", "angular", "react", "vue"] as const;

export interface ComponentsConfig {
	storybook?: boolean;
	storybookDir?: string;
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
export interface ResourcesConfig { dir?: string; }

// ── Time-Log ────────────────────────────────────────────────────────
export interface TimeLogConfig { dir?: string; }

// ── Deliverables ────────────────────────────────────────────────────
export type DeliverableStatus = "planned" | "in-progress" | "review" | "done" | "blocked";
export interface DeliverablesConfig { dir?: string; }

// ── RAID Log ────────────────────────────────────────────────────────
export type RAIDItemType = "risk" | "assumption" | "issue" | "dependency" | "decision";
export type RAIDStatus = "open" | "mitigated" | "closed" | "accepted" | "resolved" | "deferred";

export interface RAIDConfig {
	dir?: string;
}

// ── Requirements ────────────────────────────────────────────────────
export type RequirementType = "functional" | "non-functional" | "constraint";
export type MoSCoWPriority = "must" | "should" | "could" | "wont";

export interface RequirementsConfig {
	dir?: string;
}

// ── CAPA (Corrective and Preventive Action) ─────────────────────────
export type CAPAType = "corrective" | "preventive";
export type CAPAStatus = "open" | "investigating" | "action-planned" | "implementing" | "verification" | "closed" | "rejected";

export interface CAPAConfig {
	dir?: string;
}

// ── Lifecycle Engine ────────────────────────────────────────────────
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
	featuresDir?: string;
	productsDir?: string;
}

export type IterationStatus = "new" | "planned" | "ready" | "in-progress" | "in-review" | "done" | "cancelled";
export interface PhaseBinding { agent: string; role?: string; instruction?: string; }
export interface OrchestrationConfig { phases?: Record<string, PhaseBinding>; }
export interface IterationsConfig { dir?: string; durationDays?: number; lifecycle?: string; orchestration?: OrchestrationConfig; }
export interface AgentsConfig { dir?: string; roster?: string[]; autonomous?: boolean; claudeSync?: boolean; skillMap?: Record<string, string[]>; thinkingDisplay?: "full" | "indicator" | "hidden"; processTimeoutMs?: number; provider?: string; maxConcurrent?: number; }

export interface WorkspacesConfig {
	readonly baseDir: string;
	readonly defaultRetain: boolean;
	readonly retentionMaxAge: number;
	readonly maxConcurrent: number;
	readonly branchPrefix: string;
}

/** Top-level agents environment config — opt-in ExcaliburJS dashboard. */
export interface AgentsDashboardConfig {
	dashboard?: boolean;
	dashboardDir?: string;
}

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
	agents?: AgentsConfig;
}

// ── Entity Templates ────────────────────────────────────────────────
export interface TemplatesConfig {
	dir?: string;
}

// ── Project type discrimination ─────────────────────────────────────
export type ProjectTarget = "project" | "typescript" | "typescript-cli" | "obsidian-plugin";

// ── Named command maps ──────────────────────────────────────────────
export interface BuildConfig {
	commands?: Record<string, string>;
}

export interface TestConfig {
	commands?: Record<string, string>;
}

export interface LintThresholds {
	maxComplexity?: number;
	maxLines?: number;
}

export interface DevToolsConfig {
	commands?: Record<string, string>;
	thresholds?: LintThresholds;
}

export interface PathsConfig {
	pluginRoot?: string;
	pluginOutput?: string;
	reports?: string;
	e2eVault?: string;
}

// ── Project configuration ───────────────────────────────────────────

export interface ProjectConfig {
	name: string;
	type?: ProjectTarget;
	build?: BuildConfig;
	test?: TestConfig;
	devtools?: DevToolsConfig;
	paths?: PathsConfig;
	make?: MakeConfig;
	components?: ComponentsConfig;
	agents?: AgentsDashboardConfig;
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

export interface TestingConfig { vault?: string; }

export interface FlowtiCliConfig {
	version?: string;
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
	agents?: AgentsConfig;
	workspaces?: WorkspacesConfig;
}

// ── Project context (needs both infra + config types) ───────────────

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
