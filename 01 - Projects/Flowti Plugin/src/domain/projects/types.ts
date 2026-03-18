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
}

export interface ProjectSummary {
	readonly name: string;
	readonly type: string;
	readonly hasNote: boolean;
	readonly storybook: StorybookStatus;
}

export interface ProjectDetail extends ProjectSummary {
	readonly notePath: string | null;
	readonly projectPath: string;
}

export type StorybookFramework = "html-vite" | "react" | "vue" | "angular";

export type OutputCallback = (line: string) => void;

export interface IProjectService {
	listProjects(): Promise<ProjectSummary[]>;
	getProject(name: string): Promise<ProjectDetail | undefined>;
	installStorybook(project: string, framework: StorybookFramework, onOutput?: OutputCallback): Promise<{ ok: boolean; error?: string }>;
	startStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; url?: string; pid?: number; error?: string }>;
	stopStorybook(project: string): Promise<{ ok: boolean; error?: string }>;
	buildStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; outputDir?: string; error?: string }>;
	scaffoldStorybook(project: string, onOutput?: OutputCallback): Promise<{ ok: boolean; filesCreated?: number; error?: string }>;
}
