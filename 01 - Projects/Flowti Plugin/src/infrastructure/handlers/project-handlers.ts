/**
 * Project detail handler — bridges Lit component <-> IProjectService.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IProjectService } from "../../domain/projects/types.js";
import type { VaultFileAdapter } from "../vault-adapter.js";
import {
	wireStorybookEvents, wireScaffoldAndRegenerateEvents,
	wireGitImportEvents, wireConfigAndCatalogEvents,
	type ProjectEventContext,
} from "./project-handler-events.js";

// Side-effect import: register the Lit custom element
import "../../components/projects/flowti-project-detail.js";

export interface ProjectHandlerDeps {
	readonly projectService: IProjectService;
	readonly projectName: string;
	readonly openNote?: (path: string) => void;
	readonly createNote?: (name: string) => void;
	readonly openInWebviewer?: (url: string) => void;
	readonly navigateBack?: () => void;
	readonly pickFolder?: () => Promise<string | null>;
	readonly revealFolder?: (path: string) => void;
	readonly vaultAdapter?: VaultFileAdapter;
}

export function mountProjectDetail(container: HTMLElement, deps: ProjectHandlerDeps): () => void {
	const { projectService } = deps;
	const el = document.createElement("flowti-project-detail") as HTMLElement & Record<string, unknown>;
	let currentProject = deps.projectName;

	async function loadProjectList(): Promise<void> {
		const projects = await projectService.listProjects();
		el.projects = [...projects];
		el.cliConnected = true;
	}

	async function loadProject(name: string): Promise<void> {
		currentProject = name;
		outputLines.length = 0;
		el.storybookOutput = [];
		el.storybookError = "";
		el.actionSuccess = "";
		el.healthScore = null;
		el.healthError = "";
		el.todos = [];
		el.todosExist = false;
		el.components = [];
		el.reportGenerators = [];
		el.reportNodeStates = {};
		el.reportOutput = [];
		el.reportBusy = false;
		el.catalogEntities = [];
		const detail = await projectService.getProject(name);
		if (!detail) {
			el.projectName = name;
			el.projectType = "unknown";
			el.hasNote = false;
			el.notePath = "";
			el.storybook = { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false };
			return;
		}
		el.projectName = detail.name;
		el.projectType = detail.type;
		el.hasNote = detail.hasNote;
		el.notePath = detail.notePath ?? "";
		el.storybook = { ...detail.storybook };
		el.config = detail.config;
		el.hasSitemap = detail.hasSitemap;
		el.hasCanvas = detail.hasCanvas;
		el.canvasChanged = detail.canvasChanged;
		el.hasMarkdownSource = !!detail.config?.markdownSource;
		el.brief = detail.brief;

		void projectService.getHealth(name).then((r) => { if (r.ok && r.score) el.healthScore = r.score; });
		void projectService.getTodos(name).then((r) => { el.todos = r.items; el.todosExist = r.exists; });
		void projectService.listComponents(name).then((c) => { el.components = c; });
		void projectService.getReportGenerators(name).then((g) => { el.reportGenerators = g; });
		void projectService.listEntities(name, "domains").then((entities) => { el.catalogEntities = entities; });
	}

	// ── Core navigation events ──
	el.addEventListener("project-selected", ((e: CustomEvent) => { void loadProject(String(e.detail.name)); }) as EventListener);

	el.addEventListener("back-to-list", (() => {
		currentProject = "";
		el.projectName = "";
		outputLines.length = 0;
		el.storybookOutput = [];
		el.storybookError = "";
		el.actionSuccess = "";
		void loadProjectList();
	}) as EventListener);

	el.addEventListener("open-project-note", ((e: CustomEvent) => { deps.openNote?.(String(e.detail.path)); }) as EventListener);
	el.addEventListener("open-project-folder", ((e: CustomEvent) => { deps.revealFolder?.(`01 - Projects/${String(e.detail.name)}`); }) as EventListener);
	el.addEventListener("create-project-note", ((e: CustomEvent) => {
		deps.createNote?.(String(e.detail.name));
		setTimeout(() => { if (currentProject) void loadProject(currentProject); else void loadProjectList(); }, 500);
	}) as EventListener);

	const outputLines: string[] = [];
	let lastBusyLabel = "";

	function startBusy(label: string): void {
		outputLines.length = 0;
		lastBusyLabel = label;
		el.storybookBusy = true;
		el.storybookBusyLabel = label;
		el.storybookOutput = [];
		el.storybookError = "";
		el.actionSuccess = "";
	}

	function appendOutput(line: string): void {
		console.debug("[storybook]", line);
		outputLines.push(line);
		if (outputLines.length > 200) outputLines.shift();
		el.storybookOutput = [...outputLines];
	}

	function endBusy(result: { ok: boolean; error?: string }): void {
		el.storybookBusy = false;
		el.storybookBusyLabel = "";
		if (!result.ok && result.error) {
			el.storybookError = result.error;
			el.actionSuccess = "";
		} else {
			const msg = lastBusyLabel.replace(/\.{3}$/, "") + " completed";
			el.actionSuccess = msg;
			setTimeout(() => { if (el.actionSuccess === msg) el.actionSuccess = ""; }, 4000);
		}
		void loadProject(currentProject);
	}

	// ── Wire all event groups via extracted helpers ──
	const ctx: ProjectEventContext = {
		el, projectService,
		getCurrentProject: () => currentProject,
		loadProject, loadProjectList,
		startBusy, appendOutput, endBusy,
		openNote: deps.openNote,
		createNote: deps.createNote,
		openInWebviewer: deps.openInWebviewer,
		revealFolder: deps.revealFolder,
		pickFolder: deps.pickFolder,
	};

	wireStorybookEvents(ctx);
	wireScaffoldAndRegenerateEvents(ctx);
	wireGitImportEvents(ctx);
	wireConfigAndCatalogEvents(ctx);

	container.appendChild(el);
	if (currentProject) {
		void loadProject(currentProject);
	} else {
		void loadProjectList().then(() => { el.cliConnected = true; });
	}

	return () => { el.remove(); };
}
