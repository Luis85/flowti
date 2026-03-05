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
import { ItemView, FuzzySuggestModal, setIcon } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { JourneyAction, JourneyToolName } from "../../domain/journeyBuilder/types";
import { TOOL_SCHEMAS } from "../../domain/journeyBuilder/toolSchemas";
import type { EventSuggestItem } from "./EventSuggestTypes";
import { NavBar } from "./NavBar";
import { StepCard } from "./StepCard";
import { JSONPanel } from "./JSONPanel";
import { ActionList } from "./ActionList";
import { ToolPicker } from "./ToolPicker";
import { ActionForm } from "./ActionForm";
import { TemplatePicker } from "./TemplatePicker";
import { ACTION_TEMPLATES } from "../../domain/journeyBuilder/types";
import { WelcomeScreen } from "./WelcomeScreen";
import { SetupForm } from "./SetupForm";
import { CanvasSyncController } from "./CanvasSyncController";
import { renderHeader, renderBackButton, renderLoading } from "./sidebarHelpers";
import { isJourneyCanvas, type ParsedJourneyCanvas } from "../../domain/journeyBuilder/canvasParser";
import { runPreview } from "../../domain/journeyBuilder/previewRunner";

export const VIEW_TYPE_JOURNEY_BUILDER = "flowti-journey-builder";

/** Sidebar view state: welcome (landing), setup (metadata form), or steps (step editor). */
export type SidebarState = "welcome" | "setup" | "steps";

/** Adapter-based journey file picker — groups .journey and .canvas files. */
class JourneyPickerModal extends FuzzySuggestModal<string> {
	private paths: string[];
	private onChoosePath: (path: string) => void;

	constructor(app: App, paths: string[], onChoose: (path: string) => void) {
		super(app);
		// Sort: .journey files first, .canvas second — groups by type
		this.paths = [...paths].sort((a, b) => {
			const aIsCanvas = a.endsWith(".canvas") ? 1 : 0;
			const bIsCanvas = b.endsWith(".canvas") ? 1 : 0;
			return aIsCanvas - bIsCanvas || a.localeCompare(b);
		});
		this.onChoosePath = onChoose;
	}

	getItems(): string[] { return this.paths; }
	getItemText(item: string): string { return item.split("/").pop() ?? item; }
	onChooseItem(item: string): void { this.onChoosePath(item); }

	renderSuggestion(match: import("obsidian").FuzzyMatch<string>, el: HTMLElement): void {
		el.empty();
		el.addClass("ft-jb-picker-item");
		const isCanvas = match.item.endsWith(".canvas");

		// Top row: badge + filename
		const row = el.createDiv({ cls: "ft-jb-picker-row" });
		const badge = row.createSpan({ cls: "ft-jb-picker-badge" });
		badge.textContent = isCanvas ? "Canvas" : "Journey";
		badge.dataset.type = isCanvas ? "canvas" : "journey";
		const fileName = match.item.split("/").pop() ?? match.item;
		row.createSpan({ cls: "ft-jb-picker-name", text: fileName });

		// Subtitle: folder path
		const parts = match.item.split("/");
		if (parts.length > 1) {
			el.createDiv({ cls: "ft-jb-picker-path", text: parts.slice(0, -1).join("/") });
		}
	}
}

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

/** File picker filtered to image files. */
class ImagePickerModal extends FuzzySuggestModal<string> {
	private paths: string[];
	private onChoosePath: (path: string) => void;

	constructor(app: App, paths: string[], onChoose: (path: string) => void) {
		super(app);
		this.paths = paths;
		this.onChoosePath = onChoose;
		this.setPlaceholder("Search images…");
	}

	getItems(): string[] { return this.paths; }
	getItemText(item: string): string { return item.split("/").pop() ?? item; }
	onChooseItem(item: string): void { this.onChoosePath(item); }
}

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

