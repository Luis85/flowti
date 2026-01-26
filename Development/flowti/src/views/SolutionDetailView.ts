/**
 * Solution Detail View
 *
 * Displays detailed information about a selected solution including
 * Ideas, Requirements, and JTBDs. Listens for solution.selected events.
 */

import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../events/types";
import type { Idea, IIdeaService } from "../ideas/types";
import type { JTBD, IJTBDService } from "../jtbd/types";
import { calculateOpportunityScore, getOpportunityLevel } from "../jtbd/types";
import type { Requirement, IRequirementService } from "../requirements/types";
import type { IServiceContainer } from "../services/types";
import type { Solution, ISolutionService } from "../solutions/types";
import { getSolutionTypeLabel, LIFECYCLE_PHASES } from "../solutions/types";
import { BaseServiceView } from "./BaseServiceView";

export const VIEW_TYPE_SOLUTION_DETAIL = "flowti-solution-detail";

/**
 * Solution Detail View showing solution info and related entities.
 */
export class SolutionDetailView extends BaseServiceView {
	private selectedSolutionId: string | null = null;
	private solution: Solution | null = null;
	private ideas: Idea[] = [];
	private requirements: Requirement[] = [];
	private jtbds: JTBD[] = [];

	// Collapsible states
	private collapsedSections: Set<string> = new Set();

	constructor(
		leaf: WorkspaceLeaf,
		services: IServiceContainer,
		eventBus: IEventBus,
	) {
		super(leaf, services, eventBus);
	}

	getViewType(): string {
		return VIEW_TYPE_SOLUTION_DETAIL;
	}

	getDisplayText(): string {
		return this.solution ? this.solution.name : "Solution Detail";
	}

	getIcon(): string {
		return "layout-dashboard";
	}

	async onOpen(): Promise<void> {
		// Listen for solution selection from explorer
		this.subscribe("solution.selected", async (event) => {
			this.selectedSolutionId = event.payload.solutionId;
			await this.loadData();
			await this.refresh();
		});

		// Listen for entity changes
		this.subscribe("solution.updated", () => this.refreshData());
		this.subscribe("idea.created", () => this.refreshData());
		this.subscribe("idea.updated", () => this.refreshData());
		this.subscribe("idea.deleted", () => this.refreshData());
		this.subscribe("requirement.created", () => this.refreshData());
		this.subscribe("requirement.updated", () => this.refreshData());
		this.subscribe("requirement.deleted", () => this.refreshData());
		this.subscribe("jtbd.created", () => this.refreshData());
		this.subscribe("jtbd.updated", () => this.refreshData());
		this.subscribe("jtbd.deleted", () => this.refreshData());

		await this.loadData();
		await this.refresh();
	}

	protected async refresh(): Promise<void> {
		this.clearContent();
		const container = this.getContentContainer();
		container.addClass("flowti-solution-detail");

		if (!this.solution) {
			this.renderEmptyState(container);
			return;
		}

		// Header
		this.renderHeader(container);

		// Stats
		this.renderStats(container);

		// Lifecycle progress
		this.renderLifecycleProgress(container);

		// Entity sections
		this.renderIdeasSection(container);
		this.renderJTBDSection(container);
		this.renderRequirementsSection(container);
	}

	private async refreshData(): Promise<void> {
		if (this.selectedSolutionId) {
			await this.loadData();
			await this.refresh();
		}
	}

	private async loadData(): Promise<void> {
		if (!this.selectedSolutionId) {
			// Try to select first solution if none selected
			try {
				const solutionService =
					await this.services.get<ISolutionService>("solutionService");
				const solutions = await solutionService.list();
				if (solutions.length > 0) {
					this.selectedSolutionId = solutions[0].id;
				}
			} catch {
				return;
			}
		}

		if (!this.selectedSolutionId) return;

		try {
			const solutionService =
				await this.services.get<ISolutionService>("solutionService");
			const ideaService = await this.services.get<IIdeaService>("ideaService");
			const requirementService =
				await this.services.get<IRequirementService>("requirementService");
			const jtbdService = await this.services.get<IJTBDService>("jtbdService");

			this.solution = await solutionService.load(this.selectedSolutionId);
			this.ideas = await ideaService.listBySolution(this.selectedSolutionId);
			this.requirements = await requirementService.listBySolution(
				this.selectedSolutionId,
			);
			this.jtbds = await jtbdService.listBySolution(this.selectedSolutionId);
		} catch {
			this.solution = null;
			this.ideas = [];
			this.requirements = [];
			this.jtbds = [];
		}
	}

