/**
 * JourneyBuilderSidebar — Obsidian right-sidebar view for creating
 * and editing E2E journey definitions.
 *
 * Acts as orchestrator: owns state, delegates rendering to extracted
 * components (WelcomeScreen, SetupForm, CanvasSyncController) and
 * composable UI (NavBar, StepCard, JSONPanel, ActionList, etc.).
 *
 * States: welcome → setup → steps (step editor with prev/next navigation)
 */
import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { JourneyAction } from "../../domain/journeyBuilder/types";
import type { EventSuggestItem } from "./EventSuggestTypes";
import type { JSONPanel } from "./JSONPanel";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupForm } from "./SetupForm";
import { CanvasSyncController } from "./CanvasSyncController";
import { renderHeader, renderBackButton, renderLoading, renderToolbarButton, setElementLoading, setCanvasSyncStatus } from "./sidebarHelpers";
import { isJourneyCanvas, type ParsedJourneyCanvas } from "../../domain/journeyBuilder/canvasParser";
import { JourneyPickerModal } from "./sidebarModals";
import { nextStepId, type SidebarContext } from "./sidebarEventHandlers";
import { renderStepsHeader, renderStepsNavigation, renderStepsContent, renderJsonPanel, type StepRendererDeps } from "./sidebarStepRenderer";

export const VIEW_TYPE_JOURNEY_BUILDER = "flowti-journey-builder";

/** Sidebar view state: welcome (landing), setup (metadata form), or steps (step editor). */
export type SidebarState = "welcome" | "setup" | "steps";

export interface JourneyMetadata {
	name: string;
	description: string;
	startEvent: string;
	endEvent: string;
}

export interface JourneyStep {
	id: string;
	title: string;
	description: string;
	swimlane: string;
	actions: JourneyAction[];
	events?: string[];
	commands?: string[];
	interactions?: string[];
	components?: string[];
	backgroundImage?: string;
}

export interface JourneyBuilderSidebarDeps {
	eventBus: IEventBus;
	getEventCatalog?: () => EventSuggestItem[];
	getCommands?: () => { id: string; label: string; domain: string }[];
	getJourneyFolder?: () => string;
}

export class JourneyBuilderSidebar extends ItemView {
	private readonly eventBus: IEventBus;
	private readonly getEventCatalog: (() => EventSuggestItem[]) | undefined;
	private readonly getCommands: (() => { id: string; label: string; domain: string }[]) | undefined;
	private readonly getJourneyFolder: (() => string) | undefined;
	private state: SidebarState = "welcome";
	private metadata: JourneyMetadata = { name: "", description: "", startEvent: "", endEvent: "" };
	private steps: JourneyStep[] = [];
	private currentStepIndex = 0;
	private selectedActionIndex = -1;
	private showToolPicker = false;
	private showTemplatePicker = false;
	private jsonPanel: JSONPanel | null = null;
	private activeSetupForm: SetupForm | null = null;
	private suggestCleanups: (() => void)[] = [];
	private canvasSync: CanvasSyncController | null = null;
	private unsubCanvasSynced: (() => void) | undefined;
	private unsubImported: (() => void) | undefined;
	private unsubImportFailed: (() => void) | undefined;
	private unsubCanvasChanged: (() => void) | undefined;
	private updatingFromCanvas = false;

	constructor(leaf: WorkspaceLeaf, deps: JourneyBuilderSidebarDeps) {
		super(leaf);
		this.eventBus = deps.eventBus;
		this.getEventCatalog = deps.getEventCatalog;
		this.getCommands = deps.getCommands;
		this.getJourneyFolder = deps.getJourneyFolder;
	}

	private journeyFolder(): string {
		return this.getJourneyFolder?.() ?? "03 - Resources/Journeys";
	}

	private getCanvasPath(): string {
		if (!this.metadata.name) return "";
		return `${this.journeyFolder()}/${this.metadata.name}/${this.metadata.name}.canvas`;
	}

