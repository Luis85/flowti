/**
 * JourneyBuilderSidebar — Obsidian right-sidebar view for creating
 * and editing E2E journey definitions.
 *
 * Increment 1: Welcome state with "Create New" and "Open Existing" buttons.
 */
import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";

export const VIEW_TYPE_JOURNEY_BUILDER = "flowti-journey-builder";

export interface JourneyBuilderSidebarDeps {
	eventBus: IEventBus;
}

export class JourneyBuilderSidebar extends ItemView {
	private readonly eventBus: IEventBus;

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

	private renderWelcome(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-jb-sidebar");

		// Header
		const header = el.createDiv({ cls: "ft-jb-header" });
		const iconEl = header.createSpan({ cls: "ft-jb-header-icon" });
		setIcon(iconEl, "route");
		const titleEl = header.createSpan({ cls: "ft-jb-header-title", text: "Journey Builder" });
		titleEl.dataset.testId = "jb-header-title";

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

	private onOpenExisting(): void {
		void this.eventBus.emit("journey-builder.open-existing", {});
	}

	private onCreateNew(): void {
		void this.eventBus.emit("journey-builder.create-new", {});
	}
}
