/**
 * Project domain types for the project hub sidepanel.
 * Pure types — no I/O, no dependencies.
 */

export interface StorybookStatus {
	readonly installed: boolean;
	readonly framework: string | null;
	readonly running: boolean;
	readonly url: string | null;
	readonly pid: number | null;
	readonly hasStaticBuild: boolean;
}

export interface ProjectSummary {
	readonly name: string;
	readonly type: string;
	readonly hasNote: boolean;
	readonly storybook: StorybookStatus;
}

export interface ProjectBrief {
	readonly start?: string;
	readonly end?: string;
	readonly goal?: string;
	readonly description?: string;
	readonly status?: string;
}

export interface ProjectDetail extends ProjectSummary {
	readonly notePath: string | null;
	readonly projectPath: string;
	readonly hasSitemap: boolean;
	readonly hasCanvas: boolean;
	readonly canvasChanged: boolean;
	readonly brief?: ProjectBrief;
	readonly config?: ProjectConfig;
}

export type StorybookFramework = "html" | "react" | "vue3" | "angular" | "web_components" | "svelte";

export type ImportStrategy = "category" | "flat" | "hierarchical";

export interface MarkdownSourceConfig {
	readonly path: string;
	readonly strategy: ImportStrategy;
	readonly requiredFields: readonly string[];
}

/** AI block persisted in companion JSON (aligns with Flowti CLI AgentJson.ai). */
export interface AgentBlueprintAI {
	readonly provider?: string;
	readonly systemPrompt?: string;
	readonly allowedTools?: readonly string[];
	readonly permissions?: { readonly mode?: "ask" | "auto-allow" | "trust" };
}

/** RPG-style defaults for materializing an Agent note from a project role slot. */
export interface AgentBlueprint {
	readonly agentType?: string;
	readonly domain?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly description?: string;
	readonly personality?: readonly string[];
	readonly attributes?: { readonly str?: number; readonly int?: number; readonly wis?: number; readonly cha?: number; readonly dex?: number; readonly con?: number };
	readonly skills?: readonly string[];
	readonly behaviors?: readonly string[];
	readonly suggestedTasks?: readonly string[];
	readonly goals?: readonly { readonly name: string; readonly priority?: number }[];
	readonly ai?: AgentBlueprintAI;
	/** Optional globs for `.cursor/rules/*.mdc` frontmatter (comma-separated in UI). */
	readonly cursorRuleGlobs?: readonly string[];
}

/** Staffing slot on a project: need + optional blueprint; assignee links to vault Agent name. */
export interface TeamRoleSlot {
	readonly id: string;
	/** Display name — maps to `role:` in the ProjectRole markdown file. */
	readonly title: string;
	readonly need: string;
	readonly blueprint?: AgentBlueprint;
	readonly assignee?: string;
	/**
	 * Vault-relative path to `type: ProjectRole` markdown (e.g. `01 - Projects/MyApp/team/roles/solution-manager.md`).
	 * Persisted in flowti.config; requirements live in that file.
	 */
	readonly roleNotePath?: string;
	/** Filled when the role note is read from disk (not stored in JSON). */
	readonly roleSkills?: readonly string[];
	/** Frontmatter `description` line when present. */
	readonly roleSummary?: string;
	/** Markdown body of the role note (longer description). */
	readonly roleBody?: string;
	/** Full-time equivalent needed (from role note frontmatter `fte`). */
	readonly roleFte?: number;
	/** Planned start date `YYYY-MM-DD` (frontmatter `start`). */
	readonly roleStart?: string;
	/** Planned end date `YYYY-MM-DD` (frontmatter `end`). */
	readonly roleEnd?: string;
}

export interface ProjectConfig {
	readonly buildModes: readonly string[];
	readonly testPresets: readonly string[];
	readonly framework?: string;
	readonly healthTargets?: {
		readonly coverageMin?: number;
		readonly coverageTarget?: number;
		readonly maxLintErrors?: number;
		readonly maxLintWarnings?: number;
		readonly minTests?: number;
	};
	/** `management.agents.roster` — agent names attached to this project for dashboard export. */
	readonly agents?: readonly string[];
	readonly roleSlots?: readonly TeamRoleSlot[];
	readonly publishTargets?: readonly string[];
	readonly markdownSource?: MarkdownSourceConfig;
}

