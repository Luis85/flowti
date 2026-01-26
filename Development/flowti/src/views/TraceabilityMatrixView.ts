/**
 * Traceability Matrix View
 *
 * Shows the relationship between JTBD, Ideas, and Requirements.
 * Helps identify gaps in coverage and ensures traceability.
 *
 * Matrix structure:
 * ┌─────────────┬──────────────┬────────────────┬─────────┐
 * │    JTBD     │    Ideas     │  Requirements  │ Status  │
 * ├─────────────┼──────────────┼────────────────┼─────────┤
 * │ Job: ...    │ Idea 1       │ REQ-001        │ Covered │
 * │             │              │ REQ-002        │         │
 * │             │ Idea 2       │ (none)         │ Gap     │
 * └─────────────┴──────────────┴────────────────┴─────────┘
 */

import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../events/types";
import type { Idea, IIdeaService } from "../ideas/types";
import type { JTBD, IJTBDService } from "../jtbd/types";
import { calculateOpportunityScore, getOpportunityLevel } from "../jtbd/types";
import type { Requirement, IRequirementService } from "../requirements/types";
import type { IServiceContainer } from "../services/types";
import type { Solution, ISolutionService } from "../solutions/types";
import { BaseServiceView } from "./BaseServiceView";

export const VIEW_TYPE_TRACEABILITY_MATRIX = "flowti-traceability-matrix";

/**
 * Traceability row representing the chain from JTBD to Requirements.
 */
interface TraceabilityRow {
	jtbd: JTBD | null;
	ideas: Idea[];
	requirements: Requirement[];
	status: "covered" | "partial" | "gap" | "orphan";
}

/**
 * Traceability Matrix View showing JTBD → Idea → Requirement chains.
 */
export class TraceabilityMatrixView extends BaseServiceView {
	private solutions: Solution[] = [];
	private selectedSolutionId: string | null = null;
	private ideas: Idea[] = [];
	private requirements: Requirement[] = [];
	private jtbds: JTBD[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		services: IServiceContainer,
		eventBus: IEventBus
	) {
		super(leaf, services, eventBus);
	}

	getViewType(): string {
		return VIEW_TYPE_TRACEABILITY_MATRIX;
	}

	getDisplayText(): string {
		return "Traceability Matrix";
	}

	getIcon(): string {
		return "table-2";
	}

	async onOpen(): Promise<void> {
		// Subscribe to events for reactive updates
		this.subscribe("solution.created", () => this.refreshData());
		this.subscribe("solution.updated", () => this.refreshData());
		this.subscribe("solution.deleted", () => this.refreshData());
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
		container.addClass("flowti-traceability-view");

		// Header with solution selector
		await this.renderHeader(container);

		if (!this.selectedSolutionId) {
			container.createDiv({
				text: "Select a solution to view traceability",
				cls: "ft-text-muted ft-p-4",
			});
			return;
		}

		const solution = this.solutions.find(
			(s) => s.id === this.selectedSolutionId
		);
		if (!solution) {
			container.createDiv({
				text: "Solution not found",
				cls: "ft-text-muted ft-p-4",
			});
			return;
		}

		// Traceability stats
		this.renderStats(container);

		// Matrix table
		this.renderMatrix(container);

		// Gap analysis
		this.renderGapAnalysis(container);
	}

	private async refreshData(): Promise<void> {
		await this.loadData();
		await this.refresh();
	}

	private async loadData(): Promise<void> {
		try {
			const solutionService =
				await this.services.get<ISolutionService>("solutionService");
			this.solutions = await solutionService.list();

			// Select first solution if none selected
			if (!this.selectedSolutionId && this.solutions.length > 0) {
				this.selectedSolutionId = this.solutions[0].id;
			}

			// Load data for selected solution
			if (this.selectedSolutionId) {
				await this.loadSolutionData(this.selectedSolutionId);
			}
		} catch {
			// Services not available yet
			this.solutions = [];
		}
	}