	private findJourneyFiles(scope: "folder" | "vault" = "folder"): string[] {
		const files = this.app?.vault?.getFiles() ?? [];
		const journeyFiles = files.filter((f) =>
			f.path.endsWith(".journey") || f.path.endsWith(".canvas"),
		);
		if (scope === "vault") return journeyFiles.map((f) => f.path);
		const folder = this.journeyFolder();
		return journeyFiles.filter((f) => f.path.startsWith(folder + "/")).map((f) => f.path);
	}

	private async filterJourneyCanvases(paths: string[]): Promise<string[]> {
		const vault = this.app?.vault;
		if (!vault) return paths.filter((p) => !p.endsWith(".canvas"));
		const results: string[] = [];
		for (const path of paths) {
			if (!path.endsWith(".canvas")) { results.push(path); continue; }
			try {
				const file = vault.getAbstractFileByPath(path);
				if (!file || !("extension" in file)) continue;
				const raw = await vault.cachedRead(file as import("obsidian").TFile);
				const canvas = JSON.parse(raw) as import("obsidian/canvas").CanvasData;
				if (isJourneyCanvas(canvas)) results.push(path);
			} catch { /* Skip unreadable/unparseable canvas files */ }
		}
		return results;
	}

	private ensureCanvasSync(): CanvasSyncController {
		if (!this.canvasSync) {
			this.canvasSync = new CanvasSyncController({
				eventBus: this.eventBus,
				getCanvasPath: () => this.getCanvasPath(),
				buildSyncInput: () => this.buildCanvasSyncInput(),
				getApp: () => this.app,
				onStepSelected: (stepIndex) => this.onStepSelectedOnCanvas(stepIndex),
			});
		}
		return this.canvasSync;
	}

	/** Build handler context for delegated event handlers. */
	private ctx(): SidebarContext {
		return {
			app: this.app,
			eventBus: this.eventBus,
			metadata: this.metadata,
			steps: this.steps,
			currentStepIndex: this.currentStepIndex,
			selectedActionIndex: this.selectedActionIndex,
			showToolPicker: this.showToolPicker,
			showTemplatePicker: this.showTemplatePicker,
			updatingFromCanvas: this.updatingFromCanvas,
			getCanvasPath: () => this.getCanvasPath(),
			journeyFolder: () => this.journeyFolder(),
			ensureCanvasSync: () => this.ensureCanvasSync(),
			buildCanvasSyncInput: () => this.buildCanvasSyncInput(),
			renderSteps: () => this.renderSteps(),
			renderSetup: () => this.renderSetup(),
			scheduleCanvasSync: (d) => this.scheduleCanvasSync(d),
			autoSaveDefinition: () => this.autoSaveDefinition(),
			setCanvasSyncing: (v) => this.setCanvasSyncing(v),
			setBgSyncing: (v) => this.setBgSyncing(v),
			buildDefinition: () => this.buildDefinition(),
			getJsonPanel: () => this.jsonPanel,
			setSteps: (s) => { this.steps = s; },
			setCurrentStepIndex: (i) => { this.currentStepIndex = i; },
			setSelectedActionIndex: (i) => { this.selectedActionIndex = i; },
			setShowToolPicker: (v) => { this.showToolPicker = v; },
			setShowTemplatePicker: (v) => { this.showTemplatePicker = v; },
		};
	}

	getViewType(): string { return VIEW_TYPE_JOURNEY_BUILDER; }
	getDisplayText(): string { return "Journey builder"; }
	getIcon(): string { return "route"; }

	async onOpen(): Promise<void> {
		this.unsubCanvasSynced = this.eventBus.on(
			"journey-builder.canvas.synced",
			(event) => { this.ensureCanvasSync().onSynced(event.payload); this.setBgSyncing(false); this.setCanvasSyncing(false); },
		);
		this.unsubImported = this.eventBus.on(
			"journey-builder.imported",
			(event) => this.loadJourneyFromJSON(event.payload.json),
		);
		this.unsubImportFailed = this.eventBus.on("journey-builder.import-failed", () => this.renderWelcome());
		this.unsubCanvasChanged = this.eventBus.on(
			"journey-builder.canvas.changed",
			(event) => this.onCanvasChanged(event.payload),
		);
		this.renderWelcome();
	}

