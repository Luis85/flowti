/**
 * Command registry for Flowti.
 *
 * Central location for defining all plugin commands.
 * Commands are registered with the command registry and
 * automatically bound to Obsidian's command system.
 */

import { App, Modal, Notice, Setting } from "obsidian";
import { CanvasGenerator } from "../canvas/CanvasGenerator";
import { CreateFeatureModal } from "../features/CreateFeatureModal";
import type { IFeatureService } from "../features/types";
import { CreateIdeaModal } from "../ideas/CreateIdeaModal";
import type { IIdeaService } from "../ideas/types";
import { CreateJTBDModal } from "../jtbd/CreateJTBDModal";
import type { IJTBDService } from "../jtbd/types";
import { CreateRequirementModal } from "../requirements/CreateRequirementModal";
import type { IRequirementService } from "../requirements/types";
import { CreateSolutionModal } from "../solutions/CreateSolutionModal";
import type { ISolutionService, Solution } from "../solutions/types";
import { VIEW_TYPE_COMPONENT_SHOWCASE } from "../views/ComponentShowcaseView";
import { VIEW_TYPE_LIFECYCLE } from "../views/LifecycleView";
import { VIEW_TYPE_SOLUTION_DETAIL } from "../views/SolutionDetailView";
import { VIEW_TYPE_SOLUTION_EXPLORER } from "../views/SolutionExplorerView";
import { VIEW_TYPE_TRACEABILITY_MATRIX } from "../views/TraceabilityMatrixView";
import type { CommandDefinition, ICommandRegistry } from "./types";

/**
 * Creates all command definitions for the application.
 *
 * @returns Array of command definitions
 */