	private async loadSolutionData(solutionId: string): Promise<void> {
		try {
			const ideaService =
				await this.services.get<IIdeaService>("ideaService");
			const requirementService =
				await this.services.get<IRequirementService>("requirementService");
			const jtbdService =
				await this.services.get<IJTBDService>("jtbdService");

			this.ideas = await ideaService.listBySolution(solutionId);
			this.requirements = await requirementService.listBySolution(solutionId);
			this.jtbds = await jtbdService.listBySolution(solutionId);
		} catch {
			this.ideas = [];
			this.requirements = [];
			this.jtbds = [];
		}
	}

	private async renderHeader(container: HTMLElement): Promise<void> {
		const header = container.createDiv({ cls: "ft-matrix-header ft-p-4" });

		const titleRow = header.createDiv({
			cls: "ft-flex ft-items-center ft-justify-between ft-mb-4",
		});

		titleRow.createEl("h2", {
			text: "Traceability Matrix",
			cls: "ft-heading ft-heading-lg ft-m-0",
		});

		// Solution selector dropdown
		if (this.solutions.length > 0) {
			const select = titleRow.createEl("select", {
				cls: "ft-select",
			});

			for (const solution of this.solutions) {
				const option = select.createEl("option", {
					text: solution.name,
					value: solution.id,
				});
				if (solution.id === this.selectedSolutionId) {
					option.selected = true;
				}
			}

			select.addEventListener("change", async (e) => {
				const target = e.target as HTMLSelectElement;
				this.selectedSolutionId = target.value;
				await this.loadSolutionData(this.selectedSolutionId);
				await this.refresh();
			});
		}
	}

	private renderStats(container: HTMLElement): void {
		const statsContainer = container.createDiv({
			cls: "ft-matrix-stats ft-p-4",
		});

		const rows = this.buildTraceabilityRows();
		const covered = rows.filter((r) => r.status === "covered").length;
		const partial = rows.filter((r) => r.status === "partial").length;
		const gaps = rows.filter((r) => r.status === "gap").length;
		const orphans = rows.filter((r) => r.status === "orphan").length;

		// Calculate traceability percentage
		const totalWithJtbd = rows.filter((r) => r.jtbd !== null).length;
		const traceabilityPct =
			totalWithJtbd > 0 ? Math.round((covered / totalWithJtbd) * 100) : 0;

		const statsGrid = statsContainer.createDiv({ cls: "ft-stats-grid" });

		// Traceability percentage
		const traceCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		traceCard.createDiv({
			text: `${traceabilityPct}%`,
			cls: `ft-stat-value ${traceabilityPct >= 80 ? "ft-text-success" : traceabilityPct >= 50 ? "ft-text-warning" : "ft-text-error"}`,
		});
		traceCard.createDiv({
			text: "Traceability",
			cls: "ft-text-sm ft-text-muted",
		});

		// JTBD count
		const jtbdCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		jtbdCard.createDiv({
			text: this.jtbds.length.toString(),
			cls: "ft-stat-value",
		});
		jtbdCard.createDiv({ text: "Jobs", cls: "ft-text-sm ft-text-muted" });

		// Ideas count
		const ideasCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		ideasCard.createDiv({
			text: this.ideas.length.toString(),
			cls: "ft-stat-value",
		});
		ideasCard.createDiv({ text: "Ideas", cls: "ft-text-sm ft-text-muted" });

		// Requirements count
		const reqCard = statsGrid.createDiv({ cls: "ft-stat-card" });
		reqCard.createDiv({
			text: this.requirements.length.toString(),
			cls: "ft-stat-value",
		});
		reqCard.createDiv({
			text: "Requirements",
			cls: "ft-text-sm ft-text-muted",
		});

		// Coverage legend
		const legend = statsContainer.createDiv({
			cls: "ft-matrix-legend ft-flex ft-gap-4 ft-mt-4",
		});
		legend.createSpan({
			text: `Covered: ${covered}`,
			cls: "ft-text-sm ft-text-success",
		});
		legend.createSpan({
			text: `Partial: ${partial}`,
			cls: "ft-text-sm ft-text-warning",
		});
		legend.createSpan({
			text: `Gaps: ${gaps}`,
			cls: "ft-text-sm ft-text-error",
		});
		legend.createSpan({
			text: `Orphans: ${orphans}`,
			cls: "ft-text-sm ft-text-muted",
		});
	}

