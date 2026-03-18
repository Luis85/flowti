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
		// Reload current view after a brief delay to pick up the new note
		setTimeout(() => {
			if (currentProject) {
				void loadProject(currentProject);
			} else {
				void loadProjectList();
			}
		}, 500);
	}) as EventListener);

	const outputLines: string[] = [];

	function startBusy(label: string): void {
		outputLines.length = 0;
		el.storybookBusy = true;
		el.storybookBusyLabel = label;
		el.storybookOutput = [];
		el.storybookError = "";
	}

	function appendOutput(line: string): void {
		// Always log to console for debugging
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
		}
		void loadProject(currentProject);
	}

	// ── Storybook actions ──
	el.addEventListener("storybook-install", ((e: CustomEvent) => {
		startBusy("Installing Storybook...");
		void projectService.installStorybook(currentProject, String(e.detail.framework) as StorybookFramework, appendOutput)
			.then((r) => endBusy(r));
	}) as EventListener);

	el.addEventListener("storybook-start", (() => {
		startBusy("Starting Storybook...");
		let resolved = false;
		let detectedUrl = "http://localhost:6006";

		// Watch output lines for storybook's ready signal or errors
		const originalAppend = appendOutput;
		const watchingAppend = (line: string) => {
			originalAppend(line);
			if (resolved) return;

			// Storybook prints "Local: http://localhost:XXXX" when ready
			const urlMatch = line.match(/Local:\s*(https?:\/\/localhost:\d+)/i);
			if (urlMatch) {
				detectedUrl = urlMatch[1];
			}

			// Storybook v10 prints "ready" or the local URL when done
			const lower = line.toLowerCase();
			if (lower.includes("storybook") && (lower.includes("ready") || lower.includes("started"))) {
				resolved = true;
				originalAppend(`\nStorybook ready at ${detectedUrl}`);
				el.storybookBusy = false;
				el.storybookBusyLabel = "";
				deps.openInWebviewer?.(detectedUrl);
				void loadProject(currentProject);
			}
		};

		void projectService.startStorybook(currentProject, watchingAppend)
			.then(async (result) => {
				if (!result.ok) { endBusy(result); return; }

				// Poll for process death (output will show errors)
				const deadline = Date.now() + 90000;
				while (!resolved && Date.now() < deadline) {
					await new Promise((r) => setTimeout(r, 3000));
					if (resolved) return;
					const detail = await projectService.getProject(currentProject);
					if (detail && !detail.storybook.running) {
						resolved = true;
						el.storybookBusy = false;
						el.storybookBusyLabel = "";
						el.storybookError = "Storybook process exited. See output log for details.";
						void loadProject(currentProject);
						return;
					}
				}
				if (!resolved) {
					resolved = true;
					originalAppend("Timeout (90s) — Storybook may still be starting.");
					el.storybookBusy = false;
					void loadProject(currentProject);
				}
			});
	}) as EventListener);

	el.addEventListener("storybook-stop", (() => {
		void projectService.stopStorybook(currentProject)
			.then((r) => { endBusy(r); });
	}) as EventListener);

	el.addEventListener("storybook-build", (() => {
		startBusy("Building Storybook...");
		void projectService.buildStorybook(currentProject, appendOutput)
			.then((r) => endBusy(r));
	}) as EventListener);

	el.addEventListener("storybook-scaffold", (() => {
		startBusy("Scaffolding from sitemap...");
		void projectService.scaffoldStorybook(currentProject, appendOutput)
			.then((r) => endBusy(r));
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
