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
	readonly agents?: readonly string[];
	readonly publishTargets?: readonly string[];
	readonly markdownSource?: MarkdownSourceConfig;
}

export type OutputCallback = (line: string) => void;

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
	createEmptyProject(name: string): Promise<{ ok: boolean; error?: string }>;
}