	private renderMatrix(container: HTMLElement): void {
		const matrixContainer = container.createDiv({
			cls: "ft-matrix-container ft-p-4",
		});

		const rows = this.buildTraceabilityRows();

		if (rows.length === 0) {
			matrixContainer.createDiv({
				text: "No data to display. Add JTBDs, Ideas, or Requirements to see traceability.",
				cls: "ft-text-muted",
			});
			return;
		}

		const table = matrixContainer.createEl("table", { cls: "ft-matrix-table" });

		// Header row
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Job to be Done" });
		headerRow.createEl("th", { text: "Ideas" });
		headerRow.createEl("th", { text: "Requirements" });
		headerRow.createEl("th", { text: "Status" });

		// Body rows
		const tbody = table.createEl("tbody");

		for (const row of rows) {
			const tr = tbody.createEl("tr", { cls: `ft-matrix-row ft-status-${row.status}` });

			// JTBD column
			const jtbdCell = tr.createEl("td", { cls: "ft-matrix-jtbd" });
			if (row.jtbd) {
				const jtbdContent = jtbdCell.createDiv({ cls: "ft-jtbd-content" });
				jtbdContent.createDiv({
					text:
						row.jtbd.jobStatement.length > 60
							? row.jtbd.jobStatement.slice(0, 60) + "..."
							: row.jtbd.jobStatement,
					cls: "ft-jtbd-statement",
				});

				const score = calculateOpportunityScore(
					row.jtbd.importance,
					row.jtbd.satisfaction
				);
				const level = getOpportunityLevel(score);

				jtbdContent.createSpan({
					text: `Opp: ${score}/10`,
					cls: `ft-badge ft-opportunity-${level} ft-text-xs`,
				});
			} else {
				jtbdCell.createSpan({
					text: "(no JTBD)",
					cls: "ft-text-muted ft-text-sm",
				});
			}

			// Ideas column
			const ideasCell = tr.createEl("td", { cls: "ft-matrix-ideas" });
			if (row.ideas.length > 0) {
				for (const idea of row.ideas) {
					const ideaItem = ideasCell.createDiv({ cls: "ft-matrix-item" });
					ideaItem.createSpan({
						text: idea.title,
						cls: "ft-text-sm",
					});
					ideaItem.createSpan({
						text: idea.status,
						cls: "ft-badge ft-badge-muted ft-text-xs ft-ml-1",
					});
				}
			} else {
				ideasCell.createSpan({
					text: "(no ideas)",
					cls: "ft-matrix-gap ft-text-sm",
				});
			}

			// Requirements column
			const reqCell = tr.createEl("td", { cls: "ft-matrix-requirements" });
			if (row.requirements.length > 0) {
				for (const req of row.requirements) {
					const reqItem = reqCell.createDiv({ cls: "ft-matrix-item" });
					reqItem.createSpan({
						text: req.title,
						cls: "ft-text-sm",
					});
					reqItem.createSpan({
						text: req.status,
						cls: "ft-badge ft-badge-muted ft-text-xs ft-ml-1",
					});
				}
			} else {
				reqCell.createSpan({
					text: "(no requirements)",
					cls: "ft-matrix-gap ft-text-sm",
				});
			}

			// Status column
			const statusCell = tr.createEl("td", { cls: "ft-matrix-status" });
			const statusBadge = statusCell.createSpan({
				cls: `ft-badge ft-status-badge-${row.status}`,
			});
			switch (row.status) {
				case "covered":
					statusBadge.setText("Covered");
					break;
				case "partial":
					statusBadge.setText("Partial");
					break;
				case "gap":
					statusBadge.setText("Gap");
					break;
				case "orphan":
					statusBadge.setText("Orphan");
					break;
			}
		}
	}

