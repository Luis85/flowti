/**
 * WelcomeScreen — landing state for the Journey Builder sidebar.
 *
 * Renders either an empty-state (no journeys) or action cards
 * (open existing, create new, import definition).
 */
import { setIcon } from "obsidian";
import { renderActionButton } from "./sidebarHelpers";

export interface WelcomeScreenDeps {
	hasExistingJourneys: boolean;
	onCreateNew: () => void;
	onOpenExisting: () => void;
	onImportFile: () => void;
	onImportFromSystem: () => void;
}

export class WelcomeScreen {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: WelcomeScreenDeps,
	) {}

	render(): void {
		if (this.deps.hasExistingJourneys) {
			this.renderCards();
		} else {
			this.renderEmpty();
		}
	}

	private renderEmpty(): void {
		const empty = this.container.createDiv({ cls: "ft-jb-empty-welcome" });
		empty.dataset.testId = "jb-empty-welcome";

		const iconWrap = empty.createDiv({ cls: "ft-jb-empty-icon" });
		setIcon(iconWrap, "route");

		empty.createDiv({ cls: "ft-jb-empty-title", text: "No journeys yet" });
		empty.createDiv({ cls: "ft-jb-empty-desc", text: "Create your first E2E journey definition to get started." });

		renderActionButton(empty, {
			testId: "jb-create-new",
			cls: "ft-jb-create-first-btn",
			icon: "plus-circle",
			text: "Create first journey",
			onClick: () => this.deps.onCreateNew(),
		});

		const importGroup = empty.createDiv({ cls: "ft-jb-import-group" });
		importGroup.dataset.testId = "jb-import-group";

		this.renderImportLink(importGroup, {
			testId: "jb-import-link",
			text: "or import from vault",
			onClick: () => this.deps.onImportFile(),
		});

		this.renderImportLink(importGroup, {
			testId: "jb-browse-link",
			text: "or browse from file system",
			onClick: () => this.deps.onImportFromSystem(),
		});
	}

	private renderImportLink(parent: HTMLElement, opts: { testId: string; text: string; onClick: () => void }): void {
		const link = parent.createDiv({ cls: "ft-jb-import-link" });
		link.dataset.testId = opts.testId;
		link.setAttribute("role", "button");
		link.setAttribute("tabindex", "0");
		link.textContent = opts.text;
		link.addEventListener("click", opts.onClick);
		link.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				opts.onClick();
			}
		});
	}

	private renderCards(): void {
		const cards = this.container.createDiv({ cls: "ft-jb-welcome-cards" });

		this.renderCard(cards, {
			testId: "jb-open-existing",
			cls: "ft-jb-welcome-card ft-jb-open-existing-btn",
			icon: "file-search",
			title: "Open existing journey",
			description: "Load and edit a journey definition from your vault",
			onClick: () => this.deps.onOpenExisting(),
		});

		this.renderCard(cards, {
			testId: "jb-create-new",
			cls: "ft-jb-welcome-card ft-jb-create-new-btn",
			icon: "plus-circle",
			title: "Create new journey",
			description: "Design a new E2E journey from scratch",
			onClick: () => this.deps.onCreateNew(),
		});

		this.renderCard(cards, {
			testId: "jb-import-definition",
			cls: "ft-jb-welcome-card ft-jb-import-btn",
			icon: "file-input",
			title: "Import definition",
			description: "Import a .journey file from your vault or file system",
			onClick: () => this.deps.onImportFile(),
		});
	}

	private renderCard(parent: HTMLElement, opts: {
		testId: string;
		cls: string;
		icon: string;
		title: string;
		description: string;
		onClick: () => void;
	}): void {
		const card = parent.createDiv({ cls: opts.cls });
		card.dataset.testId = opts.testId;
		card.setAttribute("role", "button");
		card.setAttribute("tabindex", "0");
		const iconEl = card.createDiv({ cls: "ft-jb-card-icon" });
		setIcon(iconEl, opts.icon);
		const titleEl = card.createDiv({ cls: "ft-jb-card-title", text: opts.title });
		titleEl.dataset.testId = "jb-card-title";
		const descEl = card.createDiv({ cls: "ft-jb-card-desc", text: opts.description });
		descEl.dataset.testId = "jb-card-desc";
		card.addEventListener("click", opts.onClick);
		card.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				opts.onClick();
			}
		});
	}
}