export type OutputCallback = (line: string) => void;

// ── TODO types ──────────────────────────────────────────────────────

export interface TodoItem {
	readonly text: string;
	readonly done: boolean;
}

// ── Event Catalog types ─────────────────────────────────────────────

export type CatalogEntityType = "domains" | "services" | "events" | "flows";

export interface CatalogEntity {
	readonly name: string;
	readonly type: string;
	readonly domain?: string;
	readonly status: string;
	readonly date: string;
	readonly path: string;
}

export interface CatalogEntityDef {
	readonly name: string;
	readonly domain?: string;
	readonly status?: string;
	readonly description?: string;
	readonly version?: string;
	readonly producers?: string;
	readonly consumers?: string;
}

// ── Reporting types ─────────────────────────────────────────────────

export interface ReportGeneratorInfo {
	readonly id: string;
	readonly label: string;
	readonly dependencies?: readonly string[];
	readonly prerequisites?: readonly string[];
}

export interface ReportResult {
	readonly id: string;
	readonly label: string;
	readonly ok: boolean;
	readonly metrics?: Record<string, number>;
	readonly outputPath?: string;
}

// ── Component types ─────────────────────────────────────────────────

export interface ComponentEntry {
	readonly name: string;
	readonly category: string;
	readonly status?: string;
	readonly propCount: number;
	readonly slotCount: number;
}

// ── Health types ────────────────────────────────────────────────────

export interface HealthScore {
	readonly overall: number;
	readonly grade: string;
	readonly categories: {
		readonly tests: number;
		readonly coverage: number;
		readonly build: number;
		readonly lint: number;
		readonly security: number;
		readonly git: number;
	};
}

/**
 * Project hub operations for the Obsidian plugin.
 *
 * **Data authority:** The production implementation is `VaultProjectService` only. It reads
 * and writes the vault via Obsidian’s API and runs tooling by spawning local processes (shell /
 * Node, including the Flowti CLI under `.flowti/bin`). There is **no** in-plugin HTTP server and no
 * requirement for a remote project API — agent roster, dashboard JSON, and world state continue to
 * flow from vault + `.flowti/` files and CLI subprocesses as described in agent-world docs.
 *
 * If a future integration needs a remote control plane, introduce a **separate** adapter behind a
 * narrow interface rather than resurrecting a second full `IProjectService` implementation.
 */
