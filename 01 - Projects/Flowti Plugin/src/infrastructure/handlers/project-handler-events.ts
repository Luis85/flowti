/**
 * Project detail handler event wiring — Components/Storybook tools, Git import, config/catalog, team roster.
 *
 * Storybook-related handlers use {@link ProjectEventContext.startStorybookWork}; project-wide CLI uses
 * {@link ProjectEventContext.startProjectHubWork}. Extracted from project-handlers.ts to stay under max-lines.
 */

import type { IProjectService, StorybookFramework, MarkdownSourceConfig, CatalogEntityType, CatalogEntityDef, TeamRoleSlot } from "../../domain/projects/types.js";

export interface ProjectEventContext {
	el: HTMLElement & Record<string, unknown>;
	projectService: IProjectService;
	getCurrentProject: () => string;
	loadProject: (name: string) => Promise<void>;
	loadProjectList: () => Promise<void>;
	/** Storybook / Components-tab CLI work only (install, scaffold, import MD, etc.). */
	startStorybookWork: (label: string) => void;
	appendStorybookLog: (line: string) => void;
	endStorybookWork: (result: { ok: boolean; error?: string }) => void;
	/** Clears both the in-memory line buffer and `el.storybookOutput` (dismiss / Clear UI). */
	clearStorybookLogBuffer: () => void;
	/** Project-wide operations: team roster, config, canvas, git wizard, empty project, … */
	startProjectHubWork: (label: string) => void;
	appendProjectHubLog: (line: string) => void;
	endProjectHubWork: (result: { ok: boolean; error?: string }) => void;
	openNote?: (path: string) => void;
	createNote?: (name: string) => void;
	openInWebviewer?: (url: string) => void;
	revealFolder?: (path: string) => void;
	pickFolder?: () => Promise<string | null>;
}