	async onClose(): Promise<void> {
		this.destroySetupForm();
		this.cleanupSuggests();
		this.canvasSync?.destroy();
		this.canvasSync = null;
		this.unsubCanvasSynced?.(); this.unsubCanvasSynced = undefined;
		this.unsubImported?.(); this.unsubImported = undefined;
		this.unsubImportFailed?.(); this.unsubImportFailed = undefined;
		this.unsubCanvasChanged?.(); this.unsubCanvasChanged = undefined;
	}

	// ── Public accessors (for testing) ──────────────────────
	getSidebarState(): SidebarState { return this.state; }
	getMetadata(): JourneyMetadata { return { ...this.metadata }; }
	getSteps(): JourneyStep[] { return this.steps.map((s) => ({ ...s })); }
	getEndEvent(): string { return this.metadata.endEvent; }
	getCurrentStepIndex(): number { return this.currentStepIndex; }
	getSelectedActionIndex(): number { return this.selectedActionIndex; }

	buildDefinition(): {
		journey: string; description: string; startEvent: string; endEvent: string;
		steps: { id: string; title: string; description: string; swimlane: string; guideSection: number; actions: JourneyAction[]; events: string[]; commands: string[]; interactions: string[]; components: string[]; backgroundImage: string }[];
	} {
		return {
			journey: this.metadata.name,
			description: this.metadata.description,
			startEvent: this.metadata.startEvent,
			endEvent: this.metadata.endEvent,
			steps: this.steps.map((s, i) => ({
				id: s.id, title: s.title, description: s.description, swimlane: s.swimlane,
				guideSection: i + 1, actions: s.actions,
				events: s.events ?? [], commands: s.commands ?? [],
				interactions: s.interactions ?? [], components: s.components ?? [],
				backgroundImage: s.backgroundImage ?? "",
			})),
		};
	}

	// ── Render: Welcome ──────────────────────────────────────
	private renderWelcome(): void {
		this.state = "welcome";
		this.metadata = { name: "", description: "", startEvent: "", endEvent: "" };
		this.steps = [];
		this.currentStepIndex = 0;
		this.selectedActionIndex = -1;
		this.showToolPicker = false;
		this.showTemplatePicker = false;
		this.canvasSync?.resetCanvasPath();
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");
		renderHeader(el);
		const container = el.createDiv();
		new WelcomeScreen(container, {
			hasExistingJourneys: this.findJourneyFiles("folder").length > 0,
			onCreateNew: () => { void this.eventBus.emit("journey-builder.create-new", {}); this.renderSetup(); },
			onOpenExisting: () => this.onOpenExisting(),
			onImportFromSystem: () => this.importFromSystem(),
		}).render();
	}

	// ── Render: Setup form ───────────────────────────────────
	private destroySetupForm(): void { this.activeSetupForm?.destroy(); this.activeSetupForm = null; }
	private cleanupSuggests(): void { for (const cleanup of this.suggestCleanups) cleanup(); this.suggestCleanups = []; }

	private renderSetup(): void {
		this.destroySetupForm();
		this.state = "setup";
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");
		renderHeader(el);
		const backRow = el.createDiv({ cls: "ft-jb-back-row" });
		renderBackButton(backRow, () => this.renderWelcome());
		renderToolbarButton(backRow, "jb-proceed-btn", "arrow-right", "Continue to steps", () => this.onContinue());
		const formContainer = el.createDiv();
		this.activeSetupForm = new SetupForm(formContainer, {
			metadata: this.metadata,
			onFieldChanged: (field, value) => void this.eventBus.emit("journey-builder.metadata.updated", { field, value }),
			onContinue: () => this.onContinue(),
			getEventCatalog: this.getEventCatalog,
		});
		this.activeSetupForm.render();
	}

