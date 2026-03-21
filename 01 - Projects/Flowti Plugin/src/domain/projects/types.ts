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
	createAgentFromRole(project: string, roleId: string, agentName: string, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
}

/** Minimal info for assigning existing agents to a role. */
export interface VaultAgentSummary {
	readonly name: string;
	readonly path: string;
}
