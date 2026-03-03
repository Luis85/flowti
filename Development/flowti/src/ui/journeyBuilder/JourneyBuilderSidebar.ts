/**
 * JourneyBuilderSidebar — Obsidian right-sidebar view for creating
 * and editing E2E journey definitions.
 *
 * Acts as orchestrator: owns state, delegates rendering to NavBar,
 * StepCard, and JSONPanel components.
 *
 * States: welcome → setup → steps (step editor with prev/next navigation)
 */
import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { JourneyAction, JourneyToolName } from "../../domain/journeyBuilder/types";
import { TOOL_SCHEMAS } from "../../domain/journeyBuilder/toolSchemas";
import { toEventName, isEventNameConverted } from "../../domain/journeyBuilder/eventNameUtils";
import { NavBar } from "./NavBar";
import { StepCard } from "./StepCard";
import { JSONPanel } from "./JSONPanel";
import { ActionList } from "./ActionList";
import { ToolPicker } from "./ToolPicker";
import { ActionForm } from "./ActionForm";

export const VIEW_TYPE_JOURNEY_BUILDER = "flowti-journey-builder";

type SidebarState = "welcome" | "setup" | "steps";

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
}

export interface JourneyBuilderSidebarDeps {
	eventBus: IEventBus;
}

let stepCounter = 0;

export class JourneyBuilderSidebar extends ItemView {
	private readonly eventBus: IEventBus;
	private state: SidebarState = "welcome";
	private metadata: JourneyMetadata = { name: "", description: "", startEvent: "" };
	private steps: JourneyStep[] = [];
	private endEvent = "";
	private currentStepIndex = 0;
	private selectedActionIndex = -1;
	private showToolPicker = false;

	constructor(leaf: WorkspaceLeaf, deps: JourneyBuilderSidebarDeps) {
		super(leaf);
		this.eventBus = deps.eventBus;
	}

	getViewType(): string {
		return VIEW_TYPE_JOURNEY_BUILDER;
	}

	getDisplayText(): string {
		return "Journey Builder";
	}

	getIcon(): string {
		return "route";
	}

	async onOpen(): Promise<void> {
		this.renderWelcome();
	}