	// ── Render: Step editor ──────────────────────────────────
	private renderSteps(): void {
		this.destroySetupForm();
		this.cleanupSuggests();
		this.state = "steps";
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");
		const deps = this.stepRendererDeps();
		renderStepsHeader(el, deps);
		renderStepsNavigation(el, deps);
		renderStepsContent(el, deps);
		this.jsonPanel = renderJsonPanel(el, deps);
	}

	private stepRendererDeps(): StepRendererDeps {
		return {
			metadata: this.metadata, steps: this.steps,
			currentStepIndex: this.currentStepIndex, selectedActionIndex: this.selectedActionIndex,
			showToolPicker: this.showToolPicker, showTemplatePicker: this.showTemplatePicker,
			getEventCatalog: this.getEventCatalog, getCommands: this.getCommands,
			getCanvasPath: () => this.getCanvasPath(), ctx: () => this.ctx(),
			renderSetup: () => this.renderSetup(), renderSteps: () => this.renderSteps(),
			setBgSyncing: (v) => this.setBgSyncing(v), buildDefinition: () => this.buildDefinition(),
			openCanvasPath: () => void this.app?.workspace?.openLinkText(this.getCanvasPath(), ""),
		};
	}

	// ── Event handlers (non-delegated) ──────────────────────
	private onOpenExisting(): void {
		void this.eventBus.emit("journey-builder.open-existing", {});
		if (!this.app) return;
		const candidates = this.findJourneyFiles("vault");
		if (candidates.length === 0) { void this.eventBus.emit("notice.show", { message: "No journey or canvas files found" }); return; }
		const card = this.contentEl.querySelector<HTMLElement>('[data-test-id="jb-open-existing"]')
			?? this.contentEl.querySelector<HTMLElement>('[data-test-id="jb-import-link"]');
		this.setCardLoading(card, true);
		void this.filterJourneyCanvases(candidates).then((paths) => {
			this.setCardLoading(card, false);
			if (paths.length === 0) { void this.eventBus.emit("notice.show", { message: "No journey or canvas files found" }); return; }
			if (!this.app) return;
			new JourneyPickerModal(this.app, paths, (path) => {
				this.renderLoadingState("Loading journey\u2026");
				void this.eventBus.emit("journey-builder.import-requested", { path });
			}).open();
		});
	}

	private setCardLoading(el: HTMLElement | null, loading: boolean): void {
		setElementLoading(el, "ft-jb-card-loading", loading);
	}

	private setBgSyncing(syncing: boolean): void {
		setElementLoading(this.contentEl.querySelector<HTMLElement>('[data-test-id="jb-step-bg"]'), "ft-jb-bg-syncing", syncing);
	}

	private setCanvasSyncing(syncing: boolean): void {
		setCanvasSyncStatus(this.contentEl, syncing);
	}