	private renderGapAnalysis(container: HTMLElement): void {
		const gapContainer = container.createDiv({
			cls: "ft-gap-analysis ft-p-4",
		});

		gapContainer.createEl("h3", {
			text: "Gap Analysis",
			cls: "ft-heading ft-heading-sm ft-mb-3",
		});

		// Orphan ideas (not linked to any JTBD)
		const orphanIdeas = this.ideas.filter((idea) => {
			return !this.jtbds.some(
				(jtbd) => jtbd.linkedIdeas?.includes(idea.id)
			);
		});

		// Orphan requirements (not linked to any idea)
		const orphanRequirements = this.requirements.filter((req) => {
			return !req.linkedIdeas || req.linkedIdeas.length === 0;
		});

		// JTBD without ideas
		const jtbdWithoutIdeas = this.jtbds.filter(
			(jtbd) => !jtbd.linkedIdeas || jtbd.linkedIdeas.length === 0
		);

		// Ideas without requirements (requirements that link to this idea)
		const ideasWithoutReqs = this.ideas.filter((idea) => {
			return !this.requirements.some((req) => req.linkedIdeas?.includes(idea.id));
		});

		if (
			orphanIdeas.length === 0 &&
			orphanRequirements.length === 0 &&
			jtbdWithoutIdeas.length === 0 &&
			ideasWithoutReqs.length === 0
		) {
			gapContainer.createDiv({
				text: "No gaps detected. All items are properly linked.",
				cls: "ft-text-success",
			});
			return;
		}

		const gapGrid = gapContainer.createDiv({ cls: "ft-gap-grid" });

		// JTBD without ideas
		if (jtbdWithoutIdeas.length > 0) {
			const card = gapGrid.createDiv({ cls: "ft-gap-card" });
			card.createDiv({
				text: `Jobs without Ideas (${jtbdWithoutIdeas.length})`,
				cls: "ft-gap-card-header ft-font-medium",
			});
			const list = card.createDiv({ cls: "ft-gap-list" });
			for (const jtbd of jtbdWithoutIdeas.slice(0, 5)) {
				list.createDiv({
					text:
						jtbd.jobStatement.length > 40
							? jtbd.jobStatement.slice(0, 40) + "..."
							: jtbd.jobStatement,
					cls: "ft-text-sm ft-text-muted",
				});
			}
			if (jtbdWithoutIdeas.length > 5) {
				list.createDiv({
					text: `+${jtbdWithoutIdeas.length - 5} more`,
					cls: "ft-text-xs ft-text-muted",
				});
			}
		}

		// Ideas without requirements
		if (ideasWithoutReqs.length > 0) {
			const card = gapGrid.createDiv({ cls: "ft-gap-card" });
			card.createDiv({
				text: `Ideas without Requirements (${ideasWithoutReqs.length})`,
				cls: "ft-gap-card-header ft-font-medium",
			});
			const list = card.createDiv({ cls: "ft-gap-list" });
			for (const idea of ideasWithoutReqs.slice(0, 5)) {
				list.createDiv({
					text: idea.title,
					cls: "ft-text-sm ft-text-muted",
				});
			}
			if (ideasWithoutReqs.length > 5) {
				list.createDiv({
					text: `+${ideasWithoutReqs.length - 5} more`,
					cls: "ft-text-xs ft-text-muted",
				});
			}
		}

		// Orphan ideas
		if (orphanIdeas.length > 0) {
			const card = gapGrid.createDiv({ cls: "ft-gap-card" });
			card.createDiv({
				text: `Orphan Ideas (${orphanIdeas.length})`,
				cls: "ft-gap-card-header ft-font-medium",
			});
			card.createDiv({
				text: "Ideas not linked to any Job",
				cls: "ft-text-xs ft-text-muted ft-mb-2",
			});
			const list = card.createDiv({ cls: "ft-gap-list" });
			for (const idea of orphanIdeas.slice(0, 5)) {
				list.createDiv({
					text: idea.title,
					cls: "ft-text-sm ft-text-muted",
				});
			}
			if (orphanIdeas.length > 5) {
				list.createDiv({
					text: `+${orphanIdeas.length - 5} more`,
					cls: "ft-text-xs ft-text-muted",
				});
			}
		}

		// Orphan requirements
		if (orphanRequirements.length > 0) {
			const card = gapGrid.createDiv({ cls: "ft-gap-card" });
			card.createDiv({
				text: `Orphan Requirements (${orphanRequirements.length})`,
				cls: "ft-gap-card-header ft-font-medium",
			});
			card.createDiv({
				text: "Requirements not linked to any Idea",
				cls: "ft-text-xs ft-text-muted ft-mb-2",
			});
			const list = card.createDiv({ cls: "ft-gap-list" });
			for (const req of orphanRequirements.slice(0, 5)) {
				list.createDiv({
					text: req.title,
					cls: "ft-text-sm ft-text-muted",
				});
			}
			if (orphanRequirements.length > 5) {
				list.createDiv({
					text: `+${orphanRequirements.length - 5} more`,
					cls: "ft-text-xs ft-text-muted",
				});
			}
		}
	}

