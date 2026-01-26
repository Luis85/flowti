/**
 * Solution Explorer View
 *
 * A sidebar view for the left Obsidian sidebar that displays
 * a list of all solutions and allows selection.
 */

import { Notice, type WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../events/types";
import type { IServiceContainer } from "../services/types";
import type { Solution, ISolutionService } from "../solutions/types";
import { BaseServiceView } from "./BaseServiceView";
import { CreateSolutionModal } from "src/solutions/CreateSolutionModal";

export const VIEW_TYPE_SOLUTION_EXPLORER = "flowti-solution-explorer";

/**
 * Solution Explorer for left sidebar navigation.
 */
export class SolutionExplorerView extends BaseServiceView {
	private solutions: Solution[] = [];
	private selectedSolutionId: string | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		services: IServiceContainer,
		eventBus: IEventBus,
	) {
		super(leaf, services, eventBus);
	}

	getViewType(): string {
		return VIEW_TYPE_SOLUTION_EXPLORER;
	}

	getDisplayText(): string {
		return "Solutions";
	}

	getIcon(): string {
		return "folder-tree";
	}

	async onOpen(): Promise<void> {
		// Subscribe to solution events for reactive updates
		this.subscribe("solution.created", () => this.refreshList());
		this.subscribe("solution.updated", () => this.refreshList());
		this.subscribe("solution.deleted", () => this.refreshList());
		this.subscribe("solution.selected", (event) => {
			this.selectedSolutionId = event.payload.solutionId;
			this.refresh();
		});

		await this.loadData();
		await this.refresh();
	}

	protected async refresh(): Promise<void> {
		this.clearContent();
		const container = this.getContentContainer();
		container.addClass("flowti-solution-explorer");

		// Header
		this.renderHeader(container);

		// Solution list
		this.renderList(container);

		// Add button
		this.renderAddButton(container);
	}

	private async refreshList(): Promise<void> {
		await this.loadData();
		await this.refresh();
	}

	private async loadData(): Promise<void> {
		try {
			const solutionService =
				await this.services.get<ISolutionService>("solutionService");
			this.solutions = await solutionService.list();
		} catch {
			this.solutions = [];
		}
	}

	private renderHeader(container: HTMLElement): void {
		const header = container.createDiv({ cls: "ft-explorer-header ft-p-3" });

		const titleRow = header.createDiv({
			cls: "ft-flex ft-items-center ft-justify-between",
		});

		titleRow.createEl("h3", {
			text: "Solutions",
			cls: "ft-heading ft-heading-sm ft-m-0",
		});

		// Refresh button
		const refreshBtn = titleRow.createEl("button", {
			cls: "ft-btn ft-btn-icon clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>`;
		refreshBtn.addEventListener("click", () => this.refreshList());
	}

	private renderList(container: HTMLElement): void {
		const list = container.createDiv({ cls: "ft-explorer-list" });

		if (this.solutions.length === 0) {
			const empty = list.createDiv({ cls: "ft-p-4 ft-text-center" });
			empty.createDiv({
				text: "No solutions yet",
				cls: "ft-text-muted ft-mb-2",
			});
			empty.createDiv({
				text: 'Click "+" to create your first solution',
				cls: "ft-text-xs ft-text-muted",
			});
			return;
		}

		for (const solution of this.solutions) {
			const isActive = solution.id === this.selectedSolutionId;

			const item = list.createDiv({
				cls: `ft-sidebar-item ${isActive ? "ft-sidebar-item-active" : ""}`,
			});

			// Icon
			const icon = item.createSpan({ cls: "ft-sidebar-item-icon" });
			icon.innerHTML = this.getSolutionIcon(solution.type);

			// Text
			item.createSpan({
				text: solution.name,
				cls: "ft-sidebar-item-text",
			});

			// Phase badge
			item.createSpan({
				text: solution.currentPhase,
				cls: "ft-badge ft-badge-muted ft-text-xs ft-ml-auto",
			});

			item.addEventListener("click", () => this.selectSolution(solution.id));
		}
	}

	private renderAddButton(container: HTMLElement): void {
		const footer = container.createDiv({ cls: "ft-explorer-footer ft-p-3" });

		const btn = footer.createEl("button", {
			text: "+ New Solution",
			cls: "ft-btn ft-btn-ghost ft-w-full",
		});

		btn.addEventListener("click", async () => {
			const solutionService =
				await this.services.get<ISolutionService>("solutionService");

			const modal = new CreateSolutionModal(
				this.app,
				solutionService,
				(name) => {
					new Notice(`Solution "${name}" created successfully`);
					this.services.getLogger().info(`Solution created: ${name}`);
				},
			);
			modal.open();
		});
	}

	private async selectSolution(solutionId: string): Promise<void> {
		this.selectedSolutionId = solutionId;

		// Emit selection event for other views to react
		await this.eventBus.emit("solution.selected", { solutionId });

		// Re-render to update active state
		await this.refresh();

		// Open detail view if not already open
		await this.openDetailView();
	}

	private async openDetailView(): Promise<void> {
		const { workspace } = this.app;
		const VIEW_TYPE_SOLUTION_DETAIL = "flowti-solution-detail";

		// Check if detail view is already open
		const existing = workspace.getLeavesOfType(VIEW_TYPE_SOLUTION_DETAIL);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
			return;
		}

		// Open in main area
		const leaf = workspace.getLeaf("tab");
		if (leaf) {
			await leaf.setViewState({
				type: VIEW_TYPE_SOLUTION_DETAIL,
				active: true,
			});
			workspace.revealLeaf(leaf);
		}
	}

	private getSolutionIcon(type: string): string {
		const icons: Record<string, string> = {
			Application: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>',
			Service: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M22 15h-2"/><path d="M20 9h2"/><path d="M2 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
			Platform: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>',
			Product: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
			Feature: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>',
		};
		return icons[type] || icons.Product;
	}
}
