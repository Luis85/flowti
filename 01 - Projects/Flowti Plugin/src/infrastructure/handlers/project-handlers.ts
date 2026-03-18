/**
 * Project detail handler — bridges Lit component ↔ IProjectService.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IProjectService, StorybookFramework } from "../../domain/projects/types.js";

// Side-effect import: register the Lit custom element
import "../../components/projects/flowti-project-detail.js";

export interface ProjectHandlerDeps {
	readonly projectService: IProjectService;
	readonly projectName: string;
	readonly openNote?: (path: string) => void;
	readonly createNote?: (name: string) => void;
	readonly openInWebviewer?: (url: string) => void;
	readonly navigateBack?: () => void;
}

export function mountProjectDetail(container: HTMLElement, deps: ProjectHandlerDeps): () => void {
	const { projectService } = deps;
	const el = document.createElement("flowti-project-detail") as HTMLElement & Record<string, unknown>;
	let currentProject = deps.projectName;

	async function loadProjectList(): Promise<void> {
		const projects = await projectService.listProjects();
		el.projects = [...projects];
	}

	async function loadProject(name: string): Promise<void> {
		currentProject = name;
		const detail = await projectService.getProject(name);
		if (!detail) {
			el.projectName = name;
			el.projectType = "unknown";
			el.hasNote = false;
			el.notePath = "";
			el.storybook = { installed: false, framework: null, running: false, url: null, pid: null };
			return;
		}
		el.projectName = detail.name;
		el.projectType = detail.type;
		el.hasNote = detail.hasNote;
		el.notePath = detail.notePath ?? "";
		el.storybook = { ...detail.storybook };
	}

	// ── Project selected from list ──
	el.addEventListener("project-selected", ((e: CustomEvent) => {
		void loadProject(String(e.detail.name));
	}) as EventListener);

	// ── Back to list ──
	el.addEventListener("back-to-list", (() => {
		currentProject = "";
		el.projectName = "";
		void loadProjectList();
	}) as EventListener);

	// ── Note actions ──
	el.addEventListener("open-project-note", ((e: CustomEvent) => {
		deps.openNote?.(String(e.detail.path));
	}) as EventListener);

	el.addEventListener("create-project-note", ((e: CustomEvent) => {
		deps.createNote?.(String(e.detail.name));
		// Reload list after a brief delay to pick up the new note
		setTimeout(() => void loadProjectList(), 500);
	}) as EventListener);

	// ── Storybook actions ──
	el.addEventListener("storybook-install", ((e: CustomEvent) => {
		el.loading = true;
		void projectService.installStorybook(currentProject, String(e.detail.framework) as StorybookFramework)
			.then(() => loadProject(currentProject))
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-start", (() => {
		el.loading = true;
		void projectService.startStorybook(currentProject)
			.then((result) => {
				if (result.ok && result.url) {
					deps.openInWebviewer?.(result.url);
				}
				return loadProject(currentProject);
			})
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-stop", (() => {
		el.loading = true;
		void projectService.stopStorybook(currentProject)
			.then(() => loadProject(currentProject))
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-build", (() => {
		el.loading = true;
		void projectService.buildStorybook(currentProject)
			.then(() => loadProject(currentProject))
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-scaffold", (() => {
		el.loading = true;
		void projectService.scaffoldStorybook(currentProject)
			.then(() => loadProject(currentProject))
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-view", ((e: CustomEvent) => {
		const url = String(e.detail?.url ?? "http://localhost:6006");
		deps.openInWebviewer?.(url);
	}) as EventListener);

	container.appendChild(el);
	if (currentProject) {
		void loadProject(currentProject);
	} else {
		void loadProjectList();
	}

	return () => { el.remove(); };
}
