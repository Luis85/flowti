/**
 * Lifecycle View
 *
 * Visualizes the 9 lifecycle phases of a solution:
 * Ideate → Design → Validate → Develop → Test → Release → Run → Measure → Learn
 *
 * Shows current phase, completed phases, and artifacts per phase.
 */

import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../events/types";
import type { Idea, IIdeaService } from "../ideas/types";
import type { JTBD, IJTBDService } from "../jtbd/types";
import type { Requirement, IRequirementService } from "../requirements/types";
import type { IServiceContainer } from "../services/types";
import type { Solution, ISolutionService, LifecyclePhaseName } from "../solutions/types";
import { LIFECYCLE_PHASES } from "../solutions/types";
import { BaseServiceView } from "./BaseServiceView";

export const VIEW_TYPE_LIFECYCLE = "flowti-lifecycle";

/**
 * Phase metadata with icons and descriptions.
 */
interface PhaseMetadata {
	icon: string;
	description: string;
	deliverables: string[];
}

/**
 * Metadata for each lifecycle phase.
 */
const PHASE_METADATA: Record<LifecyclePhaseName, PhaseMetadata> = {
	Ideate: {
		icon: "💡",
		description: "Generate and capture ideas",
		deliverables: ["Ideas", "JTBD", "Problem Statements"],
	},
	Design: {
		icon: "✏️",
		description: "Define requirements and architecture",
		deliverables: ["Requirements", "Architecture", "Wireframes"],
	},
	Validate: {
		icon: "✓",
		description: "Validate assumptions with stakeholders",
		deliverables: ["Prototypes", "User Feedback", "Feasibility Study"],
	},
	Develop: {
		icon: "⚙️",
		description: "Build the solution",
		deliverables: ["Code", "Components", "Documentation"],
	},
	Test: {
		icon: "🧪",
		description: "Verify quality and functionality",
		deliverables: ["Test Cases", "Bug Reports", "Quality Metrics"],
	},
	Release: {
		icon: "🚀",
		description: "Deploy to production",
		deliverables: ["Release Notes", "Deployment", "Training"],
	},
	Run: {
		icon: "▶️",
		description: "Operate and maintain",
		deliverables: ["Operations", "Support", "Monitoring"],
	},
	Measure: {
		icon: "📊",
		description: "Collect metrics and feedback",
		deliverables: ["KPIs", "Analytics", "User Research"],
	},
	Learn: {
		icon: "🔄",
		description: "Analyze and improve",
		deliverables: ["Retrospectives", "Improvements", "Knowledge Base"],
	},
};

/**
 * Lifecycle View showing the 9 phases of solution development.
 */
export class LifecycleView extends BaseServiceView {
	private solutions: Solution[] = [];
	private selectedSolutionId: string | null = null;
	private ideasBySolution: Map<string, Idea[]> = new Map();
	private requirementsBySolution: Map<string, Requirement[]> = new Map();
	private jtbdsBySolution: Map<string, JTBD[]> = new Map();

	constructor(
		leaf: WorkspaceLeaf,
		services: IServiceContainer,
		eventBus: IEventBus
	) {
		super(leaf, services, eventBus);
	}

	getViewType(): string {
		return VIEW_TYPE_LIFECYCLE;
	}

	getDisplayText(): string {
		return "Lifecycle View";
	}