	async onClose(): Promise<void> {
		// Cleanup will be needed when we add event subscriptions
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
		steps: { id: string; title: string; description: string; swimlane: string; guideSection: number; actions: JourneyAction[] }[];
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
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");

		this.renderHeader(el);

		// Welcome cards
		const cards = el.createDiv({ cls: "ft-jb-welcome-cards" });

		// Open Existing card
		const openCard = cards.createDiv({ cls: "ft-jb-welcome-card ft-jb-open-existing-btn" });
		openCard.dataset.testId = "jb-open-existing";
		openCard.setAttribute("role", "button");
		openCard.setAttribute("tabindex", "0");
		const openIcon = openCard.createDiv({ cls: "ft-jb-card-icon" });
		setIcon(openIcon, "file-search");
		const openTitle = openCard.createDiv({ cls: "ft-jb-card-title", text: "Open Existing Journey" });
		openTitle.dataset.testId = "jb-card-title";
		const openDesc = openCard.createDiv({ cls: "ft-jb-card-desc", text: "Load and edit a journey definition from your vault" });
		openDesc.dataset.testId = "jb-card-desc";
		openCard.addEventListener("click", () => this.onOpenExisting());
		openCard.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.onOpenExisting();
			}
		});

		// Create New card
		const newCard = cards.createDiv({ cls: "ft-jb-welcome-card ft-jb-create-new-btn" });
		newCard.dataset.testId = "jb-create-new";
		newCard.setAttribute("role", "button");
		newCard.setAttribute("tabindex", "0");
		const newIcon = newCard.createDiv({ cls: "ft-jb-card-icon" });
		setIcon(newIcon, "plus-circle");
		const newTitle = newCard.createDiv({ cls: "ft-jb-card-title", text: "Create New Journey" });
		newTitle.dataset.testId = "jb-card-title";
		const newDesc = newCard.createDiv({ cls: "ft-jb-card-desc", text: "Design a new E2E journey from scratch" });
		newDesc.dataset.testId = "jb-card-desc";
		newCard.addEventListener("click", () => this.onCreateNew());
		newCard.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.onCreateNew();
			}
		});
	}

	// ── Render: Setup form ───────────────────────────────────

	private renderSetup(): void {
		this.state = "setup";
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");

		this.renderHeader(el);
		this.renderBackButton(el, () => this.renderWelcome());

		// Form container
		const form = el.createDiv({ cls: "ft-jb-setup-form" });
		form.dataset.testId = "jb-setup-form";

		// Journey name
		const nameGroup = form.createDiv({ cls: "ft-jb-form-group" });
		nameGroup.createEl("label", { cls: "ft-jb-form-label", text: "Journey name" });
		const nameInput = nameGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		nameInput.dataset.testId = "jb-name-input";
		nameInput.placeholder = "e.g. Getting Started";
		nameInput.value = this.metadata.name;
		nameInput.addEventListener("input", () => {
			this.metadata.name = nameInput.value;
			this.emitMetadataUpdate("name", nameInput.value);
		});

		// Description
		const descGroup = form.createDiv({ cls: "ft-jb-form-group" });
		descGroup.createEl("label", { cls: "ft-jb-form-label", text: "Description" });
		const descInput = descGroup.createEl("textarea", { cls: "ft-jb-form-textarea" });
		descInput.dataset.testId = "jb-description-input";
		descInput.placeholder = "What does this journey test?";
		descInput.value = this.metadata.description;
		descInput.rows = 3;
		descInput.addEventListener("input", () => {
			this.metadata.description = descInput.value;
			this.emitMetadataUpdate("description", descInput.value);
		});

		// Start event
		const startGroup = form.createDiv({ cls: "ft-jb-form-group" });
		startGroup.createEl("label", { cls: "ft-jb-form-label", text: "Start event" });
		const startInput = startGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		startInput.dataset.testId = "jb-start-event-input";
		startInput.placeholder = "e.g. Session Started or session.started";
		startInput.value = this.metadata.startEvent;
		const startPreview = startGroup.createSpan({ cls: "ft-jb-event-preview" });
		startPreview.dataset.testId = "jb-start-event-preview";
		startInput.addEventListener("input", () => {
			const converted = toEventName(startInput.value);
			this.metadata.startEvent = converted;
			startPreview.textContent = isEventNameConverted(startInput.value, converted)
				? `\u2192 ${converted}`
				: "";
			this.emitMetadataUpdate("startEvent", converted);
		});

		// Continue button
		this.renderActionButton(el, {
			testId: "jb-continue-btn",
			cls: "ft-jb-continue-btn",
			icon: "arrow-right",
			text: "Continue",
			onClick: () => this.onContinue(),
		});
	}

	// ── Render: Step editor ──────────────────────────────────

	private renderSteps(): void {
		this.state = "steps";
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");

		this.renderHeader(el);
		this.renderBackButton(el, () => this.renderSetup());

		// NavBar — step navigation
		const navContainer = el.createDiv({ cls: "ft-jb-nav-container" });
		new NavBar(navContainer, {
			stepCount: this.steps.length,
			currentIndex: this.currentStepIndex,
			onPrev: () => this.onNavPrev(),
			onNext: () => this.onNavNext(),
			onAddStep: () => this.onAddStep(),
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

			// ToolPicker — shown after "Add action" click
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
					}).render();
				}
			}
		} else {
			const empty = stepContainer.createDiv({ cls: "ft-jb-empty-state" });
			empty.dataset.testId = "jb-empty-steps";
			empty.textContent = "No steps yet. Click \"Add step\" to begin.";
		}

		// End event
		const endGroup = el.createDiv({ cls: "ft-jb-form-group ft-jb-end-event-group" });
		endGroup.createEl("label", { cls: "ft-jb-form-label", text: "End event" });
		const endInput = endGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		endInput.dataset.testId = "jb-end-event-input";
		endInput.placeholder = "e.g. Hub Tab Changed or hub.tab.changed";
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
		});

		// JSONPanel — collapsible preview
		const jsonContainer = el.createDiv({ cls: "ft-jb-json-container" });
		new JSONPanel(jsonContainer, {
			getJSON: () => JSON.stringify(this.buildDefinition(), null, "\t"),
		}).render();

		// Export button
		this.renderActionButton(el, {
			testId: "jb-export-btn",
			cls: "ft-jb-export-btn",
			icon: "download",
			text: "Export journey",
			onClick: () => this.onExport(),
		});
	}

	// ── Shared rendering ─────────────────────────────────────

	private renderHeader(el: HTMLElement): void {
		const header = el.createDiv({ cls: "ft-jb-header" });
		const iconEl = header.createSpan({ cls: "ft-jb-header-icon" });
		setIcon(iconEl, "route");
		const titleEl = header.createSpan({ cls: "ft-jb-header-title", text: "Journey Builder" });
		titleEl.dataset.testId = "jb-header-title";
	}

	private renderBackButton(el: HTMLElement, onBack: () => void): void {
		const backBtn = el.createDiv({ cls: "ft-jb-back-btn" });
		backBtn.dataset.testId = "jb-back-btn";
		backBtn.setAttribute("role", "button");
		backBtn.setAttribute("tabindex", "0");
		const backIcon = backBtn.createSpan({ cls: "ft-jb-back-icon" });
		setIcon(backIcon, "arrow-left");
		backBtn.createSpan({ text: "Back" });
		backBtn.addEventListener("click", onBack);
		backBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onBack();
			}
		});
	}

	private renderActionButton(el: HTMLElement, opts: {
		testId: string;
		cls: string;
		icon: string;
		text: string;
		onClick: () => void;
	}): void {
		const btn = el.createDiv({ cls: opts.cls });
		btn.dataset.testId = opts.testId;
		btn.setAttribute("role", "button");
		btn.setAttribute("tabindex", "0");
		const icon = btn.createSpan({ cls: `${opts.cls}-icon` });
		setIcon(icon, opts.icon);
		btn.createSpan({ text: opts.text });
		btn.addEventListener("click", opts.onClick);
		btn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				opts.onClick();
			}
		});
	}

	// ── Event handlers ───────────────────────────────────────

	private onOpenExisting(): void {
		void this.eventBus.emit("journey-builder.open-existing", {});
	}

	private onCreateNew(): void {
		void this.eventBus.emit("journey-builder.create-new", {});
		this.renderSetup();
	}

	private onContinue(): void {
		this.renderSteps();
	}

	private onNavPrev(): void {
		if (this.currentStepIndex > 0) {
			this.currentStepIndex--;
			this.renderSteps();
		}
	}

	private onNavNext(): void {
		if (this.currentStepIndex < this.steps.length - 1) {
			this.currentStepIndex++;
			this.renderSteps();
		}
	}

	private onAddStep(): void {
		const id = `step-${++stepCounter}`;
		const step: JourneyStep = { id, title: "", description: "", swimlane: "", actions: [] };
		this.steps.push(step);
		this.currentStepIndex = this.steps.length - 1;
		void this.eventBus.emit("journey-builder.step.added", { stepId: id, title: "" });
		this.renderSteps();
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
		}
	}

	private onRemoveStep(stepId: string): void {
		this.steps = this.steps.filter((s) => s.id !== stepId);
		if (this.currentStepIndex >= this.steps.length) {
			this.currentStepIndex = Math.max(0, this.steps.length - 1);
		}
		this.selectedActionIndex = -1;
		this.showToolPicker = false;
		this.renderSteps();
	}

	// ── Action handlers ─────────────────────────────────────

	private onAddAction(): void {
		this.showToolPicker = true;
		this.selectedActionIndex = -1;
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
	}

	private onRemoveAction(index: number): void {
		const step = this.steps[this.currentStepIndex];
		if (!step) return;
		step.actions.splice(index, 1);
		if (this.selectedActionIndex >= step.actions.length) {
			this.selectedActionIndex = Math.max(-1, step.actions.length - 1);
		}
		this.renderSteps();
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
	}

	private onExport(): void {
		const filePath = `journeys/${this.metadata.name}.journey.json`;
		const definition = this.buildDefinition();
		void this.eventBus.emit("journey-builder.exported", { path: filePath, definition });
	}

	private emitMetadataUpdate(field: string, value: string): void {
		void this.eventBus.emit("journey-builder.metadata.updated", { field, value });
	}
}