	private renderEmptyState(container: HTMLElement): void {
		const empty = container.createDiv({ cls: "ft-empty-state ft-p-6" });

		empty.createDiv({
			cls: "ft-empty-icon ft-mb-4",
		}).innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;

		empty.createEl("h3", {
			text: "No Solution Selected",
			cls: "ft-heading ft-heading-md ft-mb-2",
		});

		empty.createDiv({
			text: "Select a solution from the explorer to view its details",
			cls: "ft-text-muted",
		});
	}

	private renderHeader(container: HTMLElement): void {
		if (!this.solution) return;

		const header = container.createDiv({
			cls: "ft-dashboard-header ft-mb-4",
		});

		const titleRow = header.createDiv({
			cls: "ft-flex ft-items-center ft-gap-3",
		});

		titleRow.createEl("h2", {
			text: this.solution.name,
			cls: "ft-heading ft-heading-lg ft-m-0",
		});

		titleRow.createSpan({
			text: getSolutionTypeLabel(this.solution.type),
			cls: "ft-badge ft-badge-accent",
		});

		const meta = header.createDiv({
			cls: "ft-flex ft-gap-2 ft-mt-2",
		});

		meta.createSpan({
			text: `Phase: ${this.solution.currentPhase}`,
			cls: "ft-text-sm ft-text-muted",
		});
	}

	private renderStats(container: HTMLElement): void {
		// Calculate average opportunity score
		let avgOpportunity = 0;
		if (this.jtbds.length > 0) {
			const totalScore = this.jtbds.reduce((sum, j) => {
				return sum + calculateOpportunityScore(j.importance, j.satisfaction);
			}, 0);
			avgOpportunity = Math.round(totalScore / this.jtbds.length);
		}

		const statsGrid = container.createDiv({
			cls: "ft-stats-grid ft-mb-4",
		});

		// Ideas stat
		const ideasCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		ideasCard.createDiv({
			text: this.ideas.length.toString(),
			cls: "ft-stat-value",
		});
		ideasCard.createDiv({ text: "Ideas", cls: "ft-text-sm ft-text-muted" });

		// JTBD stat
		const jtbdCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		jtbdCard.createDiv({
			text: this.jtbds.length.toString(),
			cls: "ft-stat-value",
		});
		jtbdCard.createDiv({ text: "Jobs", cls: "ft-text-sm ft-text-muted" });

		// Requirements stat
		const reqCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		reqCard.createDiv({
			text: this.requirements.length.toString(),
			cls: "ft-stat-value",
		});
		reqCard.createDiv({
			text: "Requirements",
			cls: "ft-text-sm ft-text-muted",
		});

		// Opportunity stat
		const oppCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		const oppLevel = getOpportunityLevel(avgOpportunity);
		oppCard.createDiv({
			text: this.jtbds.length > 0 ? `${avgOpportunity}/10` : "-",
			cls: `ft-stat-value ft-opportunity-${oppLevel}`,
		});
		oppCard.createDiv({
			text: "Avg Opportunity",
			cls: "ft-text-sm ft-text-muted",
		});
	}

	private renderLifecycleProgress(container: HTMLElement): void {
		if (!this.solution) return;

		const section = container.createDiv({ cls: "ft-mb-4" });
		section.createEl("h4", {
			text: "Lifecycle Progress",
			cls: "ft-heading ft-heading-sm ft-mb-2",
		});

		const progress = section.createDiv({ cls: "ft-lifecycle-progress" });

		const currentIndex = LIFECYCLE_PHASES.indexOf(this.solution.currentPhase);

		for (let i = 0; i < LIFECYCLE_PHASES.length; i++) {
			const phase = LIFECYCLE_PHASES[i];
			const isCompleted = i < currentIndex;
			const isCurrent = i === currentIndex;

			const phaseEl = progress.createDiv({
				cls: `ft-lifecycle-step ${isCompleted ? "ft-completed" : ""} ${isCurrent ? "ft-current" : ""}`,
			});

			const circle = phaseEl.createDiv({ cls: "ft-lifecycle-circle" });
			if (isCompleted) {
				circle.innerHTML = "✓";
			} else {
				circle.setText((i + 1).toString());
			}

			phaseEl.createDiv({
				text: phase,
				cls: "ft-lifecycle-label ft-text-xs",
			});

			// Connector line (except for last)
			if (i < LIFECYCLE_PHASES.length - 1) {
				progress.createDiv({
					cls: `ft-lifecycle-connector ${isCompleted ? "ft-completed" : ""}`,
				});
			}
		}
	}

