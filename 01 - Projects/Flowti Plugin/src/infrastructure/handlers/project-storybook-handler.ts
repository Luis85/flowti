/**
 * Storybook + scaffold event wiring — extracted from project-handler-events.ts.
 *
 * Handles all Components/Storybook-tab events and scaffold/regenerate flows.
 * Uses a deps-injection pattern so it is fully testable without a real DOM.
 */

import type { IProjectService, StorybookFramework, ProjectDetailElement } from "../../domain/projects/types.js";

export interface StorybookHandlerDeps {
	readonly el: ProjectDetailElement;
	readonly signal: AbortSignal;
	readonly projectService: IProjectService;
	readonly getCurrentProject: () => string;
	readonly loadProject: (name: string) => Promise<void>;
	readonly revealFolder?: (path: string) => void;
	readonly pickFolder?: () => Promise<string | null>;
}

export class ProjectStorybookHandler {
	private readonly deps: StorybookHandlerDeps;
	private storybookLines: string[] = [];

	constructor(deps: StorybookHandlerDeps) {
		this.deps = deps;
	}

	dispose(): void {
		// AbortController handles cancellation; no per-listener cleanup needed
	}

	// ── Internal helpers ──────────────────────────────────────────────────────

	private startWork(label: string): void {
		this.storybookLines = [];
		this.deps.el.storybookBusy = true;
		this.deps.el.storybookBusyLabel = label;
		this.deps.el.storybookOutput = [];
		this.deps.el.storybookError = "";
	}

	private appendLog(line: string): void {
		console.debug("[Flowti:Components/Storybook]", line);
		this.storybookLines.push(line);
		if (this.storybookLines.length > 200) this.storybookLines.shift();
		this.deps.el.storybookOutput = [...this.storybookLines];
	}

	private endWork(result: { ok: boolean; error?: string }): void {
		this.deps.el.storybookBusy = false;
		this.deps.el.storybookBusyLabel = "";
		if (!result.ok && result.error) this.deps.el.storybookError = result.error;
		void this.deps.loadProject(this.deps.getCurrentProject());
	}

	private clearLogBuffer(): void {
		this.storybookLines = [];
		this.deps.el.storybookOutput = [];
	}

	// ── Event registration ────────────────────────────────────────────────────

	/**
	 * Register all storybook and scaffold event listeners on `deps.el`.
	 * Listeners respect `deps.signal` — they no-op when aborted.
	 */
	register(): void {
		this.wireStorybookEvents();
		this.wireScaffoldAndRegenerateEvents();
	}