	getIcon(): string {
		return "git-branch";
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
		container.addClass("flowti-lifecycle-view");

		// Header with solution selector
		await this.renderHeader(container);

		if (!this.selectedSolutionId) {
			container.createDiv({
				text: "Select a solution to view its lifecycle",
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

		// Lifecycle visualization
		await this.renderLifecycle(container, solution);

		// Phase details
		await this.renderPhaseDetails(container, solution);
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

			const ideas = await ideaService.listBySolution(solutionId);
			const requirements = await requirementService.listBySolution(solutionId);
			const jtbds = await jtbdService.listBySolution(solutionId);

			this.ideasBySolution.set(solutionId, ideas);
			this.requirementsBySolution.set(solutionId, requirements);
			this.jtbdsBySolution.set(solutionId, jtbds);
		} catch {
			// Services not available
		}
	}

	private async renderHeader(container: HTMLElement): Promise<void> {
		const header = container.createDiv({ cls: "ft-lifecycle-header ft-p-4" });

		const titleRow = header.createDiv({
			cls: "ft-flex ft-items-center ft-justify-between ft-mb-4",
		});

		titleRow.createEl("h2", {
			text: "Solution Lifecycle",
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

	private async renderLifecycle(
		container: HTMLElement,
		solution: Solution
	): Promise<void> {
		const lifecycleContainer = container.createDiv({
			cls: "ft-lifecycle-container ft-p-4",
		});

		const currentIndex = LIFECYCLE_PHASES.indexOf(solution.currentPhase);

		// Create the horizontal flow
		const flow = lifecycleContainer.createDiv({ cls: "ft-lifecycle-flow" });

		for (let i = 0; i < LIFECYCLE_PHASES.length; i++) {
			const phase = LIFECYCLE_PHASES[i];
			const metadata = PHASE_METADATA[phase];
			const isCompleted = i < currentIndex;
			const isCurrent = i === currentIndex;
			const isPending = i > currentIndex;

			// Phase node
			const node = flow.createDiv({
				cls: `ft-lifecycle-node ${isCompleted ? "ft-completed" : ""} ${isCurrent ? "ft-current" : ""} ${isPending ? "ft-pending" : ""}`,
			});

			// Icon circle
			const circle = node.createDiv({ cls: "ft-lifecycle-circle" });
			if (isCompleted) {
				circle.innerHTML = "✓";
			} else {
				circle.setText(metadata.icon);
			}

			// Phase name
			node.createDiv({
				text: phase,
				cls: "ft-lifecycle-name",
			});

			// Artifact count
			const count = this.getPhaseArtifactCount(solution.id, phase);
			if (count > 0) {
				node.createDiv({
					text: `${count} artifacts`,
					cls: "ft-lifecycle-count ft-text-xs ft-text-muted",
				});
			}

			// Click handler to advance phase
			if (isCurrent || isCompleted) {
				node.addClass("ft-clickable");
				node.addEventListener("click", () => {
					this.scrollToPhaseDetails(phase);
				});
			}

			// Connector (except for last)
			if (i < LIFECYCLE_PHASES.length - 1) {
				const connector = flow.createDiv({
					cls: `ft-lifecycle-connector ${isCompleted ? "ft-completed" : ""}`,
				});
				connector.createDiv({ cls: "ft-lifecycle-connector-line" });
			}
		}

		// Loop indicator (Learn → Ideate)
		const loopIndicator = lifecycleContainer.createDiv({
			cls: "ft-lifecycle-loop ft-text-sm ft-text-muted ft-mt-4 ft-text-center",
		});
		loopIndicator.innerHTML = "↻ Continuous improvement cycle";
	}

	private async renderPhaseDetails(
		container: HTMLElement,
		solution: Solution
	): Promise<void> {
		const detailsContainer = container.createDiv({
			cls: "ft-lifecycle-details ft-p-4",
		});

		const currentIndex = LIFECYCLE_PHASES.indexOf(solution.currentPhase);

		for (let i = 0; i < LIFECYCLE_PHASES.length; i++) {
			const phase = LIFECYCLE_PHASES[i];
			const metadata = PHASE_METADATA[phase];
			const isCompleted = i < currentIndex;
			const isCurrent = i === currentIndex;

			const phaseSection = detailsContainer.createDiv({
				cls: `ft-phase-section ft-mb-4 ${isCurrent ? "ft-current" : ""}`,
				attr: { "data-phase": phase },
			});

			// Phase header
			const phaseHeader = phaseSection.createDiv({
				cls: "ft-phase-header ft-flex ft-items-center ft-gap-2 ft-mb-2",
			});

			const statusIcon = phaseHeader.createSpan({ cls: "ft-phase-status" });
			if (isCompleted) {
				statusIcon.innerHTML = "✓";
				statusIcon.addClass("ft-completed");
			} else if (isCurrent) {
				statusIcon.innerHTML = "●";
				statusIcon.addClass("ft-current");
			} else {
				statusIcon.innerHTML = "○";
				statusIcon.addClass("ft-pending");
			}

			phaseHeader.createEl("h3", {
				text: `${metadata.icon} ${phase}`,
				cls: "ft-heading ft-heading-sm ft-m-0",
			});

			if (isCurrent) {
				phaseHeader.createSpan({
					text: "Current",
					cls: "ft-badge ft-badge-accent",
				});
			}

			// Phase description
			phaseSection.createDiv({
				text: metadata.description,
				cls: "ft-text-muted ft-mb-2",
			});

			// Expected deliverables
			const deliverablesDiv = phaseSection.createDiv({
				cls: "ft-phase-deliverables ft-mb-2",
			});
			deliverablesDiv.createSpan({
				text: "Deliverables: ",
				cls: "ft-text-sm ft-font-medium",
			});
			deliverablesDiv.createSpan({
				text: metadata.deliverables.join(", "),
				cls: "ft-text-sm ft-text-muted",
			});

			// Artifacts for this phase
			if (isCurrent || isCompleted) {
				this.renderPhaseArtifacts(phaseSection, solution.id, phase);
			}
		}
	}

	private renderPhaseArtifacts(
		container: HTMLElement,
		solutionId: string,
		phase: LifecyclePhaseName
	): void {
		const artifacts = this.getPhaseArtifacts(solutionId, phase);

		if (artifacts.ideas.length === 0 && artifacts.requirements.length === 0 && artifacts.jtbds.length === 0) {
			return;
		}

		const artifactsDiv = container.createDiv({
			cls: "ft-phase-artifacts ft-card ft-p-2 ft-mt-2",
		});

		// JTBD (primarily in Ideate)
		if (artifacts.jtbds.length > 0) {
			const jtbdSection = artifactsDiv.createDiv({ cls: "ft-mb-2" });
			jtbdSection.createDiv({
				text: `Jobs to be Done (${artifacts.jtbds.length})`,
				cls: "ft-text-xs ft-font-medium ft-text-muted ft-mb-1",
			});
			for (const jtbd of artifacts.jtbds.slice(0, 3)) {
				const item = jtbdSection.createDiv({ cls: "ft-artifact-item ft-text-sm" });
				item.createSpan({
					text: jtbd.jobStatement.length > 40
						? jtbd.jobStatement.slice(0, 40) + "..."
						: jtbd.jobStatement,
				});
			}
			if (artifacts.jtbds.length > 3) {
				jtbdSection.createDiv({
					text: `+${artifacts.jtbds.length - 3} more`,
					cls: "ft-text-xs ft-text-muted",
				});
			}
		}

		// Ideas (primarily in Ideate)
		if (artifacts.ideas.length > 0) {
			const ideasSection = artifactsDiv.createDiv({ cls: "ft-mb-2" });
			ideasSection.createDiv({
				text: `Ideas (${artifacts.ideas.length})`,
				cls: "ft-text-xs ft-font-medium ft-text-muted ft-mb-1",
			});
			for (const idea of artifacts.ideas.slice(0, 3)) {
				const item = ideasSection.createDiv({ cls: "ft-artifact-item ft-text-sm" });
				item.createSpan({ text: idea.title });
				item.createSpan({
					text: idea.status,
					cls: "ft-badge ft-badge-muted ft-text-xs ft-ml-1",
				});
			}
			if (artifacts.ideas.length > 3) {
				ideasSection.createDiv({
					text: `+${artifacts.ideas.length - 3} more`,
					cls: "ft-text-xs ft-text-muted",
				});
			}
		}

		// Requirements (primarily in Design)
		if (artifacts.requirements.length > 0) {
			const reqSection = artifactsDiv.createDiv();
			reqSection.createDiv({
				text: `Requirements (${artifacts.requirements.length})`,
				cls: "ft-text-xs ft-font-medium ft-text-muted ft-mb-1",
			});
			for (const req of artifacts.requirements.slice(0, 3)) {
				const item = reqSection.createDiv({ cls: "ft-artifact-item ft-text-sm" });
				item.createSpan({ text: req.title });
				item.createSpan({
					text: req.status,
					cls: "ft-badge ft-badge-muted ft-text-xs ft-ml-1",
				});
			}
			if (artifacts.requirements.length > 3) {
				reqSection.createDiv({
					text: `+${artifacts.requirements.length - 3} more`,
					cls: "ft-text-xs ft-text-muted",
				});
			}
		}
	}

	private getPhaseArtifacts(
		solutionId: string,
		phase: LifecyclePhaseName
	): { ideas: Idea[]; requirements: Requirement[]; jtbds: JTBD[] } {
		const ideas = this.ideasBySolution.get(solutionId) || [];
		const requirements = this.requirementsBySolution.get(solutionId) || [];
		const jtbds = this.jtbdsBySolution.get(solutionId) || [];

		// Map artifacts to phases based on typical workflow
		// In a real implementation, artifacts would have a phase property
		switch (phase) {
			case "Ideate":
				return { ideas, requirements: [], jtbds };
			case "Design":
				return { ideas: [], requirements, jtbds: [] };
			case "Validate":
				// Show validated ideas and requirements
				return {
					ideas: ideas.filter((i) => i.status === "Implemented"),
					requirements: requirements.filter((r) => r.status === "Approved"),
					jtbds: jtbds.filter((j) => j.status === "Validated"),
				};
			default:
				return { ideas: [], requirements: [], jtbds: [] };
		}
	}

	private getPhaseArtifactCount(
		solutionId: string,
		phase: LifecyclePhaseName
	): number {
		const artifacts = this.getPhaseArtifacts(solutionId, phase);
		return artifacts.ideas.length + artifacts.requirements.length + artifacts.jtbds.length;
	}

	private scrollToPhaseDetails(phase: LifecyclePhaseName): void {
		const container = this.getContentContainer();
		const phaseSection = container.querySelector(`[data-phase="${phase}"]`);
		if (phaseSection) {
			phaseSection.scrollIntoView({ behavior: "smooth", block: "start" });
		}
	}
}
