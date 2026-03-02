/**
 * JourneyBuilderSidebar — Obsidian right-sidebar view for creating
 * and editing E2E journey definitions.
 *
 * Increment 1: Welcome state with "Create New" and "Open Existing" buttons.
 * Increment 2: Setup form with name, description, and start event inputs.
 * Increment 3: Step builder with add/remove steps, end event, and export.
 */
import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";

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

	/** Returns the current sidebar state (for testing). */
	getSidebarState(): SidebarState {
		return this.state;
	}

	/** Returns the current metadata (for testing). */
	getMetadata(): JourneyMetadata {
		return { ...this.metadata };
	}

	/** Returns the current steps (for testing). */
	getSteps(): JourneyStep[] {
		return this.steps.map((s) => ({ ...s }));
	}

	/** Returns the current end event (for testing). */
	getEndEvent(): string {
		return this.endEvent;
	}

	// ── Render: Welcome ──────────────────────────────────────

	private renderWelcome(): void {
		this.state = "welcome";
		this.metadata = { name: "", description: "", startEvent: "" };
		this.steps = [];
		this.endEvent = "";
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

	// ── Render: Step builder ─────────────────────────────────

	private renderSteps(): void {
		this.state = "steps";
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");

		this.renderHeader(el);
		this.renderBackButton(el, () => this.renderSetup());

		// Step list
		const stepList = el.createDiv({ cls: "ft-jb-step-list" });
		stepList.dataset.testId = "jb-step-list";
		this.renderStepCards(stepList);

		// Add Step button
		const addBtn = el.createDiv({ cls: "ft-jb-add-step-btn" });
		addBtn.dataset.testId = "jb-add-step-btn";
		addBtn.setAttribute("role", "button");
		addBtn.setAttribute("tabindex", "0");
		const addIcon = addBtn.createSpan({ cls: "ft-jb-add-step-icon" });
		setIcon(addIcon, "plus");
		addBtn.createSpan({ text: "Add step" });
		addBtn.addEventListener("click", () => this.onAddStep(stepList));
		addBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.onAddStep(stepList);
			}
		});

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

		// Export button
		this.renderActionButton(el, {
			testId: "jb-export-btn",
			cls: "ft-jb-export-btn",
			icon: "download",
			text: "Export journey",
			onClick: () => this.onExport(),
		});
	}

	private renderStepCards(container: HTMLElement): void {
		container.empty();
		for (const step of this.steps) {
			const card = container.createDiv({ cls: "ft-jb-step-card" });
			card.dataset.testId = "jb-step-card";
			card.dataset.stepId = step.id;

			const cardHeader = card.createDiv({ cls: "ft-jb-step-card-header" });
			const stepNum = cardHeader.createSpan({ cls: "ft-jb-step-num", text: `${this.steps.indexOf(step) + 1}` });
			stepNum.dataset.testId = "jb-step-num";
			const stepTitle = cardHeader.createSpan({ cls: "ft-jb-step-title", text: step.title || "Untitled step" });
			stepTitle.dataset.testId = "jb-step-title";

			const removeBtn = cardHeader.createSpan({ cls: "ft-jb-step-remove" });
			removeBtn.dataset.testId = "jb-step-remove";
			removeBtn.setAttribute("role", "button");
			removeBtn.setAttribute("tabindex", "0");
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", () => this.onRemoveStep(step.id, container));
		}
	}

	// ── Render: Step inline form ─────────────────────────────

	private renderStepForm(container: HTMLElement): void {
		// Remove existing form if any
		const existing = container.querySelector("[data-test-id='jb-step-form']");
		if (existing) existing.remove();

		const form = container.createDiv({ cls: "ft-jb-step-form" });
		form.dataset.testId = "jb-step-form";

		const titleGroup = form.createDiv({ cls: "ft-jb-form-group" });
		titleGroup.createEl("label", { cls: "ft-jb-form-label", text: "Step title" });
		const titleInput = titleGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		titleInput.dataset.testId = "jb-step-title-input";
		titleInput.placeholder = "e.g. Open the user hub";
		titleInput.focus();

		const actions = form.createDiv({ cls: "ft-jb-step-form-actions" });
		const confirmBtn = actions.createDiv({ cls: "ft-jb-step-form-confirm" });
		confirmBtn.dataset.testId = "jb-step-confirm";
		confirmBtn.setAttribute("role", "button");
		confirmBtn.setAttribute("tabindex", "0");
		const confirmIcon = confirmBtn.createSpan();
		setIcon(confirmIcon, "check");
		confirmBtn.createSpan({ text: "Add" });

		const confirmStep = () => {
			const title = titleInput.value.trim();
			if (!title) return;
			const id = `step-${++stepCounter}`;
			const step: JourneyStep = { id, title };
			this.steps.push(step);
			void this.eventBus.emit("journey-builder.step.added", { stepId: id, title });
			form.remove();
			this.renderStepCards(container);
		};

		confirmBtn.addEventListener("click", confirmStep);
		confirmBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				confirmStep();
			}
		});
		titleInput.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				confirmStep();
			}
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

	private onAddStep(stepList: HTMLElement): void {
		this.renderStepForm(stepList);
	}

	private onRemoveStep(stepId: string, container: HTMLElement): void {
		this.steps = this.steps.filter((s) => s.id !== stepId);
		this.renderStepCards(container);
	}

	private onExport(): void {
		const filePath = `journeys/${this.metadata.name}.journey.json`;
		const definition = {
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

		// File write is handled by JourneyBuilderService via IFileSystemClient → EventBridge
		void this.eventBus.emit("journey-builder.exported", { path: filePath, definition });
	}

	private emitMetadataUpdate(field: string, value: string): void {
		void this.eventBus.emit("journey-builder.metadata.updated", { field, value });
	}
}
