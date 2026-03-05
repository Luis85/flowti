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
import { ItemView, FuzzySuggestModal } from "obsidian";
import type { App, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { JourneyAction, JourneyToolName } from "../../domain/journeyBuilder/types";
import { TOOL_SCHEMAS } from "../../domain/journeyBuilder/toolSchemas";
import { toEventName, isEventNameConverted } from "../../domain/journeyBuilder/eventNameUtils";
import type { EventSuggestItem } from "./EventSuggestTypes";
import { attachEventSuggest } from "./EventSuggest";
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
import { renderHeader, renderBackButton, renderActionButton, renderLoading } from "./sidebarHelpers";
import type { ParsedJourneyCanvas } from "../../domain/journeyBuilder/canvasParser";

export const VIEW_TYPE_JOURNEY_BUILDER = "flowti-journey-builder";

/** Sidebar view state: welcome (landing), setup (metadata form), or steps (step editor). */
export type SidebarState = "welcome" | "setup" | "steps";

/** Adapter-based journey file picker — works for .json files not indexed by vault. */
class JourneyPickerModal extends FuzzySuggestModal<string> {
	private paths: string[];
	private onChoosePath: (path: string) => void;

	constructor(app: App, paths: string[], onChoose: (path: string) => void) {
		super(app);
		this.paths = paths;
		this.onChoosePath = onChoose;
	}

	getItems(): string[] { return this.paths; }
	getItemText(item: string): string { return item.split("/").pop() ?? item; }
	onChooseItem(item: string): void { this.onChoosePath(item); }
}

export interface JourneyMetadata {
	name: string;
	description: string;
	startEvent: string;
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
	private metadata: JourneyMetadata = { name: "", description: "", startEvent: "" };
	private steps: JourneyStep[] = [];
	private endEvent = "";
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

	/** Returns .journey file paths from the vault's in-memory index. */
	private findJourneyFiles(scope: "folder" | "vault" = "folder"): string[] {
		const files = this.app?.vault?.getFiles() ?? [];
		const journeyFiles = files.filter((f) => f.path.endsWith(".journey"));
		if (scope === "vault") return journeyFiles.map((f) => f.path);
		const folder = this.journeyFolder();
		return journeyFiles.filter((f) => f.path.startsWith(folder + "/")).map((f) => f.path);
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
			(event) => this.ensureCanvasSync().onSynced(event.payload),
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
		return this.endEvent;
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
		steps: { id: string; title: string; description: string; swimlane: string; guideSection: number; actions: JourneyAction[]; events: string[]; commands: string[]; interactions: string[]; components: string[] }[];
	} {
		return {
			journey: this.metadata.name,
			description: this.metadata.description,
			startEvent: this.metadata.startEvent,
			endEvent: this.endEvent,
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
			})),
		};
	}

	// ── Render: Welcome ──────────────────────────────────────

	private renderWelcome(): void {
		this.state = "welcome";
		this.metadata = { name: "", description: "", startEvent: "" };
		this.steps = [];
		this.endEvent = "";
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
			onImportFile: () => this.onImportFile(),
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
		renderBackButton(el, () => this.renderWelcome());

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

		renderHeader(el);
		renderBackButton(el, () => this.renderSetup());

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

		// End event
		const endGroup = el.createDiv({ cls: "ft-jb-form-group ft-jb-end-event-group" });
		endGroup.createEl("label", { cls: "ft-jb-form-label", text: "End event" });
		const endInput = endGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		endInput.dataset.testId = "jb-end-event-input";
		endInput.placeholder = "e.g. Hub tab changed or hub.tab.changed"; // eslint-disable-line obsidianmd/ui/sentence-case
		endInput.value = this.endEvent;
		const endPreview = endGroup.createSpan({ cls: "ft-jb-event-preview" });
		endPreview.dataset.testId = "jb-end-event-preview";
		endInput.addEventListener("input", () => {
			const converted = toEventName(endInput.value);
			this.endEvent = converted;
			endPreview.textContent = isEventNameConverted(endInput.value, converted)
				? `\u2192 ${converted}`
				: "";
			this.emitMetadataUpdate("endEvent", converted);
			this.jsonPanel?.update();
			this.scheduleCanvasSync();
		});

		// Event autocomplete on end event
		if (this.getEventCatalog) {
			const unsub = attachEventSuggest(endInput, this.getEventCatalog, (value) => {
				this.endEvent = value;
				this.emitMetadataUpdate("endEvent", value);
				this.jsonPanel?.update();
			});
			this.suggestCleanups.push(unsub);
		}

		// JSONPanel — collapsible preview
		const jsonContainer = el.createDiv({ cls: "ft-jb-json-container" });
		this.jsonPanel = new JSONPanel(jsonContainer, {
			getJSON: () => JSON.stringify(this.buildDefinition(), null, "\t"),
		});
		this.jsonPanel.render();

		// Open canvas button (only when journey has a name)
		if (this.metadata.name) {
			renderActionButton(el, {
				testId: "jb-open-canvas-btn",
				cls: "ft-jb-open-canvas-btn",
				icon: "layout-dashboard",
				text: "Open canvas",
				onClick: () => this.onOpenCanvas(),
			});
		}

		// Export button
		renderActionButton(el, {
			testId: "jb-export-btn",
			cls: "ft-jb-export-btn",
			icon: "download",
			text: "Export journey",
			onClick: () => this.onExport(),
		});
	}

	// ── Event handlers ───────────────────────────────────────

	private onOpenExisting(): void {
		void this.eventBus.emit("journey-builder.open-existing", {});
		if (!this.app) return;
		const paths = this.findJourneyFiles("folder");
		if (paths.length === 0) return;
		new JourneyPickerModal(this.app, paths, (path) => {
			this.renderLoadingState("Loading journey\u2026");
			void this.eventBus.emit("journey-builder.import-requested", { path });
		}).open();
	}

	private onImportFile(): void {
		if (!this.app) return;
		const paths = this.findJourneyFiles("vault");
		if (paths.length === 0) {
			void this.eventBus.emit("notice.show", { message: "No .journey files found" });
			return;
		}
		new JourneyPickerModal(this.app, paths, (path) => {
			this.renderLoadingState("Loading journey\u2026");
			void this.eventBus.emit("journey-builder.import-requested", { path });
		}).open();
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
			};
			this.endEvent = (data.endEvent as string) ?? "";
			this.steps = steps.map((s: Record<string, unknown>) => ({
				id: (s.id as string) ?? `step-${++stepCounter}`,
				title: (s.title as string) ?? "",
				description: (s.description as string) ?? "",
				swimlane: (s.swimlane as string) ?? "",
				actions: (Array.isArray(s.actions) ? s.actions : []) as JourneyAction[],
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
		this.ensureCanvasSync().scheduleSync(delay);
	}

	private onCanvasChanged(payload: ParsedJourneyCanvas & { canvasPath: string }): void {
		if (this.state !== "steps") return;
		if (payload.canvasPath !== this.getCanvasPath()) return;

		this.updatingFromCanvas = true;
		try {
			this.metadata.startEvent = payload.startEvent;
			this.endEvent = payload.endEvent;

			this.steps = payload.steps.map((cs, i) => {
				const existing = this.steps[i];
				if (existing) {
					return { ...existing, title: cs.title, description: cs.description };
				}
				return {
					id: `step-${++stepCounter}`,
					title: cs.title,
					description: cs.description,
					swimlane: "",
					actions: [],
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

	private buildCanvasSyncInput() {
		return {
			journey: this.metadata.name,
			description: this.metadata.description,
			startEvent: this.metadata.startEvent,
			endEvent: this.endEvent,
			activeStepIndex: this.currentStepIndex,
			steps: this.steps.map((s) => ({
				id: s.id,
				title: s.title,
				description: s.description,
				actions: s.actions,
			})),
		};
	}
}
