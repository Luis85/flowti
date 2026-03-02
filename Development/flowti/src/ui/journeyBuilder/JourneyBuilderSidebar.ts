/**
 * JourneyBuilderSidebar — Obsidian right-sidebar view for creating
 * and editing E2E journey definitions.
 *
 * Increment 1: Welcome state with "Create New" and "Open Existing" buttons.
 * Increment 2: Setup form with name, description, and start event inputs.
 */
import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";

export const VIEW_TYPE_JOURNEY_BUILDER = "flowti-journey-builder";

type SidebarState = "welcome" | "setup";

export interface JourneyMetadata {
	name: string;
	description: string;
	startEvent: string;
}

export interface JourneyBuilderSidebarDeps {
	eventBus: IEventBus;
}

export class JourneyBuilderSidebar extends ItemView {
	private readonly eventBus: IEventBus;
	private state: SidebarState = "welcome";
	private metadata: JourneyMetadata = { name: "", description: "", startEvent: "" };

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

	// ── Render: Welcome ──────────────────────────────────────

	private renderWelcome(): void {
		this.state = "welcome";
		this.metadata = { name: "", description: "", startEvent: "" };
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

		// Back button
		const backBtn = el.createDiv({ cls: "ft-jb-back-btn" });
		backBtn.dataset.testId = "jb-back-btn";
		backBtn.setAttribute("role", "button");
		backBtn.setAttribute("tabindex", "0");
		const backIcon = backBtn.createSpan({ cls: "ft-jb-back-icon" });
		setIcon(backIcon, "arrow-left");
		backBtn.createSpan({ text: "Back" });
		backBtn.addEventListener("click", () => this.renderWelcome());
		backBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.renderWelcome();
			}
		});

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
		const continueBtn = el.createDiv({ cls: "ft-jb-continue-btn" });
		continueBtn.dataset.testId = "jb-continue-btn";
		continueBtn.setAttribute("role", "button");
		continueBtn.setAttribute("tabindex", "0");
		const continueIcon = continueBtn.createSpan({ cls: "ft-jb-continue-icon" });
		setIcon(continueIcon, "arrow-right");
		continueBtn.createSpan({ text: "Continue" });
		continueBtn.addEventListener("click", () => this.onContinue());
		continueBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.onContinue();
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

	// ── Event handlers ───────────────────────────────────────

	private onOpenExisting(): void {
		void this.eventBus.emit("journey-builder.open-existing", {});
	}

	private onCreateNew(): void {
		void this.eventBus.emit("journey-builder.create-new", {});
		this.renderSetup();
	}

	private onContinue(): void {
		// Increment 3: transition to step builder
	}

	private emitMetadataUpdate(field: string, value: string): void {
		void this.eventBus.emit("journey-builder.metadata.updated", { field, value });
	}
}
