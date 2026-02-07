import { App, Modal, Setting } from "obsidian";
import type { Idea, IIdeaService } from "../ideas/types";
import type { Requirement, IRequirementService } from "../requirements/types";
import { PRIORITIES, type PriorityName } from "../requirements/types";
import type { ISolutionService, Solution } from "../solutions/types";
import type { UUID } from "../utils/types";
import type { Feature, IFeatureService } from "./types";

/**
 * Modal dialog for creating a new feature.
 * Prompts the user to select a solution and enter feature details,
 * with optional linking to ideas and requirements.
 */
export class CreateFeatureModal extends Modal {
	private featureTitle: string = "";
	private featureDescription: string = "";
	private selectedSolutionId: string = "";
	private selectedPriority: PriorityName | undefined = undefined;
	private selectedIdeas: string[] = [];
	private selectedRequirements: string[] = [];

	private featureService: IFeatureService;
	private solutionService: ISolutionService;
	private ideaService: IIdeaService;
	private requirementService: IRequirementService;

	private solutions: Solution[] = [];
	private ideas: Idea[] = [];
	private requirements: Requirement[] = [];

	private onSuccess?: (feature: Feature) => void;

	/**
	 * Creates a new CreateFeatureModal.
	 * @param app - The Obsidian app instance
	 * @param featureService - The feature service to create features
	 * @param solutionService - The solution service to list solutions
	 * @param ideaService - The idea service to list ideas for linking
	 * @param requirementService - The requirement service to list requirements for linking
	 * @param onSuccess - Optional callback when feature is created successfully
	 */
	constructor(
		app: App,
		featureService: IFeatureService,
		solutionService: ISolutionService,
		ideaService: IIdeaService,
		requirementService: IRequirementService,
		onSuccess?: (feature: Feature) => void
	) {
		super(app);
		this.featureService = featureService;
		this.solutionService = solutionService;
		this.ideaService = ideaService;
		this.requirementService = requirementService;
		this.onSuccess = onSuccess;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-create-feature-modal");

		// Load solutions first
		this.solutions = await this.solutionService.list();

		if (this.solutions.length === 0) {
			this.renderNoSolutions(contentEl);
			return;
		}

		// Set default selection to first solution
		this.selectedSolutionId = this.solutions[0].id;

		// Load ideas and requirements for the selected solution
		await this.loadLinkedEntities();

		this.renderForm(contentEl);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Load ideas and requirements for the selected solution.
	 */
	private async loadLinkedEntities(): Promise<void> {
		if (this.selectedSolutionId) {
			this.ideas = await this.ideaService.listBySolution(this.selectedSolutionId);
			this.requirements = await this.requirementService.listBySolution(
				this.selectedSolutionId
			);
		} else {
			this.ideas = [];
			this.requirements = [];
		}
	}

	/**
	 * Render message when no solutions exist.
	 */
	private renderNoSolutions(contentEl: HTMLElement): void {
		contentEl.createEl("h2", { text: "Add Feature to Solution" });
		contentEl.createEl("p", {
			text: "No solutions found. Please create a solution first before adding features.",
			cls: "ft-text-muted",
		});

		const buttonContainer = contentEl.createDiv({
			cls: "flowti-modal-buttons ft-flex ft-gap-2 ft-justify-end ft-mt-4",
		});

		const closeBtn = buttonContainer.createEl("button", {
			text: "Close",
			cls: "ft-btn",
		});
		closeBtn.addEventListener("click", () => this.close());
	}

	/**
	 * Render the feature creation form.
	 */
	private renderForm(contentEl: HTMLElement): void {
		// Header
		contentEl.createEl("h2", { text: "Add Feature to Solution" });
		contentEl.createEl("p", {
			text: "Define a concrete product feature. Features bridge ideas and requirements.",
			cls: "ft-text-muted",
		});

		// Solution dropdown (changes available ideas/requirements)
		new Setting(contentEl)
			.setName("Solution")
			.setDesc("Select the solution this feature belongs to")
			.addDropdown((dropdown) => {
				for (const solution of this.solutions) {
					dropdown.addOption(solution.id, solution.name);
				}
				dropdown.setValue(this.selectedSolutionId);
				dropdown.onChange(async (value) => {
					this.selectedSolutionId = value;
					// Clear linked selections when solution changes
					this.selectedIdeas = [];
					this.selectedRequirements = [];
					// Reload entities and refresh form
					await this.loadLinkedEntities();
					this.refreshForm();
				});
			});

		// Title input
		new Setting(contentEl)
			.setName("Feature Title")
			.setDesc("A clear, concise name for this feature (e.g., 'Dark Mode')")
			.addText((text) =>
				text
					.setPlaceholder("e.g., Dark Mode, Multi-language Support")
					.setValue(this.featureTitle)
					.onChange((value) => {
						this.featureTitle = value;
					})
			);

		// Description textarea
		new Setting(contentEl)
			.setName("Description (optional)")
			.setDesc("Describe what this feature does and why it's valuable")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder("Describe the feature in more detail...")
					.setValue(this.featureDescription)
					.onChange((value) => {
						this.featureDescription = value;
					})
			);

		// Priority dropdown
		new Setting(contentEl)
			.setName("Priority (optional)")
			.setDesc("Set the priority for this feature")
			.addDropdown((dropdown) => {
				dropdown.addOption("", "No priority");
				for (const priority of PRIORITIES) {
					dropdown.addOption(priority, priority);
				}
				dropdown.setValue(this.selectedPriority ?? "");
				dropdown.onChange((value) => {
					this.selectedPriority = value ? (value as PriorityName) : undefined;
				});
			});

		// Linked Ideas (multi-select area)
		this.renderLinkedIdeasSection(contentEl);

		// Linked Requirements (multi-select area)
		this.renderLinkedRequirementsSection(contentEl);

		// Buttons
		const buttonContainer = contentEl.createDiv({
			cls: "flowti-modal-buttons ft-flex ft-gap-2 ft-justify-end ft-mt-4",
		});

		// Cancel button
		const cancelBtn = buttonContainer.createEl("button", {
			text: "Cancel",
			cls: "ft-btn",
		});
		cancelBtn.addEventListener("click", () => this.close());

		// Create button
		const createBtn = buttonContainer.createEl("button", {
			text: "Add Feature",
			cls: "ft-btn ft-btn-primary",
		});
		createBtn.addEventListener("click", () => this.handleCreate());
	}

