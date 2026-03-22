/**
 * Git import event handler — wires add-project, import-setup, wizard-configure,
 * wizard-open-project, import-cancel, and create-empty-project events for the
 * project detail element.
 *
 * Extracted from wireGitImportEvents in project-handler-events.ts.
 */

import type {
	IProjectService,
	ProjectDetailElement,
} from "../../domain/projects/types.js";

// ── Deps ──────────────────────────────────────────────────────────────────────

export interface GitImportHandlerDeps {
	readonly el: ProjectDetailElement;
	readonly signal: AbortSignal;
	readonly projectService: IProjectService;
	readonly getCurrentProject: () => string;
	readonly loadProject: (name: string) => Promise<void>;
	readonly loadProjectList: () => Promise<void>;
	readonly startProjectHubWork: (label: string) => void;
	readonly appendProjectHubLog: (line: string) => void;
	readonly endProjectHubWork: (result: { ok: boolean; error?: string }) => void;
	readonly createNote?: (name: string) => Promise<void>;
}

// ── Handler class ─────────────────────────────────────────────────────────────

export class ProjectGitHandler {
	private readonly deps: GitImportHandlerDeps;

	constructor(deps: GitImportHandlerDeps) {
		this.deps = deps;
		this.wireEvents();
	}

	dispose(): void {
		// No teardown needed — listeners are on the element which is removed by the caller.
	}

	private wireEvents(): void {
		const { el, signal } = this.deps;

		el.addEventListener("add-project", ((e: CustomEvent) => {
			const mode = String(e.detail?.mode);
			if (mode === "empty") { el.showNamePrompt = true; return; }
			el.gitModalMode = mode === "template" ? "template" : "submodule";
			el.gitImportStep = "form";
			el.gitImportError = "";
			el.gitImportOutputLines = [];
			el.gitImportDetected = null;
			el.showGitModal = true;
		}) as EventListener, { signal });

		el.addEventListener("import-setup", ((e: CustomEvent) => {
			const { url, name, mode } = e.detail as { url: string; name: string; mode: string };
			this.deps.startProjectHubWork("Cloning repository…");
			el.gitImportStep = "progress";
			el.gitImportError = "";

			const gitOutputLines: string[] = [];
			const gitAppend = (line: string): void => {
				gitOutputLines.push(line);
				if (gitOutputLines.length > 200) gitOutputLines.shift();
				if (signal.aborted) return;
				el.gitImportOutputLines = [...gitOutputLines];
			};

			void (async () => {
				try {
					const importResult = await this.deps.projectService.importFromGit(
						url, name, mode as "submodule" | "template", gitAppend,
					);
					if (signal.aborted) return;

					if (!importResult.ok) {
						el.projectHubBusy = false;
						el.projectHubBusyLabel = "";
						el.gitImportError = importResult.error ?? "Clone failed";
						return;
					}

					gitAppend("Detecting project...");
					const detectResult = await this.deps.projectService.detectProject(name);
					if (signal.aborted) return;

					if (!detectResult) return;

					el.projectHubBusy = false;
					el.projectHubBusyLabel = "";

					if (detectResult.ok !== false) {
						el.gitImportStep = "detect";
						el.gitImportDetected = {
							ok: detectResult.ok,
							type: detectResult.type,
							framework: detectResult.framework,
							packageManager: detectResult.packageManager,
							testFramework: detectResult.testFramework,
							hasConfig: detectResult.hasConfig,
							buildCommand: detectResult.buildCommand,
							testCommand: detectResult.testCommand,
							lintCommand: detectResult.lintCommand,
						};
					}
				} catch {
					if (signal.aborted) return;
					el.projectHubBusy = false;
					el.projectHubBusyLabel = "";
					el.gitImportError = "Clone failed unexpectedly";
				}
			})();
		}) as EventListener, { signal });

		el.addEventListener("wizard-configure", ((e: CustomEvent) => {
			const detail = e.detail as Record<string, string>;
			this.deps.startProjectHubWork("Writing config…");
			void this.deps.projectService.bootstrapProject(detail.name, {
				build: detail.buildCommand,
				test: detail.testCommand,
				lint: detail.lintCommand,
				storybook: detail.framework,
			}).then((r) => {
				if (signal.aborted) return;
				this.deps.endProjectHubWork(r);
				if (r.ok) el.gitImportStep = "done";
			});
		}) as EventListener, { signal });

		el.addEventListener("wizard-open-project", ((e: CustomEvent) => {
			if (signal.aborted) return;
			el.showGitModal = false;
			void this.deps.loadProject(String(e.detail?.name));
		}) as EventListener, { signal });

		el.addEventListener("import-cancel", (() => {
			if (signal.aborted) return;
			el.showGitModal = false;
		}) as EventListener, { signal });

		el.addEventListener("create-empty-project", ((e: CustomEvent) => {
			const name = String(e.detail?.name);
			this.deps.startProjectHubWork("Creating project…");
			this.deps.appendProjectHubLog("Creating project folder…");
			void this.deps.projectService.createEmptyProject(name, this.deps.appendProjectHubLog).then(async (r) => {
				if (signal.aborted) return;
				if (!r.ok) { this.deps.endProjectHubWork(r); return; }
				this.deps.appendProjectHubLog("Creating project brief…");
				await this.deps.createNote?.(name).catch(() => { /* brief creation is best-effort */ });
				if (signal.aborted) return;
				this.deps.appendProjectHubLog("Done.");
				this.deps.endProjectHubWork(r);
				void this.deps.loadProject(name);
			});
		}) as EventListener, { signal });
	}
}