	/**
	 * Build traceability rows from JTBD → Ideas → Requirements.
	 */
	private buildTraceabilityRows(): TraceabilityRow[] {
		const rows: TraceabilityRow[] = [];

		// Start with JTBDs
		for (const jtbd of this.jtbds) {
			// Get linked ideas
			const linkedIdeas = this.ideas.filter((idea) =>
				jtbd.linkedIdeas?.includes(idea.id)
			);

			// Get requirements linked to those ideas (Requirements have linkedIdeas)
			const linkedRequirements: Requirement[] = [];
			for (const idea of linkedIdeas) {
				const ideaReqs = this.requirements.filter((req) =>
					req.linkedIdeas?.includes(idea.id)
				);
				linkedRequirements.push(...ideaReqs);
			}

			// Determine status
			let status: TraceabilityRow["status"];
			if (linkedIdeas.length > 0 && linkedRequirements.length > 0) {
				status = "covered";
			} else if (linkedIdeas.length > 0) {
				status = "partial"; // Has ideas but no requirements
			} else {
				status = "gap"; // No ideas linked
			}

			rows.push({
				jtbd,
				ideas: linkedIdeas,
				requirements: linkedRequirements,
				status,
			});
		}

		// Add orphan ideas (not linked to any JTBD)
		const orphanIdeas = this.ideas.filter((idea) => {
			return !this.jtbds.some((jtbd) => jtbd.linkedIdeas?.includes(idea.id));
		});

		if (orphanIdeas.length > 0) {
			// Get requirements for orphan ideas (Requirements have linkedIdeas)
			const orphanReqsForIdeas: Requirement[] = [];
			for (const idea of orphanIdeas) {
				const ideaReqs = this.requirements.filter((req) =>
					req.linkedIdeas?.includes(idea.id)
				);
				orphanReqsForIdeas.push(...ideaReqs);
			}

			rows.push({
				jtbd: null,
				ideas: orphanIdeas,
				requirements: orphanReqsForIdeas,
				status: "orphan",
			});
		}

		// Add orphan requirements (not linked to any idea)
		const orphanReqs = this.requirements.filter(
			(req) => !req.linkedIdeas || req.linkedIdeas.length === 0
		);

		if (orphanReqs.length > 0) {
			rows.push({
				jtbd: null,
				ideas: [],
				requirements: orphanReqs,
				status: "orphan",
			});
		}

		return rows;
	}
}