	/**
	 * Render linked ideas section with checkboxes.
	 */
	private renderLinkedIdeasSection(contentEl: HTMLElement): void {
		const section = contentEl.createDiv({ cls: "ft-linked-section ft-mb-4" });

		section.createEl("label", {
			text: "Linked Ideas (optional)",
			cls: "ft-text-sm ft-font-medium",
		});
		section.createEl("p", {
			text: "Select ideas that inspired this feature",
			cls: "ft-text-xs ft-text-muted ft-mb-2",
		});

		const listContainer = section.createDiv({
			cls: "ft-checkbox-list ft-border ft-rounded ft-p-2 ft-max-h-32 ft-overflow-y-auto",
		});

		if (this.ideas.length === 0) {
			listContainer.createEl("p", {
				text: "No ideas available for this solution",
				cls: "ft-text-muted ft-text-sm",
			});
		} else {
			for (const idea of this.ideas) {
				const item = listContainer.createDiv({ cls: "ft-checkbox-item ft-flex ft-gap-2 ft-items-center" });

				const checkbox = item.createEl("input", {
					type: "checkbox",
					attr: { id: `idea-${idea.id}` },
				});
				(checkbox as HTMLInputElement).checked = this.selectedIdeas.includes(idea.id);
				checkbox.addEventListener("change", () => {
					if ((checkbox as HTMLInputElement).checked) {
						if (!this.selectedIdeas.includes(idea.id)) {
							this.selectedIdeas.push(idea.id);
						}
					} else {
						this.selectedIdeas = this.selectedIdeas.filter((id) => id !== idea.id);
					}
				});

				item.createEl("label", {
					text: idea.title,
					attr: { for: `idea-${idea.id}` },
					cls: "ft-text-sm",
				});
			}
		}
	}