export function createCommandDefinitions(): CommandDefinition[] {
	return [
		// ─────────────────────────────────────────────────────────────
		// Solution Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:create-solution",
			name: "Create new Solution",
			icon: "plus-circle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening create solution modal");

				try {
					const solutionService =
						await ctx.services.get<ISolutionService>("solutionService");

					const modal = new CreateSolutionModal(
						ctx.app,
						solutionService,
						(name) => {
							new Notice(`Solution "${name}" created successfully`);
							ctx.logger.info(`Solution created: ${name}`);
						}
					);
					modal.open();
				} catch (error) {
					ctx.logger.error("Failed to open create solution modal", error);
					new Notice("Failed to open solution creator. Check console for details.");
				}
			},
		},

		// ─────────────────────────────────────────────────────────────
		// Idea Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:add-idea",
			name: "Add Idea to Solution",
			icon: "lightbulb",
			handler: async (ctx) => {
				ctx.logger.debug("Opening add idea modal");

				try {
					const ideaService =
						await ctx.services.get<IIdeaService>("ideaService");
					const solutionService =
						await ctx.services.get<ISolutionService>("solutionService");

					const modal = new CreateIdeaModal(
						ctx.app,
						ideaService,
						solutionService,
						(idea) => {
							new Notice(`Idea "${idea.title}" added successfully`);
							ctx.logger.info(`Idea created: ${idea.title}`);
						}
					);
					modal.open();
				} catch (error) {
					ctx.logger.error("Failed to open add idea modal", error);
					new Notice("Failed to open idea creator. Check console for details.");
				}
			},
		},

		// ─────────────────────────────────────────────────────────────
		// Requirement Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:add-requirement",
			name: "Add Requirement to Solution",
			icon: "check-square",
			handler: async (ctx) => {
				ctx.logger.debug("Opening add requirement modal");

				try {
					const requirementService =
						await ctx.services.get<IRequirementService>("requirementService");
					const solutionService =
						await ctx.services.get<ISolutionService>("solutionService");

					const modal = new CreateRequirementModal(
						ctx.app,
						requirementService,
						solutionService,
						(requirement) => {
							new Notice(`Requirement "${requirement.title}" added successfully`);
							ctx.logger.info(`Requirement created: ${requirement.title}`);
						}
					);
					modal.open();
				} catch (error) {
					ctx.logger.error("Failed to open add requirement modal", error);
					new Notice("Failed to open requirement creator. Check console for details.");
				}
			},
		},

		// ─────────────────────────────────────────────────────────────
		// JTBD Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:add-jtbd",
			name: "Add Job to be Done",
			icon: "target",
			handler: async (ctx) => {
				ctx.logger.debug("Opening add JTBD modal");

				try {
					const jtbdService =
						await ctx.services.get<IJTBDService>("jtbdService");
					const solutionService =
						await ctx.services.get<ISolutionService>("solutionService");

					const modal = new CreateJTBDModal(
						ctx.app,
						jtbdService,
						solutionService,
						(jtbd) => {
							new Notice(`Job "${jtbd.jobStatement.slice(0, 30)}..." added successfully`);
							ctx.logger.info(`JTBD created: ${jtbd.jobStatement}`);
						}
					);
					modal.open();
				} catch (error) {
					ctx.logger.error("Failed to open add JTBD modal", error);
					new Notice("Failed to open JTBD creator. Check console for details.");
				}
			},
		},

		// ─────────────────────────────────────────────────────────────
		// Feature Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:add-feature",
			name: "Add Feature to Solution",
			icon: "puzzle",
			handler: async (ctx) => {
				ctx.logger.debug("Opening add feature modal");

				try {
					const featureService =
						await ctx.services.get<IFeatureService>("featureService");
					const solutionService =
						await ctx.services.get<ISolutionService>("solutionService");
					const ideaService =
						await ctx.services.get<IIdeaService>("ideaService");
					const requirementService =
						await ctx.services.get<IRequirementService>("requirementService");

					const modal = new CreateFeatureModal(
						ctx.app,
						featureService,
						solutionService,
						ideaService,
						requirementService,
						(feature) => {
							new Notice(`Feature "${feature.title}" added successfully`);
							ctx.logger.info(`Feature created: ${feature.title}`);
						}
					);
					modal.open();
				} catch (error) {
					ctx.logger.error("Failed to open add feature modal", error);
					new Notice("Failed to open feature creator. Check console for details.");
				}
			},
		},

		// ─────────────────────────────────────────────────────────────
		// Developer Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:open-component-showcase",
			name: "Open Component Showcase",
			icon: "palette",
			handler: async (ctx) => {
				ctx.logger.debug("Opening component showcase view");
				const { workspace } = ctx.app;

				// Check if view is already open
				const existing = workspace.getLeavesOfType(VIEW_TYPE_COMPONENT_SHOWCASE);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				// Open in right sidebar
				const leaf = workspace.getRightLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_COMPONENT_SHOWCASE,
						active: true,
					});
					workspace.revealLeaf(leaf);
				}
			},
		},

		// ─────────────────────────────────────────────────────────────
		// View Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:open-solution-explorer",
			name: "Open Solution Explorer",
			icon: "folder-tree",
			handler: async (ctx) => {
				ctx.logger.debug("Opening solution explorer view");
				const { workspace } = ctx.app;

				// Check if view is already open
				const existing = workspace.getLeavesOfType(VIEW_TYPE_SOLUTION_EXPLORER);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				// Open in left sidebar
				const leaf = workspace.getLeftLeaf(false);
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_SOLUTION_EXPLORER,
						active: true,
					});
					workspace.revealLeaf(leaf);
				}
			},
		},

		{
			id: "flowti:open-solution-detail",
			name: "Open Solution Detail",
			icon: "layout-dashboard",
			handler: async (ctx) => {
				ctx.logger.debug("Opening solution detail view");
				const { workspace } = ctx.app;

				// Check if view is already open
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
			},
		},

		{
			id: "flowti:open-lifecycle",
			name: "Open Lifecycle View",
			icon: "git-branch",
			handler: async (ctx) => {
				ctx.logger.debug("Opening lifecycle view");
				const { workspace } = ctx.app;

				// Check if view is already open
				const existing = workspace.getLeavesOfType(VIEW_TYPE_LIFECYCLE);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				// Open in main area
				const leaf = workspace.getLeaf("tab");
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_LIFECYCLE,
						active: true,
					});
					workspace.revealLeaf(leaf);
				}
			},
		},

		{
			id: "flowti:open-traceability",
			name: "Open Traceability Matrix",
			icon: "table-2",
			handler: async (ctx) => {
				ctx.logger.debug("Opening traceability matrix view");
				const { workspace } = ctx.app;

				// Check if view is already open
				const existing = workspace.getLeavesOfType(VIEW_TYPE_TRACEABILITY_MATRIX);
				if (existing.length > 0) {
					workspace.revealLeaf(existing[0]);
					return;
				}

				// Open in main area
				const leaf = workspace.getLeaf("tab");
				if (leaf) {
					await leaf.setViewState({
						type: VIEW_TYPE_TRACEABILITY_MATRIX,
						active: true,
					});
					workspace.revealLeaf(leaf);
				}
			},
		},

		// ─────────────────────────────────────────────────────────────
		// Canvas Commands
		// ─────────────────────────────────────────────────────────────

		{
			id: "flowti:generate-canvas",
			name: "Generate Solution Canvas",
			icon: "layout-grid",
			handler: async (ctx) => {
				ctx.logger.debug("Opening generate canvas modal");

				try {
					const solutionService =
						await ctx.services.get<ISolutionService>("solutionService");
					const solutions = await solutionService.list();

					if (solutions.length === 0) {
						new Notice("No solutions found. Create a solution first.");
						return;
					}

					// Show solution picker modal
					const modal = new GenerateCanvasModal(
						ctx.app,
						solutions,
						async (solutionId, canvasType) => {
							const generator = new CanvasGenerator({
								app: ctx.app,
								services: ctx.services,
								eventBus: ctx.eventBus,
							});

							let result;
							if (canvasType === "traceability") {
								result = await generator.generateTraceabilityCanvas(solutionId);
							} else {
								result = await generator.generateSolutionCanvas(solutionId);
							}

							if (result.success && result.canvasPath) {
								new Notice(`Canvas generated: ${result.canvasPath}`);
								ctx.logger.info(`Canvas generated: ${result.canvasPath}`);

								// Open the canvas file
								const file = ctx.app.vault.getAbstractFileByPath(result.canvasPath);
								if (file) {
									await ctx.app.workspace.getLeaf("tab").openFile(file as never);
								}
							} else {
								new Notice(`Failed to generate canvas: ${result.error}`);
								ctx.logger.error(`Canvas generation failed: ${result.error}`);
							}
						}
					);
					modal.open();
				} catch (error) {
					ctx.logger.error("Failed to generate canvas", error);
					new Notice("Failed to generate canvas. Check console for details.");
				}
			},
		},
	];
}

