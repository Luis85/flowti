import { App, Modal, Setting } from "obsidian";
import type { ISolutionService, Solution } from "../solutions/types";
import type { UUID } from "../utils/types";
import type { Idea, IIdeaService } from "./types";

/**
 * Modal dialog for creating a new idea.
 * Prompts the user to select a solution and enter idea details.
 */
export class CreateIdeaModal extends Modal {
	private ideaTitle: string = "";
	private ideaDescription: string = "";
	private selectedSolutionId: string = "";
	private ideaService: IIdeaService;
	private solutionService: ISolutionService;
	private solutions: Solution[] = [];
	private onSuccess?: (idea: Idea) => void;

	/**
	 * Creates a new CreateIdeaModal.
	 * @param app - The Obsidian app instance
	 * @param ideaService - The idea service to create ideas
	 * @param solutionService - The solution service to list solutions
	 * @param onSuccess - Optional callback when idea is created successfully
	 */
	constructor(
		app: App,
		ideaService: IIdeaService,
		solutionService: ISolutionService,
		onSuccess?: (idea: Idea) => void
	) {
		super(app);
		this.ideaService = ideaService;
		this.solutionService = solutionService;
		this.onSuccess = onSuccess;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-create-idea-modal");

		// Load solutions first
		this.solutions = await this.solutionService.list();

		if (this.solutions.length === 0) {
			this.renderNoSolutions(contentEl);
			return;
		}

		// Set default selection to first solution
		this.selectedSolutionId = this.solutions[0].id;

		this.renderForm(contentEl);
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Render message when no solutions exist.
	 */
	private renderNoSolutions(contentEl: HTMLElement): void {
		contentEl.createEl("h2", { text: "Add Idea to Solution" });
		contentEl.createEl("p", {
			text: "No solutions found. Please create a solution first before adding ideas.",
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
	 * Render the idea creation form.
	 */
	private renderForm(contentEl: HTMLElement): void {
		// Header
		contentEl.createEl("h2", { text: "Add Idea to Solution" });
		contentEl.createEl("p", {
			text: "Capture your idea and link it to a solution. Ideas can evolve into requirements.",
			cls: "ft-text-muted",
		});

		// Solution dropdown
		new Setting(contentEl)
			.setName("Solution")
			.setDesc("Select the solution this idea belongs to")
			.addDropdown((dropdown) => {
				for (const solution of this.solutions) {
					dropdown.addOption(solution.id, solution.name);
				}
				dropdown.setValue(this.selectedSolutionId);
				dropdown.onChange((value) => {
					this.selectedSolutionId = value;
				});
			});

		// Title input
		new Setting(contentEl)
			.setName("Idea Title")
			.setDesc("A clear, concise title for your idea")
			.addText((text) =>
				text
					.setPlaceholder("e.g., Add dark mode support")
					.setValue(this.ideaTitle)
					.onChange((value) => {
						this.ideaTitle = value;
					})
			);

		// Description textarea
		new Setting(contentEl)
			.setName("Description (optional)")
			.setDesc("Elaborate on the idea - what problem does it solve?")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder("Describe the idea in more detail...")
					.setValue(this.ideaDescription)
					.onChange((value) => {
						this.ideaDescription = value;
					})
			);

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
			text: "Add Idea",
			cls: "ft-btn ft-btn-primary",
		});
		createBtn.addEventListener("click", () => this.handleCreate());
	}

	/**
	 * Handle the create button click.
	 */
	private async handleCreate(): Promise<void> {
		const title = this.ideaTitle.trim();

		if (!title) {
			this.showError("Please enter an idea title");
			return;
		}

		if (!this.selectedSolutionId) {
			this.showError("Please select a solution");
			return;
		}

		try {
			const idea = await this.ideaService.create({
				title,
				description: this.ideaDescription.trim() || undefined,
				solutionId: this.selectedSolutionId as UUID,
			});

			this.onSuccess?.(idea);
			this.close();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create idea";
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
