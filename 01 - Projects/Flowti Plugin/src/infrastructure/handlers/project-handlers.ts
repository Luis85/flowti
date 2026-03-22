/**
 * Project detail handler — bridges Lit component <-> IProjectService.
 *
 * Separates **Storybook/Components-tab** busy state from **project hub** busy state (team roster, config, canvas, git, …).
 * Returns a dispose function for cleanup on view close.
 */

import type { IProjectService, ProjectDetailElement } from "../../domain/projects/types.js";
import type { VaultFileAdapter } from "../vault-adapter.js";
import { ProjectStorybookHandler } from "./project-storybook-handler.js";
import { ProjectGitHandler } from "./project-git-handler.js";
import { ConfigCatalogHandler } from "./project-config-handler.js";
import { TeamHandler } from "./project-team-handler.js";

// Side-effect import: register the Lit custom element
import "../../components/projects/flowti-project-detail.js";

export interface ProjectHandlerDeps {
	readonly projectService: IProjectService;
	readonly projectName: string;
	readonly openNote?: (path: string) => void;
	readonly createNote?: (name: string) => Promise<void>;
	readonly navigateBack?: () => void;
	readonly pickFolder?: () => Promise<string | null>;
	readonly revealFolder?: (path: string) => void;
	readonly vaultAdapter?: VaultFileAdapter;
}