/**
 * Registers all commands with the registry.
 *
 * @param registry - The command registry
 */
export function registerCommands(registry: ICommandRegistry): void {
	const commands = createCommandDefinitions();
	registry.registerMany(commands);
}

/**
 * Modal for selecting solution and canvas type.
 */
class GenerateCanvasModal extends Modal {
	private solutions: Solution[];
	private selectedSolutionId: string = "";
	private selectedCanvasType: "solution" | "traceability" = "solution";
	private onGenerate: (solutionId: string, canvasType: "solution" | "traceability") => void;

	constructor(
		app: App,
		solutions: Solution[],
		onGenerate: (solutionId: string, canvasType: "solution" | "traceability") => void
	) {
		super(app as never);
		this.solutions = solutions;
		this.selectedSolutionId = solutions[0]?.id || "";
		this.onGenerate = onGenerate;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-generate-canvas-modal");

		contentEl.createEl("h2", { text: "Generate Canvas" });
		contentEl.createEl("p", {
			text: "Generate a visual canvas for your solution.",
			cls: "ft-text-muted",
		});

		// Solution dropdown
		new Setting(contentEl)
			.setName("Solution")
			.setDesc("Select the solution to visualize")
			.addDropdown((dropdown) => {
				for (const solution of this.solutions) {
					dropdown.addOption(solution.id, solution.name);
				}
				dropdown.setValue(this.selectedSolutionId);
				dropdown.onChange((value) => {
					this.selectedSolutionId = value;
				});
			});

		// Canvas type dropdown
		new Setting(contentEl)
			.setName("Canvas Type")
			.setDesc("Choose the visualization type")
			.addDropdown((dropdown) => {
				dropdown.addOption("solution", "Solution Overview (Hierarchical)");
				dropdown.addOption("traceability", "Traceability Matrix (Columns)");
				dropdown.setValue(this.selectedCanvasType);
				dropdown.onChange((value) => {
					this.selectedCanvasType = value as "solution" | "traceability";
				});
			});

		// Buttons
		const buttonContainer = contentEl.createDiv({
			cls: "flowti-modal-buttons ft-flex ft-gap-2 ft-justify-end ft-mt-4",
		});

		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "ft-btn",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const generateBtn = buttonContainer.createEl("button", {
			text: "Generate",
			cls: "ft-btn ft-btn-primary",
		});
		generateBtn.addEventListener("click", () => {
			this.onGenerate(this.selectedSolutionId, this.selectedCanvasType);
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
