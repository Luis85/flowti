import { App, Modal, Setting } from "obsidian";
import type { ISolutionService, Solution } from "../solutions/types";
import type { UUID } from "../utils/types";
import type {
	IRequirementService,
	PriorityName,
	Requirement,
} from "./types";
import { getPriorityLabel, PRIORITIES } from "./types";

/**
 * Modal dialog for creating a new requirement.
 * Prompts the user to select a solution and enter requirement details.
 */
export class CreateRequirementModal extends Modal {
	private reqTitle: string = "";
	private reqDescription: string = "";
	private reqPriority: PriorityName = "Medium";
	private acceptanceCriteriaText: string = "";
	private selectedSolutionId: string = "";
	private requirementService: IRequirementService;
	private solutionService: ISolutionService;
	private solutions: Solution[] = [];
	private onSuccess?: (requirement: Requirement) => void;

	/**
	 * Creates a new CreateRequirementModal.
	 * @param app - The Obsidian app instance
	 * @param requirementService - The requirement service to create requirements
	 * @param solutionService - The solution service to list solutions
	 * @param onSuccess - Optional callback when requirement is created successfully
	 */
	constructor(
		app: App,
		requirementService: IRequirementService,
		solutionService: ISolutionService,
		onSuccess?: (requirement: Requirement) => void
	) {
		super(app);
		this.requirementService = requirementService;
		this.solutionService = solutionService;
		this.onSuccess = onSuccess;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-create-requirement-modal");

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
		contentEl.createEl("h2", { text: "Add Requirement to Solution" });
		contentEl.createEl("p", {
			text: "No solutions found. Please create a solution first before adding requirements.",
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
	 * Render the requirement creation form.
	 */
	private renderForm(contentEl: HTMLElement): void {
		// Header
		contentEl.createEl("h2", { text: "Add Requirement to Solution" });
		contentEl.createEl("p", {
			text: "Define a clear, verifiable requirement. Good requirements are specific, measurable, and testable.",
			cls: "ft-text-muted",
		});

		// Solution dropdown
		new Setting(contentEl)
			.setName("Solution")
			.setDesc("Select the solution this requirement belongs to")
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
			.setName("Requirement Title")
			.setDesc("A clear, descriptive title")
			.addText((text) =>
				text
					.setPlaceholder("e.g., User Authentication via OAuth")
					.setValue(this.reqTitle)
					.onChange((value) => {
						this.reqTitle = value;
					})
			);

		// Priority dropdown
		new Setting(contentEl)
			.setName("Priority")
			.setDesc("How important is this requirement?")
			.addDropdown((dropdown) => {
				for (const priority of PRIORITIES) {
					dropdown.addOption(priority, getPriorityLabel(priority));
				}
				dropdown.setValue(this.reqPriority);
				dropdown.onChange((value) => {
					this.reqPriority = value as PriorityName;
				});
			});

		// Description textarea
		new Setting(contentEl)
			.setName("Description (optional)")
			.setDesc("Describe the requirement clearly and unambiguously")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder(
						"The system must... so that users can..."
					)
					.setValue(this.reqDescription)
					.onChange((value) => {
						this.reqDescription = value;
					})
			);

		// Acceptance Criteria textarea
		new Setting(contentEl)
			.setName("Acceptance Criteria (optional)")
			.setDesc("Enter each criterion on a new line. These define how the requirement will be verified.")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder(
						"User can log in with Google\nUser can log in with GitHub\nSession persists for 7 days"
					)
					.setValue(this.acceptanceCriteriaText)
					.onChange((value) => {
						this.acceptanceCriteriaText = value;
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
			text: "Add Requirement",
			cls: "ft-btn ft-btn-primary",
		});
		createBtn.addEventListener("click", () => this.handleCreate());
	}

	/**
	 * Handle the create button click.
	 */
	private async handleCreate(): Promise<void> {
		const title = this.reqTitle.trim();

		if (!title) {
			this.showError("Please enter a requirement title");
			return;
		}

		if (!this.selectedSolutionId) {
			this.showError("Please select a solution");
			return;
		}

		// Parse acceptance criteria from text
		const acceptanceCriteria = this.acceptanceCriteriaText
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0);

		try {
			const requirement = await this.requirementService.create({
				title,
				description: this.reqDescription.trim() || undefined,
				priority: this.reqPriority,
				solutionId: this.selectedSolutionId as UUID,
				acceptanceCriteria:
					acceptanceCriteria.length > 0 ? acceptanceCriteria : undefined,
			});

			this.onSuccess?.(requirement);
			this.close();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Failed to create requirement";
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