let stepCounter = 0;

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

	/** Returns .journey and .canvas file paths from the vault's in-memory index. */
	private findJourneyFiles(scope: "folder" | "vault" = "folder"): string[] {
		const files = this.app?.vault?.getFiles() ?? [];
		const journeyFiles = files.filter((f) =>
			f.path.endsWith(".journey") || f.path.endsWith(".canvas"),
		);
		if (scope === "vault") return journeyFiles.map((f) => f.path);
		const folder = this.journeyFolder();
		return journeyFiles.filter((f) => f.path.startsWith(folder + "/")).map((f) => f.path);
	}

	/** Filters canvas files to only include journey canvases (has START + END nodes). */
	private async filterJourneyCanvases(paths: string[]): Promise<string[]> {
		const vault = this.app?.vault;
		if (!vault) return paths.filter((p) => !p.endsWith(".canvas"));
		const results: string[] = [];
		for (const path of paths) {
			if (!path.endsWith(".canvas")) {
				results.push(path);
				continue;
			}
			try {
				const file = vault.getAbstractFileByPath(path);
				if (!file || !("extension" in file)) continue;
				const raw = await vault.cachedRead(file as import("obsidian").TFile);
				const canvas = JSON.parse(raw) as import("obsidian/canvas").CanvasData;
				if (isJourneyCanvas(canvas)) results.push(path);
			} catch {
				// Skip unreadable/unparseable canvas files
			}
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
			});
		}
		return this.canvasSync;
	}

	getViewType(): string {
		return VIEW_TYPE_JOURNEY_BUILDER;
	}

	getDisplayText(): string {
		return "Journey builder";
	}

	getIcon(): string {
		return "route";
	}

	async onOpen(): Promise<void> {
		this.unsubCanvasSynced = this.eventBus.on(
			"journey-builder.canvas.synced",
			(event) => {
				this.ensureCanvasSync().onSynced(event.payload);
				this.setBgSyncing(false);
				this.setCanvasSyncing(false);
			},
		);
		this.unsubImported = this.eventBus.on(
			"journey-builder.imported",
			(event) => this.loadJourneyFromJSON(event.payload.json),
		);
		this.unsubImportFailed = this.eventBus.on(
			"journey-builder.import-failed",
			() => this.renderWelcome(),
		);
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
		this.unsubCanvasSynced?.();
		this.unsubCanvasSynced = undefined;
		this.unsubImported?.();
		this.unsubImported = undefined;
		this.unsubImportFailed?.();
		this.unsubImportFailed = undefined;
		this.unsubCanvasChanged?.();
		this.unsubCanvasChanged = undefined;
	}

	// ── Public accessors (for testing) ──────────────────────

	getSidebarState(): SidebarState {
		return this.state;
	}

	getMetadata(): JourneyMetadata {
		return { ...this.metadata };
	}

	getSteps(): JourneyStep[] {
		return this.steps.map((s) => ({ ...s }));
	}

	getEndEvent(): string {
		return this.metadata.endEvent;
	}

	getCurrentStepIndex(): number {
		return this.currentStepIndex;
	}

	getSelectedActionIndex(): number {
		return this.selectedActionIndex;
	}

	/** Builds the journey definition from current state (reusable by JSONPanel and export). */
	buildDefinition(): {
		journey: string;
		description: string;
		startEvent: string;
		endEvent: string;
		steps: { id: string; title: string; description: string; swimlane: string; guideSection: number; actions: JourneyAction[]; events: string[]; commands: string[]; interactions: string[]; components: string[]; backgroundImage: string }[];
	} {
		return {
			journey: this.metadata.name,
			description: this.metadata.description,
			startEvent: this.metadata.startEvent,
			endEvent: this.metadata.endEvent,
			steps: this.steps.map((s, i) => ({
				id: s.id,
				title: s.title,
				description: s.description,
				swimlane: s.swimlane,
				guideSection: i + 1,
				actions: s.actions,
				events: s.events ?? [],
				commands: s.commands ?? [],
				interactions: s.interactions ?? [],
				components: s.components ?? [],
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

		const journeyFiles = this.findJourneyFiles("folder");
		const container = el.createDiv();
		new WelcomeScreen(container, {
			hasExistingJourneys: journeyFiles.length > 0,
			onCreateNew: () => this.onCreateNew(),
			onOpenExisting: () => this.onOpenExisting(),
			onImportFromSystem: () => this.importFromSystem(),
		}).render();
	}

	// ── Render: Setup form ───────────────────────────────────

	private destroySetupForm(): void {
		this.activeSetupForm?.destroy();
		this.activeSetupForm = null;
	}

	private cleanupSuggests(): void {
		for (const cleanup of this.suggestCleanups) cleanup();
		this.suggestCleanups = [];
	}

	private renderSetup(): void {
		this.destroySetupForm();
		this.state = "setup";
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");

		renderHeader(el);

		// Back row with proceed button
		const backRow = el.createDiv({ cls: "ft-jb-back-row" });
		renderBackButton(backRow, () => this.renderWelcome());
		this.renderToolbarButton(backRow, "jb-proceed-btn", "arrow-right", "Continue to steps", () => this.onContinue());

		const formContainer = el.createDiv();
		this.activeSetupForm = new SetupForm(formContainer, {
			metadata: this.metadata,
			onFieldChanged: (field, value) => this.emitMetadataUpdate(field, value),
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

		// Header with toolbar actions on the right
		const header = el.createDiv({ cls: "ft-jb-header" });
		const headerLeft = header.createDiv({ cls: "ft-jb-header-left" });
		const iconEl = headerLeft.createSpan({ cls: "ft-jb-header-icon" });
		setIcon(iconEl, "route");
		const titleEl = headerLeft.createSpan({ cls: "ft-jb-header-title", text: "Journey builder" });
		titleEl.dataset.testId = "jb-header-title";

		const toolbar = header.createDiv({ cls: "ft-jb-header-toolbar" });
		toolbar.dataset.testId = "jb-header-toolbar";
		if (this.metadata.name) {
			this.renderToolbarButton(toolbar, "jb-open-canvas-btn", "layout-dashboard", "Open canvas", () => this.onOpenCanvas());
		}
		if (this.steps.length > 0) {
			this.renderToolbarButton(toolbar, "jb-preview-btn", "play", "Preview run", () => void this.onPreviewRun());
		}
		this.renderToolbarButton(toolbar, "jb-export-btn", "download", "Export", () => this.onExport());

		// Back button row with canvas status indicator
		const backRow = el.createDiv({ cls: "ft-jb-back-row" });
		renderBackButton(backRow, () => this.renderSetup());
		const canvasStatus = backRow.createDiv({ cls: "ft-jb-canvas-status" });
		canvasStatus.dataset.testId = "jb-canvas-status";

		// NavBar — step navigation
		const navContainer = el.createDiv({ cls: "ft-jb-nav-container" });
		new NavBar(navContainer, {
			stepCount: this.steps.length,
			currentIndex: this.currentStepIndex,
			onPrev: () => this.onNavPrev(),
			onNext: () => this.onNavNext(),
			onAddStep: () => this.onAddStep(),
			onSetup: () => this.renderSetup(),
		}).render();

		// StepCard — active step (or empty state)
		const stepContainer = el.createDiv({ cls: "ft-jb-step-container" });
		if (this.steps.length > 0) {
			const step = this.steps[this.currentStepIndex];
			new StepCard(stepContainer, {
				step,
				stepNumber: this.currentStepIndex + 1,
				actionCount: step.actions.length,
				onTitleChanged: (title) => this.onStepFieldChanged(step.id, "title", title),
				onDescriptionChanged: (desc) => this.onStepFieldChanged(step.id, "description", desc),
				onSwimlanChanged: (sw) => this.onStepFieldChanged(step.id, "swimlane", sw),
				onEventsChanged: (items) => this.onStepListChanged(step.id, "events", items),
				onCommandsChanged: (items) => this.onStepListChanged(step.id, "commands", items),
				onInteractionsChanged: (items) => this.onStepListChanged(step.id, "interactions", items),
				onComponentsChanged: (items) => this.onStepListChanged(step.id, "components", items),
				onRemove: () => this.onRemoveStep(step.id),
				onBackgroundImageRequested: () => this.onBackgroundImageRequested(step.id),
				onBackgroundImageRemoved: () => {
					this.onStepFieldChanged(step.id, "backgroundImage", "");
					this.renderSteps();
					this.setBgSyncing(true);
				},
			}).render();

			// ActionList — actions for this step
			const actionContainer = el.createDiv({ cls: "ft-jb-action-container" });
			new ActionList(actionContainer, {
				actions: step.actions,
				selectedIndex: this.selectedActionIndex,
				onAddAction: () => this.onAddAction(),
				onRemoveAction: (i) => this.onRemoveAction(i),
				onMoveAction: (i, dir) => this.onMoveAction(i, dir),
				onSelectAction: (i) => this.onSelectAction(i),
			}).render();

			// TemplatePicker — shown first when "Add action" is clicked
			if (this.showTemplatePicker) {
				const tplContainer = el.createDiv({ cls: "ft-jb-picker-container" });
				new TemplatePicker(tplContainer, {
					onTemplateSelected: (id) => this.onTemplateSelected(id),
					onCustom: () => this.onCustomFromTemplate(),
				}).render();
			}

			// ToolPicker — shown after "Custom" is selected from template picker
			if (this.showToolPicker) {
				const pickerContainer = el.createDiv({ cls: "ft-jb-picker-container" });
				new ToolPicker(pickerContainer, {
					onToolSelected: (tool) => this.onToolSelected(tool),
				}).render();
			}

			// ActionForm — shown when an action is selected
			if (this.selectedActionIndex >= 0 && this.selectedActionIndex < step.actions.length) {
				const action = step.actions[this.selectedActionIndex];
				const schema = TOOL_SCHEMAS[action.tool];
				if (schema) {
					const formContainer = el.createDiv({ cls: "ft-jb-form-container" });
					new ActionForm(formContainer, {
						action,
						schema,
						onFieldChanged: (key, value) => this.onActionFieldChanged(key, value),
						getEventCatalog: this.getEventCatalog,
						getCommands: this.getCommands,
						onReRender: () => this.renderSteps(),
					}).render();
				}
			}
		} else {
			const empty = stepContainer.createDiv({ cls: "ft-jb-empty-state" });
			empty.dataset.testId = "jb-empty-steps";
			empty.textContent = "No steps yet. Click \"Add step\" to begin."; // eslint-disable-line obsidianmd/ui/sentence-case -- button name
		}

		// JSONPanel — collapsible preview (last element)
		const jsonContainer = el.createDiv({ cls: "ft-jb-json-container" });
		this.jsonPanel = new JSONPanel(jsonContainer, {
			getJSON: () => JSON.stringify(this.buildDefinition(), null, "\t"),
		});
		this.jsonPanel.render();
	}

	// ── Event handlers ───────────────────────────────────────

	private onOpenExisting(): void {
		void this.eventBus.emit("journey-builder.open-existing", {});
		if (!this.app) return;
		const candidates = this.findJourneyFiles("vault");
		if (candidates.length === 0) {
			void this.eventBus.emit("notice.show", { message: "No journey or canvas files found" });
			return;
		}
		const card = this.contentEl.querySelector<HTMLElement>('[data-test-id="jb-open-existing"]')
			?? this.contentEl.querySelector<HTMLElement>('[data-test-id="jb-import-link"]');
		this.setCardLoading(card, true);
		void this.filterJourneyCanvases(candidates).then((paths) => {
			this.setCardLoading(card, false);
			if (paths.length === 0) {
				void this.eventBus.emit("notice.show", { message: "No journey or canvas files found" });
				return;
			}
			if (!this.app) return;
			new JourneyPickerModal(this.app, paths, (path) => {
				this.renderLoadingState("Loading journey\u2026");
				void this.eventBus.emit("journey-builder.import-requested", { path });
			}).open();
		});
	}

	/** Toggle loading indicator on a welcome card or import link. */
	private setCardLoading(el: HTMLElement | null, loading: boolean): void {
		if (!el) return;
		if (loading) {
			el.classList.add("ft-jb-card-loading");
			el.setAttribute("aria-busy", "true");
		} else {
			el.classList.remove("ft-jb-card-loading");
			el.removeAttribute("aria-busy");
		}
	}

	/** Toggle sync indicator on the background image section. */
	private setBgSyncing(syncing: boolean): void {
		const el = this.contentEl.querySelector<HTMLElement>('[data-test-id="jb-step-bg"]');
		if (!el) return;
		if (syncing) {
			el.classList.add("ft-jb-bg-syncing");
			el.setAttribute("aria-busy", "true");
		} else {
			el.classList.remove("ft-jb-bg-syncing");
			el.removeAttribute("aria-busy");
		}
	}

	/** Toggle canvas sync status indicator in the step editor. */
	private setCanvasSyncing(syncing: boolean): void {
		const el = this.contentEl.querySelector<HTMLElement>('[data-test-id="jb-canvas-status"]');
		if (!el) return;
		if (syncing) {
			el.classList.add("ft-jb-canvas-syncing");
			el.setAttribute("aria-busy", "true");
		} else {
			el.classList.remove("ft-jb-canvas-syncing");
			el.classList.add("ft-jb-canvas-ready");
			el.removeAttribute("aria-busy");
			setTimeout(() => el.classList.remove("ft-jb-canvas-ready"), 2000);
		}
	}

	/** Renders a compact icon-only toolbar button with tooltip. */
	private renderToolbarButton(
		container: HTMLElement, testId: string, icon: string, tooltip: string, onClick: () => void,
	): void {
		const btn = container.createSpan({ cls: "ft-jb-toolbar-btn" });
		btn.dataset.testId = testId;
		btn.setAttribute("role", "button");
		btn.setAttribute("tabindex", "0");
		btn.setAttribute("aria-label", tooltip);
		btn.title = tooltip;
		setIcon(btn, icon);
		btn.addEventListener("click", onClick);
		btn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
		});
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
				} catch (err) {
					console.error("[JourneyBuilder] Failed to read file:", err);
				}
			});
		} catch {
			// Electron remote not available
		}
	}

	private renderLoadingState(message: string): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");
		renderHeader(el);
		renderLoading(el, message);
	}

	/** Loads a journey definition from a JSON string into the sidebar state. */
	loadJourneyFromJSON(json: string): void {
		try {
			const data = JSON.parse(json) as Record<string, unknown>;
			const steps = Array.isArray(data.steps) ? data.steps : [];
			this.metadata = {
				name: (data.journey as string) ?? "",
				description: (data.description as string) ?? "",
				startEvent: (data.startEvent as string)
					?? (steps[0]?.events as string[])?.[0]
					?? "",
				endEvent: (data.endEvent as string) ?? "",
			};
			this.steps = steps.map((s: Record<string, unknown>) => ({
				id: (s.id as string) ?? `step-${++stepCounter}`,
				title: (s.title as string) ?? "",
				description: (s.description as string) ?? "",
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
			void this.eventBus.emit("notice.error", {
				message: `Failed to load journey: ${message}`,
			});
			this.renderWelcome();
		}
	}

	private onCreateNew(): void {
		void this.eventBus.emit("journey-builder.create-new", {});
		this.renderSetup();
	}

	private onContinue(): void {
		this.renderSteps();
		this.scheduleCanvasSync();
		this.autoSaveDefinition();
	}

	/** Auto-saves the journey definition JSON (without test/canvas files). */
	private autoSaveDefinition(): void {
		if (!this.metadata.name) return;
		const subfolder = `${this.journeyFolder()}/${this.metadata.name}`;
		const filePath = `${subfolder}/${this.metadata.name}.journey`;
		void this.eventBus.emit("journey-builder.exported", {
			path: filePath,
			definition: this.buildDefinition(),
		});
	}

	private onNavPrev(): void {
		if (this.currentStepIndex > 0) {
			this.currentStepIndex--;
			this.ensureCanvasSync().setPendingZoom();
			this.renderSteps();
			this.scheduleCanvasSync(300);
		}
	}

	private onNavNext(): void {
		if (this.currentStepIndex < this.steps.length - 1) {
			this.currentStepIndex++;
			this.ensureCanvasSync().setPendingZoom();
			this.renderSteps();
			this.scheduleCanvasSync(300);
		}
	}

	private onAddStep(): void {
		const id = `step-${++stepCounter}`;
		const step: JourneyStep = { id, title: "", description: "", swimlane: "", actions: [] };
		this.steps.push(step);
		this.currentStepIndex = this.steps.length - 1;
		this.ensureCanvasSync().setPendingZoom();
		void this.eventBus.emit("journey-builder.step.added", { stepId: id, title: "" });
		this.renderSteps();
		this.scheduleCanvasSync(300);
	}

	private onStepFieldChanged(stepId: string, field: string, value: string): void {
		const step = this.steps.find((s) => s.id === stepId);
		if (step) {
			(step as unknown as Record<string, unknown>)[field] = value;
			void this.eventBus.emit("journey-builder.step.updated", {
				stepId,
				field,
				value,
			});
			this.jsonPanel?.update();
			this.scheduleCanvasSync();
		}
	}

	private onBackgroundImageRequested(stepId: string): void {
		if (!this.app) return;
		const files = this.app.vault.getFiles().filter((f) =>
			IMAGE_EXTENSIONS.some((ext) => f.path.toLowerCase().endsWith(ext)),
		);
		if (files.length === 0) {
			void this.eventBus.emit("notice.show", { message: "No image files found in vault" });
			return;
		}
		new ImagePickerModal(this.app, files.map((f) => f.path), (path) => {
			this.onStepFieldChanged(stepId, "backgroundImage", path);
			this.renderSteps();
			this.setBgSyncing(true);
		}).open();
	}

	private onStepListChanged(stepId: string, field: string, items: string[]): void {
		const step = this.steps.find((s) => s.id === stepId);
		if (step) {
			(step as unknown as Record<string, unknown>)[field] = items;
			void this.eventBus.emit("journey-builder.step.updated", {
				stepId,
				field,
				value: items,
			});
			this.jsonPanel?.update();
			this.scheduleCanvasSync();
		}
	}

	private onRemoveStep(stepId: string): void {
		this.steps = this.steps.filter((s) => s.id !== stepId);
		if (this.currentStepIndex >= this.steps.length) {
			this.currentStepIndex = Math.max(0, this.steps.length - 1);
		}
		this.selectedActionIndex = -1;
		this.showToolPicker = false;
		this.showTemplatePicker = false;
		this.renderSteps();
		this.scheduleCanvasSync();
	}

	// ── Action handlers ─────────────────────────────────────

	private onAddAction(): void {
		this.showTemplatePicker = true;
		this.showToolPicker = false;
		this.selectedActionIndex = -1;
		this.renderSteps();
	}

	private onTemplateSelected(templateId: string): void {
		const step = this.steps[this.currentStepIndex];
		if (!step) return;
		const template = ACTION_TEMPLATES.find((t) => t.id === templateId);
		if (!template) return;
		const actions = template.actions.map((a) => ({ ...a }));
		step.actions.push(...actions);
		this.selectedActionIndex = step.actions.length - actions.length;
		this.showTemplatePicker = false;
		for (const a of actions) {
			void this.eventBus.emit("journey-builder.action.added", { stepId: step.id, tool: a.tool });
		}
		this.renderSteps();
		this.scheduleCanvasSync();
	}

	private onCustomFromTemplate(): void {
		this.showTemplatePicker = false;
		this.showToolPicker = true;
		this.renderSteps();
	}

	private onToolSelected(tool: JourneyToolName): void {
		const step = this.steps[this.currentStepIndex];
		if (!step) return;
		const action: JourneyAction = { tool };
		step.actions.push(action);
		this.selectedActionIndex = step.actions.length - 1;
		this.showToolPicker = false;
		void this.eventBus.emit("journey-builder.action.added", { stepId: step.id, tool });
		this.renderSteps();
		this.scheduleCanvasSync();
	}

	private onRemoveAction(index: number): void {
		const step = this.steps[this.currentStepIndex];
		if (!step) return;
		step.actions.splice(index, 1);
		if (this.selectedActionIndex >= step.actions.length) {
			this.selectedActionIndex = Math.max(-1, step.actions.length - 1);
		}
		this.renderSteps();
		this.scheduleCanvasSync();
	}

	private onMoveAction(fromIndex: number, direction: "up" | "down"): void {
		const step = this.steps[this.currentStepIndex];
		if (!step) return;
		const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
		if (toIndex < 0 || toIndex >= step.actions.length) return;
		const [moved] = step.actions.splice(fromIndex, 1);
		step.actions.splice(toIndex, 0, moved);
		if (this.selectedActionIndex === fromIndex) {
			this.selectedActionIndex = toIndex;
		}
		this.renderSteps();
	}

	private onSelectAction(index: number): void {
		this.selectedActionIndex = index;
		this.showToolPicker = false;
		this.showTemplatePicker = false;
		this.renderSteps();
	}

	private onActionFieldChanged(key: string, value: string | number): void {
		const step = this.steps[this.currentStepIndex];
		if (!step || this.selectedActionIndex < 0) return;
		const action = step.actions[this.selectedActionIndex];
		if (!action) return;
		if (key === "description") {
			action.description = String(value);
		} else {
			action[key] = value;
		}
		this.jsonPanel?.update();
		this.scheduleCanvasSync();
	}

	private onExport(): void {
		const name = this.metadata.name;
		const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
		const subfolder = `${this.journeyFolder()}/${name}`;
		const filePath = `${subfolder}/${name}.journey`;
		const testFilePath = `tests/e2e/90-journey-${slug}.test.ts`;
		const canvasPath = `${subfolder}/${name}.canvas`;
		const definition = this.buildDefinition();
		void this.eventBus.emit("journey-builder.exported", {
			path: filePath, testFilePath, canvasPath, definition,
		});
		void this.eventBus.emit("notice.success", {
			message: `Exported "${name}" — JSON, test file, and canvas`,
		});
	}

	private onOpenCanvas(): void {
		const canvasPath = this.getCanvasPath();
		void this.app?.workspace?.openLinkText(canvasPath, "");
	}

	private emitMetadataUpdate(field: string, value: string): void {
		void this.eventBus.emit("journey-builder.metadata.updated", { field, value });
	}

	// ── Canvas sync (delegated) ─────────────────────────────

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
					return {
						...existing,
						title: cs.title,
						description: cs.description,
						backgroundImage: cs.backgroundImage ?? existing.backgroundImage,
					};
				}
				return {
					id: `step-${++stepCounter}`,
					title: cs.title,
					description: cs.description,
					swimlane: "",
					actions: [],
					backgroundImage: cs.backgroundImage,
				};
			});

			if (this.currentStepIndex >= this.steps.length) {
				this.currentStepIndex = Math.max(0, this.steps.length - 1);
			}

			this.renderSteps();
			this.autoSaveDefinition();
		} finally {
			this.updatingFromCanvas = false;
		}
	}

	// ── Preview run ─────────────────────────────────────────

	private async onPreviewRun(): Promise<void> {
		if (this.steps.length === 0) return;

		const result = runPreview(this.steps);
		void this.eventBus.emit("journey-builder.preview.started", {
			stepCount: this.steps.length,
		});

		const stepColors: Record<number, string> = {};

		for (let i = 0; i < result.steps.length; i++) {
			const stepResult = result.steps[i];

			// Mark current step as running (cyan)
			stepColors[i] = "5";
			this.syncCanvasWithColors({ ...stepColors });

			await this.previewDelay(300);

			// Mark step with result color: green = pass, red = fail
			stepColors[i] = stepResult.status === "pass" ? "4" : "1";
			this.syncCanvasWithColors({ ...stepColors });

			void this.eventBus.emit("journey-builder.preview.step-completed", {
				stepIndex: stepResult.stepIndex,
				status: stepResult.status,
				errors: stepResult.errors,
			});
		}

		void this.eventBus.emit("journey-builder.preview.completed", {
			totalSteps: result.totalSteps,
			passed: result.passed,
			failed: result.failed,
		});

		const noticeType = result.failed === 0 ? "notice.success" : "notice.error";
		void this.eventBus.emit(noticeType as "notice.success", {
			message: `Preview: ${result.passed}/${result.totalSteps} steps passed${
				result.failed > 0 ? `, ${result.failed} failed` : ""
			}`,
		});
	}

	private syncCanvasWithColors(stepColors: Record<number, string>): void {
		const canvasPath = this.getCanvasPath();
		if (!canvasPath) return;
		const input = this.buildCanvasSyncInput();
		input.stepColors = stepColors;
		void this.eventBus.emit("journey-builder.canvas.sync-requested", {
			canvasPath,
			definition: input,
		});
	}

	private previewDelay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private buildCanvasSyncInput(): import("../../domain/journeyBuilder/canvasSync").CanvasSyncInput {
		return {
			journey: this.metadata.name,
			description: this.metadata.description,
			startEvent: this.metadata.startEvent,
			endEvent: this.metadata.endEvent,
			activeStepIndex: this.currentStepIndex,
			steps: this.steps.map((s) => ({
				id: s.id,
				title: s.title,
				description: s.description,
				actions: s.actions,
				backgroundImage: s.backgroundImage,
			})),
		};
	}
}