	private renderIdeasSection(container: HTMLElement): void {
		this.renderCollapsibleSection(
			container,
			"ideas",
			`Ideas (${this.ideas.length})`,
			() => {
				const content = container.createDiv({ cls: "ft-entity-list" });

				if (this.ideas.length === 0) {
					content.createDiv({
						text: "No ideas yet",
						cls: "ft-text-muted ft-text-sm",
					});
				} else {
					for (const idea of this.ideas) {
						const item = content.createDiv({ cls: "ft-entity-item" });
						item.createSpan({ text: idea.title, cls: "ft-entity-title" });
						item.createSpan({
							text: idea.status,
							cls: `ft-badge ft-badge-muted ft-text-xs`,
						});
					}
				}

				return content;
			},
		);
	}

	private renderJTBDSection(container: HTMLElement): void {
		this.renderCollapsibleSection(
			container,
			"jtbd",
			`Jobs to be Done (${this.jtbds.length})`,
			() => {
				const content = container.createDiv({ cls: "ft-entity-list" });

				if (this.jtbds.length === 0) {
					content.createDiv({
						text: "No jobs defined yet",
						cls: "ft-text-muted ft-text-sm",
					});
				} else {
					for (const jtbd of this.jtbds) {
						const score = calculateOpportunityScore(
							jtbd.importance,
							jtbd.satisfaction,
						);
						const level = getOpportunityLevel(score);

						const item = content.createDiv({ cls: "ft-entity-item" });
						item.createSpan({
							text:
								jtbd.jobStatement.length > 50
									? jtbd.jobStatement.slice(0, 50) + "..."
									: jtbd.jobStatement,
							cls: "ft-entity-title",
						});
						item.createSpan({
							text: `${score}/10`,
							cls: `ft-badge ft-opportunity-${level} ft-text-xs`,
						});
					}
				}

				return content;
			},
		);
	}

	private renderRequirementsSection(container: HTMLElement): void {
		this.renderCollapsibleSection(
			container,
			"requirements",
			`Requirements (${this.requirements.length})`,
			() => {
				const content = container.createDiv({ cls: "ft-entity-list" });

				if (this.requirements.length === 0) {
					content.createDiv({
						text: "No requirements yet",
						cls: "ft-text-muted ft-text-sm",
					});
				} else {
					for (const req of this.requirements) {
						const item = content.createDiv({ cls: "ft-entity-item" });
						item.createSpan({ text: req.title, cls: "ft-entity-title" });
						const badges = item.createDiv({ cls: "ft-flex ft-gap-1" });
						badges.createSpan({
							text: req.priority,
							cls: `ft-badge ft-badge-muted ft-text-xs`,
						});
						badges.createSpan({
							text: req.status,
							cls: `ft-badge ft-badge-muted ft-text-xs`,
						});
					}
				}

				return content;
			},
		);
	}

	private renderCollapsibleSection(
		container: HTMLElement,
		id: string,
		title: string,
		renderContent: () => HTMLElement,
	): void {
		const section = container.createDiv({ cls: "ft-collapsible ft-mb-3" });
		const isCollapsed = this.collapsedSections.has(id);

		const header = section.createDiv({ cls: "ft-collapsible-header" });
		header.createSpan({ text: title, cls: "ft-font-medium" });
		header.createSpan({
			text: isCollapsed ? "▸" : "▾",
			cls: "ft-collapsible-icon",
		});

		const content = renderContent();
		content.addClass("ft-collapsible-content");
		if (isCollapsed) {
			content.addClass("ft-collapsed");
		}
		section.appendChild(content);

		header.addEventListener("click", () => {
			if (this.collapsedSections.has(id)) {
				this.collapsedSections.delete(id);
				content.removeClass("ft-collapsed");
				header.querySelector(".ft-collapsible-icon")?.setText("▾");
			} else {
				this.collapsedSections.add(id);
				content.addClass("ft-collapsed");
				header.querySelector(".ft-collapsible-icon")?.setText("▸");
			}
		});
	}
}
