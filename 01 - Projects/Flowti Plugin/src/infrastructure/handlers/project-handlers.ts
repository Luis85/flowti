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

	async function loadProject(): Promise<void> {
		const detail = await projectService.getProject(deps.projectName);
		if (!detail) {
			el.projectName = deps.projectName;
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

	// ── Back to list ──
	el.addEventListener("back-to-list", (() => {
		deps.navigateBack?.();
	}) as EventListener);

	// ── Note actions ──
	el.addEventListener("open-project-note", ((e: CustomEvent) => {
		deps.openNote?.(String(e.detail.path));
	}) as EventListener);

	el.addEventListener("create-project-note", ((e: CustomEvent) => {
		deps.createNote?.(String(e.detail.name));
	}) as EventListener);

	// ── Storybook actions ──
	el.addEventListener("storybook-install", ((e: CustomEvent) => {
		el.loading = true;
		void projectService.installStorybook(deps.projectName, String(e.detail.framework) as StorybookFramework)
			.then(() => loadProject())
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-start", (() => {
		el.loading = true;
		void projectService.startStorybook(deps.projectName)
			.then((result) => {
				if (result.ok && result.url) {
					deps.openInWebviewer?.(result.url);
				}
				return loadProject();
			})
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-stop", (() => {
		el.loading = true;
		void projectService.stopStorybook(deps.projectName)
			.then(() => loadProject())
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-build", (() => {
		el.loading = true;
		void projectService.buildStorybook(deps.projectName)
			.then(() => loadProject())
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-scaffold", (() => {
		el.loading = true;
		void projectService.scaffoldStorybook(deps.projectName)
			.then(() => loadProject())
			.finally(() => { el.loading = false; });
	}) as EventListener);

	el.addEventListener("storybook-view", ((e: CustomEvent) => {
		const url = String(e.detail?.url ?? "http://localhost:6006");
		deps.openInWebviewer?.(url);
	}) as EventListener);

	container.appendChild(el);
	void loadProject();

	return () => { el.remove(); };
}
