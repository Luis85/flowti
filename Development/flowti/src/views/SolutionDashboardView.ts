/**
 * Solution Dashboard View
 *
 * A split-view layout showing:
 * - Left: Solution list (sidebar)
 * - Right: Detail view for selected solution with Ideas, Requirements, and JTBDs
 */

import { Notice, type WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../events/types";
import type { Idea, IIdeaService } from "../ideas/types";
import type { JTBD, IJTBDService } from "../jtbd/types";
import { calculateOpportunityScore, getOpportunityLevel } from "../jtbd/types";
import type { Requirement, IRequirementService } from "../requirements/types";
import type { IServiceContainer } from "../services/types";
import type { Solution, ISolutionService } from "../solutions/types";
import { getSolutionTypeLabel, LIFECYCLE_PHASES } from "../solutions/types";
import { BaseServiceView } from "./BaseServiceView";
import { CreateSolutionModal } from "src/solutions/CreateSolutionModal";

export const VIEW_TYPE_SOLUTION_DASHBOARD = "flowti-solution-dashboard";

/**
 * Solution Dashboard with Sidebar + Detail layout.
 */
export class SolutionDashboardView extends BaseServiceView {
  private solutions: Solution[] = [];
  private selectedSolutionId: string | null = null;
  private ideasBySolution: Map<string, Idea[]> = new Map();
  private requirementsBySolution: Map<string, Requirement[]> = new Map();
  private jtbdsBySolution: Map<string, JTBD[]> = new Map();

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
    return VIEW_TYPE_SOLUTION_DASHBOARD;
  }

  getDisplayText(): string {
    return "Solution Dashboard";
  }

  getIcon(): string {
    return "layout-dashboard";
  }

  async onOpen(): Promise<void> {
    // Subscribe to events for reactive updates
    this.subscribe("solution.created", () => this.refreshSidebar());
    this.subscribe("solution.updated", () => this.refresh());
    this.subscribe("solution.deleted", () => this.refreshSidebar());
    this.subscribe("idea.created", () => this.refreshDetail());
    this.subscribe("idea.updated", () => this.refreshDetail());
    this.subscribe("idea.deleted", () => this.refreshDetail());
    this.subscribe("requirement.created", () => this.refreshDetail());
    this.subscribe("requirement.updated", () => this.refreshDetail());
    this.subscribe("requirement.deleted", () => this.refreshDetail());
    this.subscribe("jtbd.created", () => this.refreshDetail());
    this.subscribe("jtbd.updated", () => this.refreshDetail());
    this.subscribe("jtbd.deleted", () => this.refreshDetail());

    await this.loadData();
    await this.refresh();
  }

  protected async refresh(): Promise<void> {
    this.clearContent();
    const container = this.getContentContainer();
    container.addClass("flowti-dashboard");

    // Split view layout
    const splitView = container.createDiv({ cls: "ft-split-view" });

    // Sidebar
    await this.renderSidebar(splitView);

    // Detail pane
    await this.renderDetailPane(splitView);
  }

  private async refreshSidebar(): Promise<void> {
    await this.loadData();
    await this.refresh();
  }

  private async refreshDetail(): Promise<void> {
    if (this.selectedSolutionId) {
      await this.loadSolutionData(this.selectedSolutionId);
    }
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
      const ideaService = await this.services.get<IIdeaService>("ideaService");
      const requirementService =
        await this.services.get<IRequirementService>("requirementService");
      const jtbdService = await this.services.get<IJTBDService>("jtbdService");

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

  private async renderSidebar(container: HTMLElement): Promise<void> {
    const sidebar = container.createDiv({ cls: "ft-sidebar" });

    // Header
    const header = sidebar.createDiv({ cls: "ft-sidebar-header ft-p-3" });
    header.createEl("h3", {
      text: "Solutions",
      cls: "ft-heading ft-heading-sm ft-m-0",
    });

    // Solution list
    const list = sidebar.createDiv({ cls: "ft-sidebar-list" });

    if (this.solutions.length === 0) {
      list.createDiv({
        text: "No solutions yet",
        cls: "ft-p-3 ft-text-muted",
      });
    } else {
      for (const solution of this.solutions) {
        const item = list.createDiv({
          cls: `ft-sidebar-item ${solution.id === this.selectedSolutionId ? "ft-sidebar-item-active" : ""}`,
        });

        item.createSpan({
          text: solution.name,
          cls: "ft-sidebar-item-text",
        });

        item.addEventListener("click", async () => {
          this.selectedSolutionId = solution.id;
          await this.loadSolutionData(solution.id);
          await this.refresh();
        });
      }
    }

    // Add new solution button
    const addBtn = sidebar.createDiv({ cls: "ft-p-3" });
    const btn = addBtn.createEl("button", {
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

  private async renderDetailPane(container: HTMLElement): Promise<void> {
    const detail = container.createDiv({ cls: "ft-detail-pane ft-p-4" });

    if (!this.selectedSolutionId) {
      detail.createDiv({
        text: "Select a solution to view details",
        cls: "ft-text-muted",
      });
      return;
    }

    const solution = this.solutions.find(
      (s) => s.id === this.selectedSolutionId,
    );
    if (!solution) {
      detail.createDiv({
        text: "Solution not found",
        cls: "ft-text-muted",
      });
      return;
    }

    // Header
    await this.renderDetailHeader(detail, solution);

    // Stats
    await this.renderStats(detail, solution);

    // Lifecycle progress
    this.renderLifecycleProgress(detail, solution);

    // Entity sections
    this.renderIdeasSection(detail, solution);
    this.renderRequirementsSection(detail, solution);
    this.renderJTBDSection(detail, solution);
  }

  private async renderDetailHeader(
    container: HTMLElement,
    solution: Solution,
  ): Promise<void> {
    const header = container.createDiv({
      cls: "ft-dashboard-header ft-mb-4",
    });

    const titleRow = header.createDiv({
      cls: "ft-flex ft-items-center ft-gap-3",
    });

    titleRow.createEl("h2", {
      text: solution.name,
      cls: "ft-heading ft-heading-lg ft-m-0",
    });

    titleRow.createSpan({
      text: getSolutionTypeLabel(solution.type),
      cls: "ft-badge ft-badge-accent",
    });

    const meta = header.createDiv({
      cls: "ft-flex ft-gap-2 ft-mt-2",
    });

    meta.createSpan({
      text: `Phase: ${solution.currentPhase}`,
      cls: "ft-text-sm ft-text-muted",
    });
  }

  private async renderStats(
    container: HTMLElement,
    solution: Solution,
  ): Promise<void> {
    const ideas = this.ideasBySolution.get(solution.id) || [];
    const requirements = this.requirementsBySolution.get(solution.id) || [];
    const jtbds = this.jtbdsBySolution.get(solution.id) || [];

    // Calculate average opportunity score
    let avgOpportunity = 0;
    if (jtbds.length > 0) {
      const totalScore = jtbds.reduce((sum, j) => {
        return sum + calculateOpportunityScore(j.importance, j.satisfaction);
      }, 0);
      avgOpportunity = Math.round(totalScore / jtbds.length);
    }

    const statsGrid = container.createDiv({
      cls: "ft-stats-grid ft-mb-4",
    });

    // Ideas stat
    const ideasCard = statsGrid.createDiv({ cls: "ft-stat-card" });
    ideasCard.createDiv({
      text: ideas.length.toString(),
      cls: "ft-stat-value",
    });
    ideasCard.createDiv({ text: "Ideas", cls: "ft-text-sm ft-text-muted" });

    // Requirements stat
    const reqCard = statsGrid.createDiv({ cls: "ft-stat-card" });
    reqCard.createDiv({
      text: requirements.length.toString(),
      cls: "ft-stat-value",
    });
    reqCard.createDiv({
      text: "Requirements",
      cls: "ft-text-sm ft-text-muted",
    });

    // JTBD stat
    const jtbdCard = statsGrid.createDiv({ cls: "ft-stat-card" });
    jtbdCard.createDiv({ text: jtbds.length.toString(), cls: "ft-stat-value" });
    jtbdCard.createDiv({ text: "Jobs", cls: "ft-text-sm ft-text-muted" });

    // Opportunity stat
    const oppCard = statsGrid.createDiv({ cls: "ft-stat-card" });
    const oppLevel = getOpportunityLevel(avgOpportunity);
    oppCard.createDiv({
      text: jtbds.length > 0 ? `${avgOpportunity}/10` : "-",
      cls: `ft-stat-value ft-opportunity-${oppLevel}`,
    });
    oppCard.createDiv({
      text: "Avg Opportunity",
      cls: "ft-text-sm ft-text-muted",
    });
  }

  private renderLifecycleProgress(
    container: HTMLElement,
    solution: Solution,
  ): void {
    const section = container.createDiv({ cls: "ft-mb-4" });
    section.createEl("h4", {
      text: "Lifecycle Progress",
      cls: "ft-heading ft-heading-sm ft-mb-2",
    });

    const progress = section.createDiv({ cls: "ft-lifecycle-progress" });

    const currentIndex = LIFECYCLE_PHASES.indexOf(solution.currentPhase);

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

  private renderIdeasSection(container: HTMLElement, solution: Solution): void {
    const ideas = this.ideasBySolution.get(solution.id) || [];
    this.renderCollapsibleSection(
      container,
      "ideas",
      `Ideas (${ideas.length})`,
      () => {
        const content = container.createDiv({ cls: "ft-entity-list" });

        if (ideas.length === 0) {
          content.createDiv({
            text: "No ideas yet",
            cls: "ft-text-muted ft-text-sm",
          });
        } else {
          for (const idea of ideas) {
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

  private renderRequirementsSection(
    container: HTMLElement,
    solution: Solution,
  ): void {
    const requirements = this.requirementsBySolution.get(solution.id) || [];
    this.renderCollapsibleSection(
      container,
      "requirements",
      `Requirements (${requirements.length})`,
      () => {
        const content = container.createDiv({ cls: "ft-entity-list" });

        if (requirements.length === 0) {
          content.createDiv({
            text: "No requirements yet",
            cls: "ft-text-muted ft-text-sm",
          });
        } else {
          for (const req of requirements) {
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

  private renderJTBDSection(container: HTMLElement, solution: Solution): void {
    const jtbds = this.jtbdsBySolution.get(solution.id) || [];
    this.renderCollapsibleSection(
      container,
      "jtbd",
      `Jobs to be Done (${jtbds.length})`,
      () => {
        const content = container.createDiv({ cls: "ft-entity-list" });

        if (jtbds.length === 0) {
          content.createDiv({
            text: "No jobs defined yet",
            cls: "ft-text-muted ft-text-sm",
          });
        } else {
          for (const jtbd of jtbds) {
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
