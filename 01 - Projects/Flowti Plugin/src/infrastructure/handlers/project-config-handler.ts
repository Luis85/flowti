import type { IProjectService, ProjectDetailElement, MarkdownSourceConfig, CatalogEntityType, CatalogEntityDef } from "../../domain/projects/types.js";

export interface ConfigCatalogHandlerDeps {
	readonly el: ProjectDetailElement;
	readonly signal: AbortSignal;
	readonly projectService: IProjectService;
	readonly getCurrentProject: () => string;
	readonly startProjectHubWork: (label: string) => void;
	readonly appendProjectHubLog: (line: string) => void;
	readonly endProjectHubWork: (result: { ok: boolean; error?: string }) => void;
	readonly openNote?: (path: string) => void;
	readonly pickFolder?: () => Promise<string | null>;
}

export class ConfigCatalogHandler {
	private readonly deps: ConfigCatalogHandlerDeps;

	constructor(deps: ConfigCatalogHandlerDeps) {
		this.deps = deps;
		this.wireEvents();
	}

	dispose(): void {}

	private wireEvents(): void {
		const { el } = this.deps;

		// Config save
		el.addEventListener("config-save", ((e: CustomEvent) => {
			if (el.projectHubBusy) return;
			const detail = e.detail as { path: string; strategy: string; requiredFields: string[] };
			const config: MarkdownSourceConfig = { path: detail.path, strategy: detail.strategy as MarkdownSourceConfig["strategy"], requiredFields: detail.requiredFields };
			this.deps.startProjectHubWork("Saving markdown source config…");
			void this.deps.projectService.saveMarkdownSourceConfig(this.deps.getCurrentProject(), config, (l) => this.deps.appendProjectHubLog(l)).then((r) => {
				if (this.deps.signal.aborted) return;
				this.deps.endProjectHubWork(r);
				const msg = r.ok ? "Saved" : (r.error ?? "Save failed");
				el.configSaveStatus = msg;
				setTimeout(() => { if (!this.deps.signal.aborted && el.configSaveStatus === msg) el.configSaveStatus = ""; }, 3000);
			});
		}) as EventListener);

		// Config browse folder
		el.addEventListener("config-browse-folder", (() => {
			if (!this.deps.pickFolder) return;
			void this.deps.pickFolder().then((folder) => {
				if (folder === null) return;
				if (!this.deps.signal.aborted) el.configSourcePath = folder;
			});
		}) as EventListener);

		// Canvas generate
		el.addEventListener("canvas-generate", ((e: CustomEvent) => {
			if (el.projectHubBusy) return;
			const preset = e.detail?.preset ? String(e.detail.preset) : undefined;
			if (!preset) { this.deps.openNote?.(`01 - Projects/${this.deps.getCurrentProject()}/sitemap.canvas`); return; }
			el.canvasPreset = preset;
			this.deps.startProjectHubWork("Generating sitemap canvas…");
			void this.deps.projectService.generateSitemapCanvas(this.deps.getCurrentProject(), (l) => this.deps.appendProjectHubLog(l), { preset, force: true }).then((r) => {
				if (this.deps.signal.aborted) return;
				this.deps.endProjectHubWork(r);
				if (r.ok) this.deps.openNote?.(`01 - Projects/${this.deps.getCurrentProject()}/sitemap.canvas`);
			});
		}) as EventListener);

		// Canvas merge
		el.addEventListener("canvas-merge", (() => {
			if (el.projectHubBusy) return;
			this.deps.startProjectHubWork("Merging canvas changes…");
			void this.deps.projectService.importCanvasSitemap(this.deps.getCurrentProject(), (l) => this.deps.appendProjectHubLog(l), { merge: true }).then((r) => {
				if (!this.deps.signal.aborted) this.deps.endProjectHubWork(r);
			});
		}) as EventListener);

		// Canvas open
		el.addEventListener("canvas-open", (() => {
			this.deps.openNote?.(`01 - Projects/${this.deps.getCurrentProject()}/sitemap.canvas`);
		}) as EventListener);

		// Health refresh
		el.addEventListener("health-refresh", (() => {
			void this.deps.projectService.getHealth(this.deps.getCurrentProject()).then((r) => {
				if (this.deps.signal.aborted) return;
				if (r.ok && r.score) { el.healthScore = r.score; el.healthError = ""; }
				else { el.healthError = r.error ?? "Health check failed"; }
			});
		}) as EventListener);

		// TODOs
		const refreshTodos = () => {
			void this.deps.projectService.getTodos(this.deps.getCurrentProject()).then((r) => {
				if (!this.deps.signal.aborted) { el.todos = r.items; el.todosExist = r.exists; }
			});
		};

		el.addEventListener("todo-add", ((e: CustomEvent) => {
			void this.deps.projectService.addTodo(this.deps.getCurrentProject(), String(e.detail?.text ?? "")).then(() => {
				if (!this.deps.signal.aborted) refreshTodos();
			});
		}) as EventListener);

		el.addEventListener("todo-toggle", ((e: CustomEvent) => {
			void this.deps.projectService.toggleTodo(this.deps.getCurrentProject(), Number(e.detail?.index ?? 0)).then(() => {
				if (!this.deps.signal.aborted) refreshTodos();
			});
		}) as EventListener);

		el.addEventListener("todo-delete", ((e: CustomEvent) => {
			void this.deps.projectService.deleteTodo(this.deps.getCurrentProject(), Number(e.detail?.index ?? 0)).then(() => {
				if (!this.deps.signal.aborted) refreshTodos();
			});
		}) as EventListener);

		// Catalog list refresh
		el.addEventListener("catalog-list-refresh", ((e: CustomEvent) => {
			void this.deps.projectService.listEntities(this.deps.getCurrentProject(), String(e.detail?.entityType ?? "domains") as CatalogEntityType).then((entities) => {
				if (!this.deps.signal.aborted) el.catalogEntities = entities;
			});
		}) as EventListener);

		// Catalog entity create
		el.addEventListener("catalog-entity-create", ((e: CustomEvent) => {
			const { entityType, definition } = e.detail as { entityType: string; definition: CatalogEntityDef };
			void this.deps.projectService.createEntity(this.deps.getCurrentProject(), entityType as CatalogEntityType, definition).then((r) => {
				if (this.deps.signal.aborted) return;
				if (r.ok) {
					void this.deps.projectService.listEntities(this.deps.getCurrentProject(), entityType as CatalogEntityType).then((entities) => {
						if (!this.deps.signal.aborted) el.catalogEntities = entities;
					});
				}
			});
		}) as EventListener);

		// Report run
		el.addEventListener("report-run", ((e: CustomEvent) => {
			const id = String(e.detail?.generatorId ?? "");
			el.reportNodeStates = { ...(el.reportNodeStates as Record<string, string>), [id]: "running" };
			el.reportBusy = true;
			const lines: string[] = [];
			void this.deps.projectService.runReport(this.deps.getCurrentProject(), id, (line) => {
				lines.push(line);
				if (lines.length > 200) lines.shift();
				if (!this.deps.signal.aborted) el.reportOutput = [...lines];
			}).then((r) => {
				if (this.deps.signal.aborted) return;
				el.reportNodeStates = { ...(el.reportNodeStates as Record<string, string>), [id]: r.ok ? "passed" : "failed" };
				el.reportBusy = false;
			});
		}) as EventListener);

		// Report run all
		el.addEventListener("report-run-all", (() => {
			el.reportBusy = true;
			const lines: string[] = [];
			const states: Record<string, string> = {};
			for (const g of (el.reportGenerators as Array<{ id: string }>)) states[g.id] = "running";
			el.reportNodeStates = states;
			void this.deps.projectService.runAllReports(this.deps.getCurrentProject(), (line) => {
				lines.push(line);
				if (lines.length > 200) lines.shift();
				if (!this.deps.signal.aborted) el.reportOutput = [...lines];
			}).then(() => {
				if (!this.deps.signal.aborted) el.reportBusy = false;
			});
		}) as EventListener);
	}
}