export function mountProjectDetail(container: HTMLElement, deps: ProjectHandlerDeps): () => void {
	const { projectService } = deps;
	const controller = new AbortController();
	const { signal } = controller;
	const el = document.createElement("flowti-project-detail") as unknown as ProjectDetailElement;
	let currentProject = deps.projectName;

	async function loadProjectList(): Promise<void> {
		const projects = await projectService.listProjects();
		if (signal.aborted) return;
		el.projects = [...projects];
		el.cliConnected = true;
	}

	async function loadProject(name: string): Promise<void> {
		if (signal.aborted) return;
		currentProject = name;
		projectHubLines.length = 0;
		el.storybookOutput = [];
		el.storybookError = "";
		el.projectHubOutput = [];
		el.projectHubError = "";
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
		el.roleSlots = [];
		el.vaultAgents = [];
		const detail = await projectService.getProject(name);
		if (signal.aborted) return;
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
		el.roleSlots = [...(detail.config?.roleSlots ?? [])];

		void projectService.getHealth(name)
			.then((r) => { if (!signal.aborted && r.ok && r.score) el.healthScore = r.score; })
			.catch(() => { if (!signal.aborted) el.healthError = "Health check unavailable"; });
		void projectService.getTodos(name)
			.then((r) => { if (!signal.aborted) { el.todos = r.items; el.todosExist = r.exists; } })
			.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load TODOs"); });
		void projectService.listComponents(name)
			.then((c) => { if (!signal.aborted) el.components = c; })
			.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load components"); });
		void projectService.getReportGenerators(name)
			.then((g) => { if (!signal.aborted) el.reportGenerators = g; })
			.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load report generators"); });
		void projectService.listEntities(name, "domains")
			.then((entities) => { if (!signal.aborted) el.catalogEntities = entities; })
			.catch(() => { if (!signal.aborted) console.warn("[Flowti] Failed to load catalog entities"); });
		try {
			el.vaultAgents = [...await projectService.listVaultAgents()];
		} catch {
			if (!signal.aborted) el.vaultAgents = [];
		}
	}

	// ── Core navigation events ──
	el.addEventListener("project-selected", ((e: CustomEvent) => { void loadProject(String(e.detail.name)); }) as EventListener);

	el.addEventListener("back-to-list", (() => {
		currentProject = "";
		el.projectName = "";
		el.agentCreationContext = null;
		el.storybookBusy = false;
		el.storybookBusyLabel = "";
		el.storybookOutput = [];
		el.storybookError = "";
		el.projectHubBusy = false;
		el.projectHubBusyLabel = "";
		el.projectHubOutput = [];
		el.projectHubError = "";
		el.actionSuccess = "";
		el.gitImportStep = "form";
		el.gitImportError = "";
		el.gitImportOutputLines = [];
		el.gitImportDetected = null;
		el.configSaveStatus = "";
		el.configSourcePath = "";
		void loadProjectList().catch(() => {
			if (!signal.aborted) el.projectHubError = "Failed to load project list";
		});
	}) as EventListener);

	el.addEventListener("open-project-note", ((e: CustomEvent) => { deps.openNote?.(String(e.detail.path)); }) as EventListener);
	el.addEventListener("open-project-folder", ((e: CustomEvent) => { deps.revealFolder?.(`01 - Projects/${String(e.detail.name)}`); }) as EventListener);
	el.addEventListener("create-project-note", ((e: CustomEvent) => {
		const name = String(e.detail.name);
		void (async () => {
			await deps.createNote?.(name).catch(() => { /* timeout — proceed anyway */ });
			if (signal.aborted) return;
			if (currentProject) await loadProject(currentProject);
			else await loadProjectList();
		})();
	}) as EventListener);

	// ── Shared project-hub work-queue helpers (used by Git, Config, Team handlers) ──
	const projectHubLines: string[] = [];
	let lastProjectHubLabel = "";

	/** Success toast for project-hub operations (global activity bar). */
	function projectHubSuccessMessage(label: string): string {
		const t = label.trim();
		if (/team roster/i.test(t)) return "Team roster saved.";
		if (/creating agent/i.test(t)) return "Agent created; roster updated.";
		if (/saving markdown source config/i.test(t)) return "Markdown source config saved.";
		if (/merging canvas/i.test(t)) return "Canvas merged into sitemap.";
		if (/generating sitemap canvas/i.test(t)) return "Sitemap canvas generated.";
		if (/creating project/i.test(t)) return "Project created.";
		if (/writing config/i.test(t)) return "Project config written.";
		if (/cloning repository/i.test(t)) return "Repository cloned.";
		const stripped = t.replace(/\.{3}\s*$/u, "").replace(/…\s*$/u, "").trim();
		return stripped.length > 0 ? `${stripped} — finished` : "Done.";
	}

	function startProjectHubWork(label: string): void {
		if (signal.aborted) return;
		projectHubLines.length = 0;
		lastProjectHubLabel = label;
		el.projectHubBusy = true;
		el.projectHubBusyLabel = label;
		el.projectHubOutput = [];
		el.projectHubError = "";
		el.actionSuccess = "";
		el.statusMessage = "";
	}

	function appendProjectHubLog(line: string): void {
		if (signal.aborted) return;
		console.debug("[Flowti:Project]", line);
		projectHubLines.push(line);
		if (projectHubLines.length > 200) projectHubLines.shift();
		el.projectHubOutput = [...projectHubLines];
	}

	function endProjectHubWork(result: { ok: boolean; error?: string }): void {
		if (signal.aborted) return;
		el.projectHubBusy = false;
		el.projectHubBusyLabel = "";
		if (!result.ok && result.error) {
			el.projectHubError = result.error;
			el.actionSuccess = "";
		} else {
			const msg = projectHubSuccessMessage(lastProjectHubLabel);
			el.actionSuccess = msg;
			setTimeout(() => { if (!signal.aborted && el.actionSuccess === msg) el.actionSuccess = ""; }, 4000);
		}
		void loadProject(currentProject);
	}

	// ── Instantiate four handler classes ──
	const storybook = new ProjectStorybookHandler({
		el, signal, projectService,
		getCurrentProject: () => currentProject,
		loadProject,
		revealFolder: deps.revealFolder,
		pickFolder: deps.pickFolder,
	});

	const git = new ProjectGitHandler({
		el, signal, projectService,
		getCurrentProject: () => currentProject,
		loadProject, loadProjectList,
		startProjectHubWork, appendProjectHubLog, endProjectHubWork,
		createNote: deps.createNote,
	});

	const config = new ConfigCatalogHandler({
		el, signal, projectService,
		getCurrentProject: () => currentProject,
		startProjectHubWork, appendProjectHubLog, endProjectHubWork,
		openNote: deps.openNote,
		pickFolder: deps.pickFolder,
	});

	const team = new TeamHandler({
		el, signal, projectService,
		getCurrentProject: () => currentProject,
		startProjectHubWork, appendProjectHubLog, endProjectHubWork,
	});

	container.appendChild(el);
	if (currentProject) {
		void loadProject(currentProject);
	} else {
		void loadProjectList().catch(() => {
			if (!signal.aborted) el.projectHubError = "Failed to load project list";
		});
	}

	return () => {
		controller.abort();
		storybook.dispose();
		git.dispose();
		config.dispose();
		team.dispose();
		el.remove();
	};
}
