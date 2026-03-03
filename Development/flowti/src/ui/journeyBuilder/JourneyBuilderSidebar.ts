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
import { NavBar } from "./NavBar";
import { StepCard } from "./StepCard";
import { JSONPanel } from "./JSONPanel";

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

	/** Builds the journey definition from current state (reusable by JSONPanel and export). */
	buildDefinition(): {
		journey: string;
		description: string;
		startEvent: string;
		endEvent: string;
		steps: { id: string; title: string; guideSection: number }[];
	} {
		return {
			journey: this.metadata.name,
			description: this.metadata.description,
			startEvent: this.metadata.startEvent,
			endEvent: this.endEvent,
			steps: this.steps.map((s, i) => ({
				id: s.id,
				title: s.title,
				guideSection: i + 1,
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
		startInput.placeholder = "e.g. journey-builder.opened";
		startInput.value = this.metadata.startEvent;
		startInput.addEventListener("input", () => {
			this.metadata.startEvent = startInput.value;
			this.emitMetadataUpdate("startEvent", startInput.value);
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
				onTitleChanged: (title) => this.onStepTitleChanged(step.id, title),
				onRemove: () => this.onRemoveStep(step.id),
			}).render();
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
		endInput.placeholder = "e.g. hub.tab.changed";
		endInput.value = this.endEvent;
		endInput.addEventListener("input", () => {
			this.endEvent = endInput.value;
			this.emitMetadataUpdate("endEvent", endInput.value);
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
		const step: JourneyStep = { id, title: "" };
		this.steps.push(step);
		this.currentStepIndex = this.steps.length - 1;
		void this.eventBus.emit("journey-builder.step.added", { stepId: id, title: "" });
		this.renderSteps();
	}

	private onStepTitleChanged(stepId: string, title: string): void {
		const step = this.steps.find((s) => s.id === stepId);
		if (step) {
			step.title = title;
			void this.eventBus.emit("journey-builder.step.updated", {
				stepId,
				field: "title",
				value: title,
			});
		}
	}

	private onRemoveStep(stepId: string): void {
		this.steps = this.steps.filter((s) => s.id !== stepId);
		if (this.currentStepIndex >= this.steps.length) {
			this.currentStepIndex = Math.max(0, this.steps.length - 1);
		}
		this.renderSteps();
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
