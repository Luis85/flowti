/**
 * Project detail handler event wiring — Storybook, Git, and Config actions.
 *
 * Extracted from project-handlers.ts to stay under max-lines.
 */

import type { IProjectService, StorybookFramework, MarkdownSourceConfig, CatalogEntityType, CatalogEntityDef, TeamRoleSlot } from "../../domain/projects/types.js";

export interface ProjectEventContext {
	el: HTMLElement & Record<string, unknown>;
	projectService: IProjectService;
	getCurrentProject: () => string;
	loadProject: (name: string) => Promise<void>;
	loadProjectList: () => Promise<void>;
	startBusy: (label: string) => void;
	appendOutput: (line: string) => void;
	endBusy: (result: { ok: boolean; error?: string }) => void;
	openNote?: (path: string) => void;
	createNote?: (name: string) => void;
	openInWebviewer?: (url: string) => void;
	revealFolder?: (path: string) => void;
	pickFolder?: () => Promise<string | null>;
}

export function wireStorybookEvents(ctx: ProjectEventContext): void {
	const { el, projectService } = ctx;

	el.addEventListener("storybook-install", ((e: CustomEvent) => {
		ctx.startBusy("Installing Storybook...");
		void projectService.installStorybook(ctx.getCurrentProject(), String(e.detail.framework) as StorybookFramework, ctx.appendOutput)
			.then((r) => { ctx.endBusy(r); if (r.ok) el.showScaffoldModal = true; });
	}) as EventListener);

	el.addEventListener("storybook-start", (() => {
		ctx.startBusy("Starting Storybook...");
		let resolved = false;
		let detectedUrl = "http://localhost:6006";
		const originalAppend = ctx.appendOutput;
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
				if (!result.ok) { ctx.endBusy(result); return; }
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
			});
	}) as EventListener);

	el.addEventListener("storybook-stop", (() => {
		void projectService.stopStorybook(ctx.getCurrentProject()).then((r) => ctx.endBusy(r));
	}) as EventListener);

	el.addEventListener("storybook-build", (() => {
		ctx.startBusy("Building Storybook...");
		void projectService.buildStorybook(ctx.getCurrentProject(), ctx.appendOutput).then((r) => ctx.endBusy(r));
	}) as EventListener);

	el.addEventListener("storybook-import", (() => {
		const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
		if (savedPath) {
			ctx.startBusy("Importing markdown to sitemap...");
			void projectService.importMarkdownSitemap(ctx.getCurrentProject(), savedPath, ctx.appendOutput).then((r) => ctx.endBusy(r));
			return;
		}
		if (!ctx.pickFolder) return;
		void ctx.pickFolder().then((folder) => {
			if (folder === null) return;
			ctx.startBusy("Importing markdown to sitemap...");
			void projectService.importMarkdownSitemap(ctx.getCurrentProject(), folder, ctx.appendOutput).then((r) => ctx.endBusy(r));
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

	el.addEventListener("storybook-canvas-import", (() => {
		ctx.startBusy("Importing from canvas...");
		void projectService.importCanvasSitemap(ctx.getCurrentProject(), ctx.appendOutput).then((r) => {
			ctx.endBusy(r);
			void projectService.listComponents(ctx.getCurrentProject()).then((c) => { el.components = c; });
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
			ctx.startBusy("Importing canvas sitemap...");
			void projectService.importCanvasSitemap(ctx.getCurrentProject(), ctx.appendOutput).then((importResult) => {
				if (!importResult.ok) { ctx.endBusy(importResult); return; }
				ctx.appendOutput("Scaffolding components...");
				void projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendOutput, { adoptImport: true }).then((scaffoldResult) => {
					if (!scaffoldResult.ok) { ctx.endBusy(scaffoldResult); return; }
					ctx.endBusy(scaffoldResult);
					el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
				});
			});
			return;
		}
		const importFirst = e.detail?.importFirst === true;
		if (importFirst) {
			const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
			if (!savedPath) return;
			ctx.startBusy("Importing markdown...");
			void projectService.importMarkdownSitemap(ctx.getCurrentProject(), savedPath, ctx.appendOutput).then((importResult) => {
				if (!importResult.ok) { ctx.endBusy(importResult); return; }
				ctx.appendOutput("Scaffolding components...");
				void projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendOutput, { adoptImport: true }).then((scaffoldResult) => {
					if (!scaffoldResult.ok) { ctx.endBusy(scaffoldResult); return; }
					ctx.endBusy(scaffoldResult);
					el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
				});
			});
		} else {
			ctx.startBusy("Scaffolding components...");
			void projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendOutput, { adoptImport: true }).then((r) => {
				if (!r.ok) { ctx.endBusy(r); return; }
				ctx.endBusy(r);
				el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
			});
		}
	}) as EventListener);

	el.addEventListener("scaffold-dismiss", (() => { el.showScaffoldModal = false; }) as EventListener);

	el.addEventListener("storybook-regenerate-confirmed", (() => {
		const framework = (el.storybook as { framework?: string })?.framework ?? "html";
		ctx.startBusy("Regenerating component library...");
		void projectService.cleanStorybook(ctx.getCurrentProject()).then((cleanResult) => {
			if (!cleanResult.ok) { ctx.endBusy(cleanResult); return; }
			ctx.appendOutput("Re-installing Storybook...");
			return projectService.installStorybook(ctx.getCurrentProject(), framework as StorybookFramework, ctx.appendOutput);
		}).then((installResult) => {
			if (!installResult || !installResult.ok) { ctx.endBusy(installResult ?? { ok: false }); return; }
			ctx.appendOutput("Scaffolding components...");
			return projectService.scaffoldStorybook(ctx.getCurrentProject(), ctx.appendOutput, { adoptImport: true });
		}).then((scaffoldResult) => {
			if (!scaffoldResult || !scaffoldResult.ok) { ctx.endBusy(scaffoldResult ?? { ok: false }); return; }
			ctx.endBusy(scaffoldResult);
			el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
		}).catch(() => { ctx.endBusy({ ok: false, error: "Regeneration failed unexpectedly" }); });
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
		ctx.startBusy("Cloning repository...");
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
				el.storybookBusy = false; el.storybookBusyLabel = "";
				const m = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
				if (m) m.errorNote = r.error ?? "Clone failed";
				return;
			}
			gitAppend("Detecting project...");
			return projectService.detectProject(name);
		}).then((detectResult) => {
			if (!detectResult) return;
			el.storybookBusy = false; el.storybookBusyLabel = "";
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
		ctx.startBusy("Writing config...");
		void projectService.bootstrapProject(detail.name, {
			build: detail.buildCommand, test: detail.testCommand,
			lint: detail.lintCommand, storybook: detail.framework,
		}).then((r) => {
			ctx.endBusy(r);
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
		ctx.startBusy("Creating project...");
		ctx.appendOutput("Creating project folder...");
		void projectService.createEmptyProject(name, ctx.appendOutput).then((r) => {
			if (!r.ok) { ctx.endBusy(r); return; }
			ctx.appendOutput("Creating project brief...");
			ctx.createNote?.(name);
			ctx.appendOutput("Done.");
			ctx.endBusy(r);
			void ctx.loadProject(name);
		});
	}) as EventListener);
}

export function wireConfigAndCatalogEvents(ctx: ProjectEventContext): void {
	const { el, projectService } = ctx;

	el.addEventListener("config-save", ((e: CustomEvent) => {
		const detail = e.detail as { path: string; strategy: string; requiredFields: string[] };
		const config: MarkdownSourceConfig = { path: detail.path, strategy: detail.strategy as MarkdownSourceConfig["strategy"], requiredFields: detail.requiredFields };
		ctx.startBusy("Saving config...");
		void projectService.saveMarkdownSourceConfig(ctx.getCurrentProject(), config, ctx.appendOutput).then((r) => {
			ctx.endBusy(r);
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
		const preset = e.detail?.preset ? String(e.detail.preset) : undefined;
		if (!preset) { ctx.openNote?.(`01 - Projects/${ctx.getCurrentProject()}/sitemap.canvas`); return; }
		ctx.startBusy("Generating sitemap canvas...");
		void projectService.generateSitemapCanvas(ctx.getCurrentProject(), ctx.appendOutput, { preset, force: true }).then((r) => {
			ctx.endBusy(r);
			if (r.ok) ctx.openNote?.(`01 - Projects/${ctx.getCurrentProject()}/sitemap.canvas`);
		});
	}) as EventListener);

	el.addEventListener("canvas-merge", (() => {
		ctx.startBusy("Merging canvas changes...");
		void projectService.importCanvasSitemap(ctx.getCurrentProject(), ctx.appendOutput, { merge: true }).then((r) => ctx.endBusy(r));
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
		const slots = (e.detail?.slots ?? []) as TeamRoleSlot[];
		ctx.startBusy("Saving team roster...");
		void projectService.saveTeamRoster(ctx.getCurrentProject(), slots, ctx.appendOutput).then((r) => ctx.endBusy(r));
	}) as EventListener);

	el.addEventListener("team-create-agent", ((e: CustomEvent) => {
		const roleId = String((e.detail as { roleId?: string })?.roleId ?? "");
		const agentName = String((e.detail as { agentName?: string })?.agentName ?? "");
		ctx.startBusy("Creating agent…");
		void projectService.createAgentFromRole(ctx.getCurrentProject(), roleId, agentName, ctx.appendOutput).then((r) => ctx.endBusy(r));
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