export interface IProjectService {
	listProjects(): Promise<ProjectSummary[]>;
	getProject(name: string): Promise<ProjectDetail | undefined>;
	installStorybook(project: string, framework: StorybookFramework, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
	startStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }>;
	stopStorybook(project: string): Promise<{ ok: boolean; error?: string }>;
	buildStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; outputDir?: string; error?: string }>;
	scaffoldStorybook(project: string, onOutput?: OutputCallback, opts?: { adoptImport?: boolean }): Promise<{ ok: boolean; filesCreated?: number; error?: string }>;
	importMarkdownSitemap(project: string, sourcePath: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
	saveMarkdownSourceConfig(project: string, config: MarkdownSourceConfig, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
	cleanStorybook(project: string): Promise<{ ok: boolean; error?: string }>;
	importCanvasSitemap(project: string, onOutput?: OutputCallback, opts?: { merge?: boolean }): Promise<{ ok: boolean; error?: string }>;
	previewStorybook(project: string): Promise<{ ok: boolean; url?: string; error?: string }>;
	/** Delegates to Flowti CLI `storybook:open` (Obsidian `web` when available, else OS default browser). */
	openStorybookUrl(project: string, url: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
	stopPreview(project: string): Promise<{ ok: boolean; error?: string }>;
	generateSitemapCanvas(project: string, onOutput?: OutputCallback, opts?: { preset?: string; force?: boolean }): Promise<{ ok: boolean; error?: string }>;
	importFromGit(url: string, name: string, mode: "submodule" | "template", onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
	detectProject(name: string): Promise<{ ok: boolean; type?: string; framework?: string; packageManager?: string; testFramework?: string; hasConfig?: boolean; buildCommand?: string; testCommand?: string; lintCommand?: string; error?: string }>;
	bootstrapProject(name: string, config: { build?: string; test?: string; lint?: string; storybook?: string }): Promise<{ ok: boolean; error?: string }>;
	createEmptyProject(name: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;

	// Health
	getHealth(project: string): Promise<{ ok: boolean; score?: HealthScore; error?: string }>;

	// TODOs
	getTodos(project: string): Promise<{ items: TodoItem[]; exists: boolean }>;
	addTodo(project: string, text: string): Promise<{ ok: boolean }>;
	toggleTodo(project: string, index: number): Promise<{ ok: boolean }>;
	deleteTodo(project: string, index: number): Promise<{ ok: boolean }>;

	// Event Catalog
	listEntities(project: string, entityType: CatalogEntityType): Promise<CatalogEntity[]>;
	createEntity(project: string, entityType: CatalogEntityType, definition: CatalogEntityDef): Promise<{ ok: boolean; path?: string }>;

	// Reports
	getReportGenerators(project: string): Promise<ReportGeneratorInfo[]>;
	runReport(project: string, generatorId: string, onOutput?: OutputCallback): Promise<{ ok: boolean; metrics?: Record<string, number>; outputPath?: string; error?: string }>;
	runAllReports(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; results?: ReportResult[]; error?: string }>;

	// Components
	listComponents(project: string): Promise<ComponentEntry[]>;

	// Team roster (role slots + vault agents)
	listVaultAgents(): Promise<VaultAgentSummary[]>;
	saveTeamRoster(project: string, roleSlots: readonly TeamRoleSlot[], onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
	/**
	 * @param slotsSnapshot — Current Team tab slots (including unsaved edits). When omitted, reads from `flowti.config.json` only.
	 */
	createAgentFromRole(
		project: string,
		roleId: string,
		agentName: string,
		onOutput?: OutputCallback,
		slotsSnapshot?: readonly TeamRoleSlot[],
	): Promise<{ ok: boolean; error?: string }>;
}

/** Minimal info for assigning existing agents to a role. */
export interface VaultAgentSummary {
	readonly name: string;
	readonly path: string;
}

/** Detection result from project-from-git wizard. */
export interface GitDetectResult {
	readonly ok: boolean;
	readonly type?: string;
	readonly framework?: string;
	readonly packageManager?: string;
	readonly testFramework?: string;
	readonly hasConfig?: boolean;
	readonly buildCommand?: string;
	readonly testCommand?: string;
	readonly lintCommand?: string;
}

/**
 * Typed bridge interface for the handler → Lit component contract.
 * Mirrors the public reactive properties of FlowtiProjectDetail.
 * The handler casts `document.createElement("flowti-project-detail")` to this type.
 */
export interface ProjectDetailElement extends HTMLElement {
	projectName: string;
	projectType: string;
	hasNote: boolean;
	notePath: string;
	projects: ProjectSummary[];
	searchQuery: string;
	cliConnected: boolean;
	storybook: StorybookStatus;
	storybookBusy: boolean;
	storybookBusyLabel: string;
	storybookOutput: string[];
	storybookError: string;
	components: ComponentEntry[];
	projectHubBusy: boolean;
	projectHubBusyLabel: string;
	projectHubOutput: string[];
	projectHubError: string;
	actionSuccess: string;
	statusMessage: string;
	config: ProjectConfig | undefined;
	hasSitemap: boolean;
	hasMarkdownSource: boolean;
	hasCanvas: boolean;
	canvasChanged: boolean;
	canvasPreset: string;
	brief: ProjectBrief | undefined;
	showScaffoldModal: boolean;
	showGitModal: boolean;
	gitModalMode: "submodule" | "template";
	showNamePrompt: boolean;
	gitImportStep: "form" | "progress" | "detect" | "configure" | "done";
	gitImportError: string;
	gitImportOutputLines: string[];
	gitImportDetected: GitDetectResult | null;
	configSaveStatus: string;
	configSourcePath: string;
	healthScore: HealthScore | null;
	healthError: string;
	todos: TodoItem[];
	todosExist: boolean;
	catalogEntities: CatalogEntity[];
	reportGenerators: ReportGeneratorInfo[];
	reportNodeStates: Record<string, string>;
	reportOutput: string[];
	reportBusy: boolean;
	roleSlots: TeamRoleSlot[];
	vaultAgents: VaultAgentSummary[];
	agentCreationContext: { roleId: string; agentName: string } | null;
}