	/**
	 * Render linked requirements section with checkboxes.
	 */
	private renderLinkedRequirementsSection(contentEl: HTMLElement): void {
		const section = contentEl.createDiv({ cls: "ft-linked-section ft-mb-4" });

		section.createEl("label", {
			text: "Linked Requirements (optional)",
			cls: "ft-text-sm ft-font-medium",
		});
		section.createEl("p", {
			text: "Select requirements needed to implement this feature",
			cls: "ft-text-xs ft-text-muted ft-mb-2",
		});

		const listContainer = section.createDiv({
			cls: "ft-checkbox-list ft-border ft-rounded ft-p-2 ft-max-h-32 ft-overflow-y-auto",
		});

		if (this.requirements.length === 0) {
			listContainer.createEl("p", {
				text: "No requirements available for this solution",
				cls: "ft-text-muted ft-text-sm",
			});
		} else {
			for (const req of this.requirements) {
				const item = listContainer.createDiv({ cls: "ft-checkbox-item ft-flex ft-gap-2 ft-items-center" });

				const checkbox = item.createEl("input", {
					type: "checkbox",
					attr: { id: `req-${req.id}` },
				});
				(checkbox as HTMLInputElement).checked = this.selectedRequirements.includes(req.id);
				checkbox.addEventListener("change", () => {
					if ((checkbox as HTMLInputElement).checked) {
						if (!this.selectedRequirements.includes(req.id)) {
							this.selectedRequirements.push(req.id);
						}
					} else {
						this.selectedRequirements = this.selectedRequirements.filter(
							(id) => id !== req.id
						);
					}
				});

				item.createEl("label", {
					text: req.title,
					attr: { for: `req-${req.id}` },
					cls: "ft-text-sm",
				});
			}
		}
	}

	/**
	 * Refresh the form when solution changes.
	 */
	private refreshForm(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.renderForm(contentEl);
	}

	/**
	 * Handle the create button click.
	 */
	private async handleCreate(): Promise<void> {
		const title = this.featureTitle.trim();

		if (!title) {
			this.showError("Please enter a feature title");
			return;
		}

		if (!this.selectedSolutionId) {
			this.showError("Please select a solution");
			return;
		}

		try {
			const feature = await this.featureService.create({
				title,
				description: this.featureDescription.trim() || undefined,
				solutionId: this.selectedSolutionId as UUID,
				priority: this.selectedPriority,
				linkedIdeas:
					this.selectedIdeas.length > 0
						? (this.selectedIdeas as UUID[])
						: undefined,
				linkedRequirements:
					this.selectedRequirements.length > 0
						? (this.selectedRequirements as UUID[])
						: undefined,
			});

			this.onSuccess?.(feature);
			this.close();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create feature";
			this.showError(message);
		}
	}

	/**
	 * Show an error message in the modal.
	 */
	private showError(message: string): void {
		const { contentEl } = this;

		// Remove existing error
		const existingError = contentEl.querySelector(".flowti-modal-error");
		if (existingError) {
			existingError.remove();
		}

		// Add new error
		const errorEl = contentEl.createDiv({
			cls: "flowti-modal-error ft-alert-error ft-p-2 ft-mb-4",
		});
		errorEl.setText(message);

		// Insert before buttons
		const buttons = contentEl.querySelector(".flowti-modal-buttons");
		if (buttons) {
			buttons.before(errorEl);
		}
	}
}