export function wireStorybookEvents(ctx: ProjectEventContext): void {
	const { el, projectService } = ctx;

	el.addEventListener("storybook-install", ((e: CustomEvent) => {
		ctx.startStorybookWork("Installing Storybook…");
		void projectService.installStorybook(ctx.getCurrentProject(), String(e.detail.framework) as StorybookFramework, ctx.appendStorybookLog)
			.then((r) => { ctx.endStorybookWork(r); if (r.ok) el.showScaffoldModal = true; })
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.appendStorybookLog(`Error: ${msg}`);
				ctx.endStorybookWork({ ok: false, error: msg });
			});
	}) as EventListener);

	el.addEventListener("storybook-start", (() => {
		ctx.startStorybookWork("Starting Storybook…");
		let resolved = false;
		let detectedUrl = "http://localhost:6006";
		const originalAppend = ctx.appendStorybookLog;
		const watchingAppend = (line: string) => {
			originalAppend(line);
			if (resolved) return;
			const urlMatch = line.match(/Local:\s*(https?:\/\/localhost:\d+)/i);
			if (urlMatch) detectedUrl = urlMatch[1];
			const lower = line.toLowerCase();
			if (lower.includes("storybook") && (lower.includes("ready") || lower.includes("started"))) {
				resolved = true;
				originalAppend(`\nStorybook ready at ${detectedUrl}`);
				el.storybookBusy = false;
				el.storybookBusyLabel = "";
				ctx.openInWebviewer?.(detectedUrl);
				void ctx.loadProject(ctx.getCurrentProject());
			}
		};
		void projectService.startStorybook(ctx.getCurrentProject(), watchingAppend)
			.then(async (result) => {
				if (!result.ok) { ctx.endStorybookWork(result); return; }
				const deadline = Date.now() + 90000;
				while (!resolved && Date.now() < deadline) {
					await new Promise((r) => setTimeout(r, 3000));
					if (resolved) return;
					const detail = await projectService.getProject(ctx.getCurrentProject());
					if (detail && !detail.storybook.running) {
						resolved = true;
						el.storybookBusy = false; el.storybookBusyLabel = "";
						el.storybookError = "Storybook process exited. See output log for details.";
						void ctx.loadProject(ctx.getCurrentProject());
						return;
					}
				}
				if (!resolved) {
					resolved = true;
					originalAppend("Timeout (90s) — Storybook may still be starting.");
					el.storybookBusy = false;
					void ctx.loadProject(ctx.getCurrentProject());
				}
			})
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.appendStorybookLog(`Error: ${msg}`);
				ctx.endStorybookWork({ ok: false, error: msg });
			});
	}) as EventListener);

	el.addEventListener("storybook-stop", (() => {
		void projectService.stopStorybook(ctx.getCurrentProject())
			.then((r) => ctx.endStorybookWork(r))
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.endStorybookWork({ ok: false, error: msg });
			});
	}) as EventListener);

	el.addEventListener("storybook-build", (() => {
		ctx.startStorybookWork("Building Storybook…");
		void projectService.buildStorybook(ctx.getCurrentProject(), ctx.appendStorybookLog)
			.then((r) => ctx.endStorybookWork(r))
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.appendStorybookLog(`Error: ${msg}`);
				ctx.endStorybookWork({ ok: false, error: msg });
			});
	}) as EventListener);

	el.addEventListener("storybook-import", (() => {
		const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
		if (savedPath) {
			ctx.startStorybookWork("Importing markdown to sitemap…");
			void projectService.importMarkdownSitemap(ctx.getCurrentProject(), savedPath, ctx.appendStorybookLog)
				.then((r) => ctx.endStorybookWork(r))
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					ctx.appendStorybookLog(`Error: ${msg}`);
					ctx.endStorybookWork({ ok: false, error: msg });
				});
			return;
		}
		if (!ctx.pickFolder) return;
		void ctx.pickFolder().then((folder) => {
			if (folder === null) return;
			ctx.startStorybookWork("Importing markdown to sitemap…");
			void projectService.importMarkdownSitemap(ctx.getCurrentProject(), folder, ctx.appendStorybookLog)
				.then((r) => ctx.endStorybookWork(r))
				.catch((err: unknown) => {
					const msg = err instanceof Error ? err.message : String(err);
					ctx.appendStorybookLog(`Error: ${msg}`);
					ctx.endStorybookWork({ ok: false, error: msg });
				});
		});
	}) as EventListener);

	el.addEventListener("storybook-view", ((e: CustomEvent) => {
		ctx.openInWebviewer?.(String(e.detail?.url ?? "http://localhost:6006"));
	}) as EventListener);

	el.addEventListener("storybook-open-folder", (() => {
		const config = (el.config as { storybookDir?: string } | undefined);
		ctx.revealFolder?.(`01 - Projects/${ctx.getCurrentProject()}/${config?.storybookDir ?? "components"}`);
	}) as EventListener);

	el.addEventListener("storybook-preview", (() => {
		void projectService.previewStorybook(ctx.getCurrentProject()).then((r) => {
			if (r.ok && r.url) ctx.openInWebviewer?.(r.url);
			else if (r.error) el.storybookError = r.error;
		});
	}) as EventListener);

	el.addEventListener("storybook-dismiss-output", (() => {
		el.storybookOutput = [];
	}) as EventListener);

	el.addEventListener("storybook-dismiss-error", (() => {
		el.storybookError = "";
	}) as EventListener);

	el.addEventListener("storybook-canvas-import", (() => {
		ctx.startStorybookWork("Importing from canvas…");
		void projectService.importCanvasSitemap(ctx.getCurrentProject(), ctx.appendStorybookLog)
			.then((r) => {
				ctx.endStorybookWork(r);
				void projectService.listComponents(ctx.getCurrentProject()).then((c) => { el.components = c; });
			})
			.catch((err: unknown) => {
				const msg = err instanceof Error ? err.message : String(err);
				ctx.appendStorybookLog(`Error: ${msg}`);
				ctx.endStorybookWork({ ok: false, error: msg });
			});
	}) as EventListener);

	el.addEventListener("components-refresh", (() => {
		void projectService.listComponents(ctx.getCurrentProject()).then((c) => { el.components = c; });
	}) as EventListener);
}