	private wireStorybookEvents(): void {
		const { el, projectService, signal } = this.deps;

		el.addEventListener("storybook-install", ((e: CustomEvent) => {
			if (signal.aborted) return;
			this.startWork("Installing Storybook…");
			void projectService.installStorybook(this.deps.getCurrentProject(), String(e.detail.framework) as StorybookFramework, this.appendLog.bind(this))
				.then((r) => { this.endWork(r); if (r.ok) el.showScaffoldModal = true; })
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					this.appendLog(`Error: ${msg}`);
					this.endWork({ ok: false, error: msg });
				});
		}) as EventListener);

		el.addEventListener("storybook-start", (() => {
			if (signal.aborted) return;
			this.startWork("Starting Storybook…");
			let resolved = false;
			let detectedUrl = "http://localhost:6006";

			const resolveStorybook = (cb: () => void): void => {
				if (resolved) return;
				resolved = true;
				cb();
			};

			const watchingAppend = (line: string): void => {
				this.appendLog(line);
				if (resolved) return;
				const urlMatch = line.match(/Local:\s*(https?:\/\/localhost:\d+)/i);
				if (urlMatch) detectedUrl = urlMatch[1];
				const lower = line.toLowerCase();
				if (lower.includes("storybook") && (lower.includes("ready") || lower.includes("started"))) {
					resolveStorybook(() => {
						this.appendLog(`\nStorybook ready at ${detectedUrl}`);
						el.storybookBusy = false;
						el.storybookBusyLabel = "";
						void projectService.openStorybookUrl(this.deps.getCurrentProject(), detectedUrl, this.appendLog.bind(this));
						void this.deps.loadProject(this.deps.getCurrentProject());
					});
				}
			};

			void projectService.startStorybook(this.deps.getCurrentProject(), watchingAppend)
				.then(async (result) => {
					if (!result.ok) { this.endWork(result); return; }
					const deadline = Date.now() + 90000;
					while (!resolved && Date.now() < deadline) {
						await new Promise<void>((r) => setTimeout(r, 3000));
						if (signal.aborted) return;
						if (resolved) return;
						const detail = await projectService.getProject(this.deps.getCurrentProject());
						if (detail && !detail.storybook.running) {
							resolveStorybook(() => {
								el.storybookBusy = false;
								el.storybookBusyLabel = "";
								queueMicrotask(() => {
									el.storybookError = "Storybook process exited. See output log for details.";
								});
								void this.deps.loadProject(this.deps.getCurrentProject());
							});
							return;
						}
					}
					if (!resolved) {
						resolveStorybook(() => {
							this.appendLog("Timeout (90s) — Storybook may still be starting.");
							el.storybookBusy = false;
							void this.deps.loadProject(this.deps.getCurrentProject());
						});
					}
				})
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					this.appendLog(`Error: ${msg}`);
					this.endWork({ ok: false, error: msg });
				});
		}) as EventListener);

		el.addEventListener("storybook-stop", (() => {
			if (signal.aborted) return;
			void projectService.stopStorybook(this.deps.getCurrentProject())
				.then((r) => this.endWork(r))
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					this.endWork({ ok: false, error: msg });
				});
		}) as EventListener);

		el.addEventListener("storybook-build", (() => {
			if (signal.aborted) return;
			this.startWork("Building Storybook…");
			void projectService.buildStorybook(this.deps.getCurrentProject(), this.appendLog.bind(this))
				.then((r) => this.endWork(r))
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					this.appendLog(`Error: ${msg}`);
					this.endWork({ ok: false, error: msg });
				});
		}) as EventListener);

		el.addEventListener("storybook-import", (() => {
			if (signal.aborted) return;
			const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
			if (savedPath) {
				this.startWork("Importing markdown to sitemap…");
				void projectService.importMarkdownSitemap(this.deps.getCurrentProject(), savedPath, this.appendLog.bind(this))
					.then((r) => this.endWork(r))
					.catch((err: unknown) => {
						const msg = err instanceof Error ? err.message : String(err);
						this.appendLog(`Error: ${msg}`);
						this.endWork({ ok: false, error: msg });
					});
				return;
			}
			if (!this.deps.pickFolder) return;
			void this.deps.pickFolder().then((folder) => {
				if (folder === null) return;
				this.startWork("Importing markdown to sitemap…");
				void projectService.importMarkdownSitemap(this.deps.getCurrentProject(), folder, this.appendLog.bind(this))
					.then((r) => this.endWork(r))
					.catch((err: unknown) => {
						const msg = err instanceof Error ? err.message : String(err);
						this.appendLog(`Error: ${msg}`);
						this.endWork({ ok: false, error: msg });
					});
			});
		}) as EventListener);

		el.addEventListener("storybook-view", ((e: CustomEvent) => {
			if (signal.aborted) return;
			const url = String(e.detail?.url ?? "http://localhost:6006");
			void projectService.openStorybookUrl(this.deps.getCurrentProject(), url, this.appendLog.bind(this));
		}) as EventListener);

		el.addEventListener("storybook-open-folder", (() => {
			if (signal.aborted) return;
			const config = (el.config as { storybookDir?: string } | undefined);
			this.deps.revealFolder?.(`01 - Projects/${this.deps.getCurrentProject()}/${config?.storybookDir ?? "components"}`);
		}) as EventListener);

		el.addEventListener("storybook-preview", (() => {
			if (signal.aborted) return;
			void projectService.previewStorybook(this.deps.getCurrentProject()).then((r) => {
				if (r.ok && r.url) void projectService.openStorybookUrl(this.deps.getCurrentProject(), r.url, this.appendLog.bind(this));
				else if (r.error) el.storybookError = r.error;
			});
		}) as EventListener);

		el.addEventListener("storybook-dismiss-output", (() => {
			if (signal.aborted) return;
			el.storybookOutput = [];
			this.clearLogBuffer();
		}) as EventListener);

		el.addEventListener("storybook-dismiss-error", (() => {
			if (signal.aborted) return;
			el.storybookError = "";
		}) as EventListener);

		el.addEventListener("storybook-canvas-import", (() => {
			if (signal.aborted) return;
			this.startWork("Importing from canvas…");
			void projectService.importCanvasSitemap(this.deps.getCurrentProject(), this.appendLog.bind(this))
				.then((r) => {
					this.endWork(r);
					void projectService.listComponents(this.deps.getCurrentProject()).then((c) => { el.components = c; });
				})
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					this.appendLog(`Error: ${msg}`);
					this.endWork({ ok: false, error: msg });
				});
		}) as EventListener);

		el.addEventListener("components-refresh", (() => {
			if (signal.aborted) return;
			void projectService.listComponents(this.deps.getCurrentProject()).then((c) => { el.components = c; });
		}) as EventListener);
	}

	private wireScaffoldAndRegenerateEvents(): void {
		const { el, projectService, signal } = this.deps;

		el.addEventListener("scaffold-confirm", ((e: CustomEvent) => {
			if (signal.aborted) return;
			el.showScaffoldModal = false;
			const canvasImport = e.detail?.canvasImport === true;
			if (canvasImport) {
				this.startWork("Importing canvas sitemap…");
				void projectService.importCanvasSitemap(this.deps.getCurrentProject(), this.appendLog.bind(this)).then((importResult) => {
					if (!importResult.ok) { this.endWork(importResult); return; }
					this.appendLog("Scaffolding components…");
					void projectService.scaffoldStorybook(this.deps.getCurrentProject(), this.appendLog.bind(this), { adoptImport: true }).then((scaffoldResult) => {
						if (!scaffoldResult.ok) { this.endWork(scaffoldResult); return; }
						this.endWork(scaffoldResult);
						el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
					});
				});
				return;
			}
			const importFirst = e.detail?.importFirst === true;
			if (importFirst) {
				const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
				if (!savedPath) return;
				this.startWork("Importing markdown…");
				void projectService.importMarkdownSitemap(this.deps.getCurrentProject(), savedPath, this.appendLog.bind(this)).then((importResult) => {
					if (!importResult.ok) { this.endWork(importResult); return; }
					this.appendLog("Scaffolding components…");
					void projectService.scaffoldStorybook(this.deps.getCurrentProject(), this.appendLog.bind(this), { adoptImport: true }).then((scaffoldResult) => {
						if (!scaffoldResult.ok) { this.endWork(scaffoldResult); return; }
						this.endWork(scaffoldResult);
						el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
					});
				});
			} else {
				this.startWork("Scaffolding components…");
				void projectService.scaffoldStorybook(this.deps.getCurrentProject(), this.appendLog.bind(this), { adoptImport: true }).then((r) => {
					if (!r.ok) { this.endWork(r); return; }
					this.endWork(r);
					el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
				});
			}
		}) as EventListener);

		el.addEventListener("scaffold-dismiss", (() => {
			if (signal.aborted) return;
			el.showScaffoldModal = false;
		}) as EventListener);

		el.addEventListener("storybook-regenerate-confirmed", (() => {
			if (signal.aborted) return;
			const framework = (el.storybook as { framework?: string })?.framework ?? "html";
			this.startWork("Regenerating component library…");
			void projectService.cleanStorybook(this.deps.getCurrentProject()).then((cleanResult) => {
				if (!cleanResult.ok) { this.endWork(cleanResult); return; }
				this.appendLog("Re-installing Storybook…");
				return projectService.installStorybook(this.deps.getCurrentProject(), framework as StorybookFramework, this.appendLog.bind(this));
			}).then((installResult) => {
				if (!installResult || !installResult.ok) { this.endWork(installResult ?? { ok: false }); return; }
				this.appendLog("Scaffolding components…");
				return projectService.scaffoldStorybook(this.deps.getCurrentProject(), this.appendLog.bind(this), { adoptImport: true });
			}).then((scaffoldResult) => {
				if (!scaffoldResult || !scaffoldResult.ok) { this.endWork(scaffoldResult ?? { ok: false }); return; }
				this.endWork(scaffoldResult);
				el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
			}).catch(() => { this.endWork({ ok: false, error: "Regeneration failed unexpectedly" }); });
		}) as EventListener);
	}
}