	private importFromSystem(): void {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const { remote } = require("electron");
			void (remote.dialog.showOpenDialog(remote.getCurrentWindow(), {
				filters: [{ name: "Journey JSON", extensions: ["json"] }],
				properties: ["openFile"],
			}) as Promise<{ canceled: boolean; filePaths: string[] }>).then((result) => {
				if (result.canceled || result.filePaths.length === 0) return;
				try {
					// eslint-disable-next-line @typescript-eslint/no-require-imports
					const fs = require("fs");
					const json = fs.readFileSync(result.filePaths[0], "utf-8") as string;
					this.renderLoadingState("Loading journey\u2026");
					void this.eventBus.emit("journey-builder.imported", { json });
				} catch (err) { console.error("[JourneyBuilder] Failed to read file:", err); }
			});
		} catch { /* Electron remote not available */ }
	}

	private renderLoadingState(message: string): void {
		const el = this.contentEl; el.empty(); el.addClass("ft-jb-sidebar"); renderHeader(el); renderLoading(el, message);
	}

	loadJourneyFromJSON(json: string): void {
		try {
			const data = JSON.parse(json) as Record<string, unknown>;
			const steps = Array.isArray(data.steps) ? data.steps : [];
			this.metadata = {
				name: (data.journey as string) ?? "", description: (data.description as string) ?? "",
				startEvent: (data.startEvent as string) ?? (steps[0]?.events as string[])?.[0] ?? "",
				endEvent: (data.endEvent as string) ?? "",
			};
			this.steps = steps.map((s: Record<string, unknown>) => ({
				id: (s.id as string) ?? nextStepId(),
				title: (s.title as string) ?? "", description: (s.description as string) ?? "",
				swimlane: (s.swimlane as string) ?? "",
				actions: (Array.isArray(s.actions) ? s.actions : []) as JourneyAction[],
				backgroundImage: (s.backgroundImage as string) || undefined,
			}));
			this.currentStepIndex = 0;
			this.selectedActionIndex = -1;
			this.showToolPicker = false;
			this.showTemplatePicker = false;
			this.canvasSync?.resetCanvasPath();
			this.renderSteps();
			this.scheduleCanvasSync();
			this.autoSaveDefinition();
			const stepCount = this.steps.length;
			void this.eventBus.emit("notice.success", {
				message: `Loaded "${this.metadata.name}" (${stepCount} step${stepCount !== 1 ? "s" : ""})`,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			void this.eventBus.emit("notice.error", { message: `Failed to load journey: ${message}` });
			this.renderWelcome();
		}
	}

	private onContinue(): void { this.renderSteps(); this.scheduleCanvasSync(); this.autoSaveDefinition(); }

	private autoSaveDefinition(): void {
		if (!this.metadata.name) return;
		const subfolder = `${this.journeyFolder()}/${this.metadata.name}`;
		const filePath = `${subfolder}/${this.metadata.name}.journey`;
		void this.eventBus.emit("journey-builder.exported", { path: filePath, definition: this.buildDefinition() });
	}

	private onStepSelectedOnCanvas(stepIndex: number): void {
		if (this.state !== "steps") return;
		if (stepIndex === this.currentStepIndex) return;
		if (stepIndex < 0 || stepIndex >= this.steps.length) return;
		this.currentStepIndex = stepIndex;
		this.ensureCanvasSync().setPendingZoom();
		this.renderSteps();
		this.scheduleCanvasSync(300);
	}

	// ── Canvas sync ─────────────────────────────────────────
	private scheduleCanvasSync(delay?: number): void {
		if (this.updatingFromCanvas) return;
		this.setCanvasSyncing(true);
		this.ensureCanvasSync().scheduleSync(delay);
	}

	private onCanvasChanged(payload: ParsedJourneyCanvas & { canvasPath: string }): void {
		if (this.state !== "steps") return;
		if (payload.canvasPath !== this.getCanvasPath()) return;
		this.updatingFromCanvas = true;
		try {
			this.metadata.startEvent = payload.startEvent;
			this.metadata.endEvent = payload.endEvent;
			this.steps = payload.steps.map((cs, i) => {
				const existing = this.steps[i];
				if (existing) {
					return { ...existing, title: cs.title, description: cs.description, backgroundImage: cs.backgroundImage ?? existing.backgroundImage };
				}
				return { id: nextStepId(), title: cs.title, description: cs.description, swimlane: "", actions: [], backgroundImage: cs.backgroundImage };
			});
			if (this.currentStepIndex >= this.steps.length) this.currentStepIndex = Math.max(0, this.steps.length - 1);
			this.renderSteps();
			this.autoSaveDefinition();
		} finally { this.updatingFromCanvas = false; }
	}

	private buildCanvasSyncInput(): import("../../domain/journeyBuilder/canvasSync").CanvasSyncInput {
		return {
			journey: this.metadata.name, description: this.metadata.description,
			startEvent: this.metadata.startEvent, endEvent: this.metadata.endEvent,
			activeStepIndex: this.currentStepIndex,
			steps: this.steps.map((s) => ({ id: s.id, title: s.title, description: s.description, actions: s.actions, backgroundImage: s.backgroundImage })),
		};
	}
}