export function wireScaffoldAndRegenerateEvents(ctx: ProjectEventContext): void {
	const { el, projectService } = ctx;

	el.addEventListener("scaffold-confirm", ((e: CustomEvent) => {
		el.showScaffoldModal = false;
		const canvasImport = e.detail?.canvasImport === true;
		if (canvasImport) {
			ctx.startStorybookWork("Importing canvas sitemap…");
			void projectService.importCanvasSitemap(ctx.getCurrentProject(), ctx.appendStorybookLog).then((importResult) => {
				if (!importResult.ok) { ctx.endStorybookWork(importResult); return; }
				ctx.appendStorybookLog("Scaffolding components…");
				void projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendStorybookLog, { adoptImport: true }).then((scaffoldResult) => {
					if (!scaffoldResult.ok) { ctx.endStorybookWork(scaffoldResult); return; }
					ctx.endStorybookWork(scaffoldResult);
					el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
				});
			});
			return;
		}
		const importFirst = e.detail?.importFirst === true;
		if (importFirst) {
			const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
			if (!savedPath) return;
			ctx.startStorybookWork("Importing markdown…");
			void projectService.importMarkdownSitemap(ctx.getCurrentProject(), savedPath, ctx.appendStorybookLog).then((importResult) => {
				if (!importResult.ok) { ctx.endStorybookWork(importResult); return; }
				ctx.appendStorybookLog("Scaffolding components…");
				void projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendStorybookLog, { adoptImport: true }).then((scaffoldResult) => {
					if (!scaffoldResult.ok) { ctx.endStorybookWork(scaffoldResult); return; }
					ctx.endStorybookWork(scaffoldResult);
					el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
				});
			});
		} else {
			ctx.startStorybookWork("Scaffolding components…");
			void projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendStorybookLog, { adoptImport: true }).then((r) => {
				if (!r.ok) { ctx.endStorybookWork(r); return; }
				ctx.endStorybookWork(r);
				el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
			});
		}
	}) as EventListener);

	el.addEventListener("scaffold-dismiss", (() => { el.showScaffoldModal = false; }) as EventListener);

	el.addEventListener("storybook-regenerate-confirmed", (() => {
		const framework = (el.storybook as { framework?: string })?.framework ?? "html";
		ctx.startStorybookWork("Regenerating component library…");
		void projectService.cleanStorybook(ctx.getCurrentProject()).then((cleanResult) => {
			if (!cleanResult.ok) { ctx.endStorybookWork(cleanResult); return; }
			ctx.appendStorybookLog("Re-installing Storybook…");
			return projectService.installStorybook(ctx.getCurrentProject(), framework as StorybookFramework, ctx.appendStorybookLog);
		}).then((installResult) => {
			if (!installResult || !installResult.ok) { ctx.endStorybookWork(installResult ?? { ok: false }); return; }
			ctx.appendStorybookLog("Scaffolding components…");
			return projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendStorybookLog, { adoptImport: true });
		}).then((scaffoldResult) => {
			if (!scaffoldResult || !scaffoldResult.ok) { ctx.endStorybookWork(scaffoldResult ?? { ok: false }); return; }
			ctx.endStorybookWork(scaffoldResult);
			el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
		}).catch(() => { ctx.endStorybookWork({ ok: false, error: "Regeneration failed unexpectedly" }); });
	}) as EventListener);
}

export function wireGitImportEvents(ctx: ProjectEventContext): void {
	const { el, projectService } = ctx;

	el.addEventListener("add-project", ((e: CustomEvent) => {
		const mode = String(e.detail?.mode);
		if (mode === "empty") { el.showNamePrompt = true; return; }
		el.gitModalMode = mode === "template" ? "template" : "submodule";
		el.showGitModal = true;
	}) as EventListener);

	el.addEventListener("import-setup", ((e: CustomEvent) => {
		const { url, name, mode } = e.detail as { url: string; name: string; mode: string };
		ctx.startProjectHubWork("Cloning repository…");
		const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
		if (modal) { modal.step = "progress"; modal.errorNote = ""; }
		const gitOutputLines: string[] = [];
		const gitAppend = (line: string) => {
			gitOutputLines.push(line);
			if (gitOutputLines.length > 200) gitOutputLines.shift();
			const m = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
			if (m) m.outputLines = [...gitOutputLines];
		};
		void projectService.importFromGit(url, name, mode as "submodule" | "template", gitAppend).then((r) => {
			if (!r.ok) {
				el.projectHubBusy = false; el.projectHubBusyLabel = "";
				const m = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
				if (m) m.errorNote = r.error ?? "Clone failed";
				return;
			}
			gitAppend("Detecting project...");
			return projectService.detectProject(name);
		}).then((detectResult) => {
			if (!detectResult) return;
			el.projectHubBusy = false; el.projectHubBusyLabel = "";
			const m = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
			if (m && detectResult.ok !== false) {
				m.step = "detect";
				m.detectedType = (detectResult as Record<string, unknown>).type ?? "";
				m.detectedFramework = (detectResult as Record<string, unknown>).framework ?? "";
				m.detectedPackageManager = (detectResult as Record<string, unknown>).packageManager ?? "";
				m.detectedTestFramework = (detectResult as Record<string, unknown>).testFramework ?? "";
				m.detectedHasConfig = (detectResult as Record<string, unknown>).hasConfig ?? false;
				m.configBuildCommand = (detectResult as Record<string, unknown>).buildCommand ?? "";
				m.configTestCommand = (detectResult as Record<string, unknown>).testCommand ?? "";
				m.configLintCommand = (detectResult as Record<string, unknown>).lintCommand ?? "";
			}
		});
	}) as EventListener);

	el.addEventListener("wizard-configure", ((e: CustomEvent) => {
		const detail = e.detail as Record<string, string>;
		ctx.startProjectHubWork("Writing config…");
		void projectService.bootstrapProject(detail.name, {
			build: detail.buildCommand, test: detail.testCommand,
			lint: detail.lintCommand, storybook: detail.framework,
		}).then((r) => {
			ctx.endProjectHubWork(r);
			const m = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
			if (m && r.ok) m.step = "done";
		});
	}) as EventListener);

	el.addEventListener("wizard-open-project", ((e: CustomEvent) => {
		el.showGitModal = false;
		void ctx.loadProject(String(e.detail?.name));
	}) as EventListener);

	el.addEventListener("import-cancel", (() => { el.showGitModal = false; }) as EventListener);

	el.addEventListener("create-empty-project", ((e: CustomEvent) => {
		const name = String(e.detail?.name);
		ctx.startProjectHubWork("Creating project…");
		ctx.appendProjectHubLog("Creating project folder…");
		void projectService.createEmptyProject(name, ctx.appendProjectHubLog).then((r) => {
			if (!r.ok) { ctx.endProjectHubWork(r); return; }
			ctx.appendProjectHubLog("Creating project brief…");
			ctx.createNote?.(name);
			ctx.appendProjectHubLog("Done.");
			ctx.endProjectHubWork(r);
			void ctx.loadProject(name);
		});
	}) as EventListener);
}

