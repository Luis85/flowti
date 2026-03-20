/**
 * Project detail handler — bridges Lit component ↔ IProjectService.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IProjectService, StorybookFramework, MarkdownSourceConfig, CatalogEntityType, CatalogEntityDef } from "../../domain/projects/types.js";
import type { VaultFileAdapter } from "../vault-adapter.js";

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

		// Load health
		void projectService.getHealth(name).then((r) => {
			if (r.ok && r.score) el.healthScore = r.score;
		});

		// Load TODOs
		void projectService.getTodos(name).then((r) => {
			el.todos = r.items;
			el.todosExist = r.exists;
		});

		// Load components
		void projectService.listComponents(name).then((c) => {
			el.components = c;
		});

		// Load report generators
		void projectService.getReportGenerators(name).then((g) => {
			el.reportGenerators = g;
		});

		// Load initial catalog entities (domains)
		void projectService.listEntities(name, "domains").then((entities) => {
			el.catalogEntities = entities;
		});
	}

	// ── Project selected from list ──
	el.addEventListener("project-selected", ((e: CustomEvent) => {
		void loadProject(String(e.detail.name));
	}) as EventListener);

	// ── Back to list ──
	el.addEventListener("back-to-list", (() => {
		currentProject = "";
		el.projectName = "";
		outputLines.length = 0;
		el.storybookOutput = [];
		el.storybookError = "";
		el.actionSuccess = "";
		void loadProjectList();
	}) as EventListener);

	// ── Note actions ──
	el.addEventListener("open-project-note", ((e: CustomEvent) => {
		deps.openNote?.(String(e.detail.path));
	}) as EventListener);

	el.addEventListener("open-project-folder", ((e: CustomEvent) => {
		deps.revealFolder?.(`01 - Projects/${String(e.detail.name)}`);
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
			el.actionSuccess = "";
		} else {
			const msg = lastBusyLabel.replace(/\.{3}$/, "") + " completed";
			el.actionSuccess = msg;
			setTimeout(() => { if (el.actionSuccess === msg) el.actionSuccess = ""; }, 4000);
		}
		void loadProject(currentProject);
	}

	// ── Storybook actions ──
	el.addEventListener("storybook-install", ((e: CustomEvent) => {
		startBusy("Installing Storybook...");
		void projectService.installStorybook(currentProject, String(e.detail.framework) as StorybookFramework, appendOutput)
			.then((r) => {
				endBusy(r);
				if (r.ok) {
					// Show scaffold modal instead of auto-starting
					el.showScaffoldModal = true;
				}
			});
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

	el.addEventListener("storybook-import", (() => {
		// Use saved config path if available, otherwise fall back to folder picker
		const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
		if (savedPath) {
			startBusy("Importing markdown to sitemap...");
			void projectService.importMarkdownSitemap(currentProject, savedPath, appendOutput)
				.then((r) => endBusy(r));
			return;
		}
		if (!deps.pickFolder) return;
		void deps.pickFolder().then((folder) => {
			if (folder === null) return;
			startBusy("Importing markdown to sitemap...");
			void projectService.importMarkdownSitemap(currentProject, folder, appendOutput)
				.then((r) => endBusy(r));
		});
	}) as EventListener);

	el.addEventListener("storybook-view", ((e: CustomEvent) => {
		const url = String(e.detail?.url ?? "http://localhost:6006");
		deps.openInWebviewer?.(url);
	}) as EventListener);

	// ── Config tab actions ──
	el.addEventListener("config-save", ((e: CustomEvent) => {
		const detail = e.detail as { path: string; strategy: string; requiredFields: string[] };
		const config: MarkdownSourceConfig = {
			path: detail.path,
			strategy: detail.strategy as MarkdownSourceConfig["strategy"],
			requiredFields: detail.requiredFields,
		};
		startBusy("Saving config...");
		void projectService.saveMarkdownSourceConfig(currentProject, config, appendOutput)
			.then((r) => {
				endBusy(r);
				const configTab = el.shadowRoot?.querySelector("flowti-tab-config") as HTMLElement & { saveStatus: string } | null;
				if (configTab) {
					configTab.saveStatus = r.ok ? "Saved" : (r.error ?? "Save failed");
					setTimeout(() => { if (configTab) configTab.saveStatus = ""; }, 3000);
				}
			});
	}) as EventListener);

	el.addEventListener("config-browse-folder", (() => {
		if (!deps.pickFolder) return;
		void deps.pickFolder().then((folder) => {
			if (folder === null) return;
			// Push the chosen folder path into the config tab's sourcePath
			const configTab = el.shadowRoot?.querySelector("flowti-tab-config") as HTMLElement & { sourcePath: string } | null;
			if (configTab) configTab.sourcePath = folder;
		});
	}) as EventListener);

	// ── Scaffold modal actions ──
	el.addEventListener("scaffold-confirm", ((e: CustomEvent) => {
		el.showScaffoldModal = false;
		const canvasImport = e.detail?.canvasImport === true;

		if (canvasImport) {
			startBusy("Importing canvas sitemap...");
			void projectService.importCanvasSitemap(currentProject, appendOutput)
				.then((importResult) => {
					if (!importResult.ok) { endBusy(importResult); return; }
					appendOutput("Scaffolding components...");
					void projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true })
						.then((scaffoldResult) => {
							if (!scaffoldResult.ok) { endBusy(scaffoldResult); return; }
							endBusy(scaffoldResult);
							el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
						});
				});
			return;
		}

		const importFirst = e.detail?.importFirst === true;

		if (importFirst) {
			const savedPath = (el.config as { markdownSource?: { path?: string } } | undefined)?.markdownSource?.path;
			if (!savedPath) { return; }
			startBusy("Importing markdown...");
			void projectService.importMarkdownSitemap(currentProject, savedPath, appendOutput)
				.then((importResult) => {
					if (!importResult.ok) { endBusy(importResult); return; }
					appendOutput("Scaffolding components...");
					void projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true })
						.then((scaffoldResult) => {
							if (!scaffoldResult.ok) { endBusy(scaffoldResult); return; }
							endBusy(scaffoldResult);
							el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
						});
				});
		} else {
			startBusy("Scaffolding components...");
			void projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true })
				.then((r) => {
					if (!r.ok) { endBusy(r); return; }
					endBusy(r);
					el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
				});
		}
	}) as EventListener);

	el.addEventListener("scaffold-dismiss", (() => {
		el.showScaffoldModal = false;
	}) as EventListener);

	// ── Regenerate flow ──
	el.addEventListener("storybook-regenerate-confirmed", (() => {
		const framework = (el.storybook as { framework?: string })?.framework ?? "html";

		startBusy("Regenerating component library...");
		void projectService.cleanStorybook(currentProject)
			.then((cleanResult) => {
				if (!cleanResult.ok) { endBusy(cleanResult); return; }
				appendOutput("Re-installing Storybook...");
				return projectService.installStorybook(currentProject, framework as StorybookFramework, appendOutput);
			})
			.then((installResult) => {
				if (!installResult || !installResult.ok) { endBusy(installResult ?? { ok: false }); return; }
				appendOutput("Scaffolding components...");
				return projectService.scaffoldStorybook(currentProject, appendOutput, { adoptImport: true });
			})
			.then((scaffoldResult) => {
				if (!scaffoldResult || !scaffoldResult.ok) { endBusy(scaffoldResult ?? { ok: false }); return; }
				endBusy(scaffoldResult);
				el.dispatchEvent(new CustomEvent("storybook-start", { bubbles: true, composed: true }));
			})
			.catch(() => { endBusy({ ok: false, error: "Regeneration failed unexpectedly" }); });
	}) as EventListener);

	el.addEventListener("storybook-open-folder", (() => {
		const config = (el.config as { storybookDir?: string } | undefined);
		const dir = config?.storybookDir ?? "components";
		deps.revealFolder?.(`01 - Projects/${currentProject}/${dir}`);
	}) as EventListener);

	el.addEventListener("storybook-preview", (() => {
		void projectService.previewStorybook(currentProject)
			.then((r) => {
				if (r.ok && r.url) {
					deps.openInWebviewer?.(r.url);
				} else if (r.error) {
					el.storybookError = r.error;
				}
			});
	}) as EventListener);

	el.addEventListener("storybook-dismiss-output", (() => {
		outputLines.length = 0;
		el.storybookOutput = [];
	}) as EventListener);

	el.addEventListener("canvas-generate", ((e: CustomEvent) => {
		const preset = e.detail?.preset ? String(e.detail.preset) : undefined;
		if (!preset) {
			// No preset = just open the existing canvas
			deps.openNote?.(`01 - Projects/${currentProject}/sitemap.canvas`);
			return;
		}
		startBusy("Generating sitemap canvas...");
		void projectService.generateSitemapCanvas(currentProject, appendOutput, { preset, force: true })
			.then((r) => {
				endBusy(r);
				if (r.ok) {
					deps.openNote?.(`01 - Projects/${currentProject}/sitemap.canvas`);
				}
			});
	}) as EventListener);

	el.addEventListener("canvas-merge", (() => {
		startBusy("Merging canvas changes...");
		void projectService.importCanvasSitemap(currentProject, appendOutput, { merge: true })
			.then((r) => endBusy(r));
	}) as EventListener);

	// ── Health ──────────────────────────────────────────────────────
	el.addEventListener("health-refresh", (() => {
		void projectService.getHealth(currentProject).then((r) => {
			if (r.ok && r.score) {
				el.healthScore = r.score;
				el.healthError = "";
			} else {
				el.healthError = r.error ?? "Health check failed";
			}
		});
	}) as EventListener);

	// ── TODOs ───────────────────────────────────────────────────────
	const refreshTodos = () => {
		void projectService.getTodos(currentProject).then((r) => {
			el.todos = r.items;
			el.todosExist = r.exists;
		});
	};

	el.addEventListener("todo-add", ((e: CustomEvent) => {
		void projectService.addTodo(currentProject, String(e.detail?.text ?? "")).then(() => refreshTodos());
	}) as EventListener);

	el.addEventListener("todo-toggle", ((e: CustomEvent) => {
		void projectService.toggleTodo(currentProject, Number(e.detail?.index ?? 0)).then(() => refreshTodos());
	}) as EventListener);

	el.addEventListener("todo-delete", ((e: CustomEvent) => {
		void projectService.deleteTodo(currentProject, Number(e.detail?.index ?? 0)).then(() => refreshTodos());
	}) as EventListener);

	// ── Event Catalog ───────────────────────────────────────────────
	el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => {
		const entityType = String(e.detail?.entityType ?? "domains");
		void projectService.listEntities(currentProject, entityType as CatalogEntityType).then((entities) => {
			el.catalogEntities = entities;
		});
	}) as EventListener);

	el.addEventListener("catalog-entity-create", ((e: CustomEvent) => {
		const { entityType, definition } = e.detail as { entityType: string; definition: CatalogEntityDef };
		void projectService.createEntity(currentProject, entityType as CatalogEntityType, definition).then((r) => {
			if (r.ok) {
				void projectService.listEntities(currentProject, entityType as CatalogEntityType).then((entities) => {
					el.catalogEntities = entities;
				});
			}
		});
	}) as EventListener);

	// ── Reporting ───────────────────────────────────────────────────
	el.addEventListener("report-run", ((e: CustomEvent) => {
		const id = String(e.detail?.generatorId ?? "");
		el.reportNodeStates = { ...(el.reportNodeStates as Record<string, string>), [id]: "running" };
		el.reportBusy = true;
		const lines: string[] = [];
		void projectService.runReport(currentProject, id, (line) => {
			lines.push(line);
			if (lines.length > 200) lines.shift();
			el.reportOutput = [...lines];
		}).then((r) => {
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

		void projectService.runAllReports(currentProject, (line) => {
			lines.push(line);
			if (lines.length > 200) lines.shift();
			el.reportOutput = [...lines];
		}).then(() => {
			el.reportBusy = false;
		});
	}) as EventListener);

	// ── Git import / add project ──
	el.addEventListener("add-project", ((e: CustomEvent) => {
		const mode = String(e.detail?.mode);
		if (mode === "empty") {
			el.showNamePrompt = true;
			return;
		}
		el.gitModalMode = mode === "template" ? "template" : "submodule";
		el.showGitModal = true;
	}) as EventListener);

	el.addEventListener("import-setup", ((e: CustomEvent) => {
		const { url, name, mode } = e.detail as { url: string; name: string; mode: string };
		startBusy("Cloning repository...");
		const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
		if (modal) { modal.step = "progress"; modal.errorNote = ""; }
		const gitOutputLines: string[] = [];
		const gitAppend = (line: string) => {
			gitOutputLines.push(line);
			if (gitOutputLines.length > 200) gitOutputLines.shift();
			const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
			if (modal) modal.outputLines = [...gitOutputLines];
		};
		void projectService.importFromGit(url, name, mode as "submodule" | "template", gitAppend)
			.then((r) => {
				if (!r.ok) {
					el.storybookBusy = false;
					el.storybookBusyLabel = "";
					const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
					if (modal) modal.errorNote = r.error ?? "Clone failed";
					return;
				}
				gitAppend("Detecting project...");
				return projectService.detectProject(name);
			})
			.then((detectResult) => {
				if (!detectResult) return;
				el.storybookBusy = false;
				el.storybookBusyLabel = "";
				const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
				if (modal && detectResult.ok !== false) {
					modal.step = "detect";
					modal.detectedType = (detectResult as Record<string, unknown>).type ?? "";
					modal.detectedFramework = (detectResult as Record<string, unknown>).framework ?? "";
					modal.detectedPackageManager = (detectResult as Record<string, unknown>).packageManager ?? "";
					modal.detectedTestFramework = (detectResult as Record<string, unknown>).testFramework ?? "";
					modal.detectedHasConfig = (detectResult as Record<string, unknown>).hasConfig ?? false;
					modal.configBuildCommand = (detectResult as Record<string, unknown>).buildCommand ?? "";
					modal.configTestCommand = (detectResult as Record<string, unknown>).testCommand ?? "";
					modal.configLintCommand = (detectResult as Record<string, unknown>).lintCommand ?? "";
				}
			});
	}) as EventListener);

	el.addEventListener("wizard-configure", ((e: CustomEvent) => {
		const detail = e.detail as Record<string, string>;
		const name = detail.name;
		startBusy("Writing config...");
		void projectService.bootstrapProject(name, {
			build: detail.buildCommand,
			test: detail.testCommand,
			lint: detail.lintCommand,
			storybook: detail.framework,
		}).then((r) => {
			endBusy(r);
			const modal = el.shadowRoot?.querySelector("flowti-git-import-modal") as HTMLElement & Record<string, unknown> | null;
			if (modal && r.ok) modal.step = "done";
		});
	}) as EventListener);

	el.addEventListener("wizard-open-project", ((e: CustomEvent) => {
		el.showGitModal = false;
		void loadProject(String(e.detail?.name));
	}) as EventListener);

	el.addEventListener("import-cancel", (() => {
		el.showGitModal = false;
	}) as EventListener);

	el.addEventListener("create-empty-project", ((e: CustomEvent) => {
		const name = String(e.detail?.name);
		startBusy("Creating project...");
		appendOutput("Creating project folder...");
		void projectService.createEmptyProject(name, appendOutput)
			.then((r) => {
				if (!r.ok) { endBusy(r); return; }
				appendOutput("Creating project brief...");
				deps.createNote?.(name);
				appendOutput("Done.");
				endBusy(r);
				void loadProject(name);
			});
	}) as EventListener);

	container.appendChild(el);
	if (currentProject) {
		void loadProject(currentProject);
	} else {
		void loadProjectList().then(() => { el.cliConnected = true; });
	}

	return () => { el.remove(); };
}