export function wireConfigAndCatalogEvents(ctx: ProjectEventContext): void {
	const { el, projectService } = ctx;

	el.addEventListener("config-save", ((e: CustomEvent) => {
		if (el.projectHubBusy) return;
		const detail = e.detail as { path: string; strategy: string; requiredFields: string[] };
		const config: MarkdownSourceConfig = { path: detail.path, strategy: detail.strategy as MarkdownSourceConfig["strategy"], requiredFields: detail.requiredFields };
		ctx.startProjectHubWork("Saving markdown source config…");
		void projectService.saveMarkdownSourceConfig(ctx.getCurrentProject(), config, ctx.appendProjectHubLog).then((r) => {
			ctx.endProjectHubWork(r);
			const configTab = el.shadowRoot?.querySelector("flowti-tab-config") as HTMLElement & { saveStatus: string } | null;
			if (configTab) { configTab.saveStatus = r.ok ? "Saved" : (r.error ?? "Save failed"); setTimeout(() => { if (configTab) configTab.saveStatus = ""; }, 3000); }
		});
	}) as EventListener);

	el.addEventListener("config-browse-folder", (() => {
		if (!ctx.pickFolder) return;
		void ctx.pickFolder().then((folder) => {
			if (folder === null) return;
			const configTab = el.shadowRoot?.querySelector("flowti-tab-config") as HTMLElement & { sourcePath: string } | null;
			if (configTab) configTab.sourcePath = folder;
		});
	}) as EventListener);

	el.addEventListener("canvas-generate", ((e: CustomEvent) => {
		if (el.projectHubBusy) return;
		const preset = e.detail?.preset ? String(e.detail.preset) : undefined;
		if (!preset) { ctx.openNote?.(`01 - Projects/${ctx.getCurrentProject()}/sitemap.canvas`); return; }
		ctx.startProjectHubWork("Generating sitemap canvas…");
		void projectService.generateSitemapCanvas(ctx.getCurrentProject(), ctx.appendProjectHubLog, { preset, force: true }).then((r) => {
			ctx.endProjectHubWork(r);
			if (r.ok) ctx.openNote?.(`01 - Projects/${ctx.getCurrentProject()}/sitemap.canvas`);
		});
	}) as EventListener);

	el.addEventListener("canvas-merge", (() => {
		if (el.projectHubBusy) return;
		ctx.startProjectHubWork("Merging canvas changes…");
		void projectService.importCanvasSitemap(ctx.getCurrentProject(), ctx.appendProjectHubLog, { merge: true }).then((r) => ctx.endProjectHubWork(r));
	}) as EventListener);

	el.addEventListener("canvas-open", (() => { ctx.openNote?.(`01 - Projects/${ctx.getCurrentProject()}/sitemap.canvas`); }) as EventListener);

	// Health
	el.addEventListener("health-refresh", (() => {
		void projectService.getHealth(ctx.getCurrentProject()).then((r) => {
			if (r.ok && r.score) { el.healthScore = r.score; el.healthError = ""; }
			else { el.healthError = r.error ?? "Health check failed"; }
		});
	}) as EventListener);

	// TODOs
	const refreshTodos = () => { void projectService.getTodos(ctx.getCurrentProject()).then((r) => { el.todos = r.items; el.todosExist = r.exists; }); };
	el.addEventListener("todo-add", ((e: CustomEvent) => { void projectService.addTodo(ctx.getCurrentProject(), String(e.detail?.text ?? "")).then(() => refreshTodos()); }) as EventListener);
	el.addEventListener("todo-toggle", ((e: CustomEvent) => { void projectService.toggleTodo(ctx.getCurrentProject(), Number(e.detail?.index ?? 0)).then(() => refreshTodos()); }) as EventListener);
	el.addEventListener("todo-delete", ((e: CustomEvent) => { void projectService.deleteTodo(ctx.getCurrentProject(), Number(e.detail?.index ?? 0)).then(() => refreshTodos()); }) as EventListener);

	// Catalog
	el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => {
		void projectService.listEntities(ctx.getCurrentProject(), String(e.detail?.entityType ?? "domains") as CatalogEntityType).then((entities) => { el.catalogEntities = entities; });
	}) as EventListener);

	el.addEventListener("catalog-entity-create", ((e: CustomEvent) => {
		const { entityType, definition } = e.detail as { entityType: string; definition: CatalogEntityDef };
		void projectService.createEntity(ctx.getCurrentProject(), entityType as CatalogEntityType, definition).then((r) => {
			if (r.ok) void projectService.listEntities(ctx.getCurrentProject(), entityType as CatalogEntityType).then((entities) => { el.catalogEntities = entities; });
		});
	}) as EventListener);

	// Reporting
	el.addEventListener("report-run", ((e: CustomEvent) => {
		const id = String(e.detail?.generatorId ?? "");
		el.reportNodeStates = { ...(el.reportNodeStates as Record<string, string>), [id]: "running" };
		el.reportBusy = true;
		const lines: string[] = [];
		void projectService.runReport(ctx.getCurrentProject(), id, (line) => { lines.push(line); if (lines.length > 200) lines.shift(); el.reportOutput = [...lines]; }).then((r) => {
			el.reportNodeStates = { ...(el.reportNodeStates as Record<string, string>), [id]: r.ok ? "passed" : "failed" };
			el.reportBusy = false;
		});
	}) as EventListener);

	el.addEventListener("report-run-all", (() => {
		el.reportBusy = true;
		const lines: string[] = [];
		const states: Record<string, string> = {};
		for (const g of (el.reportGenerators as Array<{ id: string }>)) states[g.id] = "running";
		el.reportNodeStates = states;
		void projectService.runAllReports(ctx.getCurrentProject(), (line) => { lines.push(line); if (lines.length > 200) lines.shift(); el.reportOutput = [...lines]; }).then(() => { el.reportBusy = false; });
	}) as EventListener);

	// Team roster
	el.addEventListener("team-roster-save", ((e: CustomEvent) => {
		if (el.projectHubBusy) return;
		const slots = (e.detail?.slots ?? []) as TeamRoleSlot[];
		ctx.startProjectHubWork("Saving team roster");
		void projectService.saveTeamRoster(ctx.getCurrentProject(), slots, ctx.appendProjectHubLog).then((r) => ctx.endProjectHubWork(r));
	}) as EventListener);

	el.addEventListener("team-create-agent", ((e: CustomEvent) => {
		if (el.projectHubBusy) return;
		const roleId = String((e.detail as { roleId?: string })?.roleId ?? "");
		const agentName = String((e.detail as { agentName?: string })?.agentName ?? "");
		ctx.startProjectHubWork("Creating agent");
		void projectService.createAgentFromRole(ctx.getCurrentProject(), roleId, agentName, ctx.appendProjectHubLog).then((r) => ctx.endProjectHubWork(r));
	}) as EventListener);

	el.addEventListener("team-refresh-agents", (() => {
		void projectService.listVaultAgents().then((a) => { el.vaultAgents = [...a]; });
	}) as EventListener);

	el.addEventListener("team-roster-error", ((e: CustomEvent) => {
		const msg = String((e.detail as { message?: string })?.message ?? "Team roster error");
		el.statusMessage = msg;
		setTimeout(() => { if (el.statusMessage === msg) el.statusMessage = ""; }, 5000);
	}) as EventListener);
}
