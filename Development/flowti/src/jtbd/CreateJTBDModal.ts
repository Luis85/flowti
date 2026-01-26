import { App, Modal, Setting } from "obsidian";
import type { ISolutionService, Solution } from "../solutions/types";
import type { UUID } from "../utils/types";
import type { JTBD, IJTBDService, ScaleValue } from "./types";
import { SCALE_VALUES, getScaleLabel } from "./types";

/**
 * Modal dialog for creating a new Job to be Done.
 * Prompts the user to select a solution and enter JTBD details.
 */
export class CreateJTBDModal extends Modal {
	private jobStatement: string = "";
	private context: string = "";
	private motivation: string = "";
	private outcome: string = "";
	private importance: ScaleValue = 3;
	private satisfaction: ScaleValue = 3;
	private selectedSolutionId: string = "";
	private jtbdService: IJTBDService;
	private solutionService: ISolutionService;
	private solutions: Solution[] = [];
	private onSuccess?: (jtbd: JTBD) => void;

	/**
	 * Creates a new CreateJTBDModal.
	 * @param app - The Obsidian app instance
	 * @param jtbdService - The JTBD service to create JTBDs
	 * @param solutionService - The solution service to list solutions
	 * @param onSuccess - Optional callback when JTBD is created successfully
	 */
	constructor(
		app: App,
		jtbdService: IJTBDService,
		solutionService: ISolutionService,
		onSuccess?: (jtbd: JTBD) => void
	) {
		super(app);
		this.jtbdService = jtbdService;
		this.solutionService = solutionService;
		this.onSuccess = onSuccess;
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-create-jtbd-modal");

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
		contentEl.createEl("h2", { text: "Add Job to be Done" });
		contentEl.createEl("p", {
			text: "No solutions found. Please create a solution first before adding Jobs to be Done.",
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
	 * Render the JTBD creation form.
	 */
	private renderForm(contentEl: HTMLElement): void {
		// Header
		contentEl.createEl("h2", { text: "Add Job to be Done" });
		contentEl.createEl("p", {
			text: 'Capture user needs in the format: "When [context], I want to [motivation], so I can [outcome]"',
			cls: "ft-text-muted",
		});

		// Solution dropdown
		new Setting(contentEl)
			.setName("Solution")
			.setDesc("Select the solution this job belongs to")
			.addDropdown((dropdown) => {
				for (const solution of this.solutions) {
					dropdown.addOption(solution.id, solution.name);
				}
				dropdown.setValue(this.selectedSolutionId);
				dropdown.onChange((value) => {
					this.selectedSolutionId = value;
				});
			});

		// Job Statement input
		new Setting(contentEl)
			.setName("Job Statement")
			.setDesc("A concise summary of the job (e.g., 'Track project progress at a glance')")
			.addText((text) =>
				text
					.setPlaceholder("e.g., Track project progress at a glance")
					.setValue(this.jobStatement)
					.onChange((value) => {
						this.jobStatement = value;
					})
			);

		// Context textarea
		new Setting(contentEl)
			.setName("Context (When...)")
			.setDesc("What situation triggers this job?")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder("When managing a software development project...")
					.setValue(this.context)
					.onChange((value) => {
						this.context = value;
					})
			);

		// Motivation textarea
		new Setting(contentEl)
			.setName("Motivation (I want to...)")
			.setDesc("What action or desire does the user have?")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder("I want to see what's done, in progress, and blocked...")
					.setValue(this.motivation)
					.onChange((value) => {
						this.motivation = value;
					})
			);

		// Outcome textarea
		new Setting(contentEl)
			.setName("Desired Outcome (So I can...)")
			.setDesc("What result does the user expect?")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder("So I can make informed decisions about priorities...")
					.setValue(this.outcome)
					.onChange((value) => {
						this.outcome = value;
					})
			);

		// Importance dropdown
		new Setting(contentEl)
			.setName("Importance")
			.setDesc("How important is this job to the user?")
			.addDropdown((dropdown) => {
				for (const value of SCALE_VALUES) {
					dropdown.addOption(
						value.toString(),
						`${value} - ${getScaleLabel(value, "importance")}`
					);
				}
				dropdown.setValue(this.importance.toString());
				dropdown.onChange((value) => {
					this.importance = parseInt(value, 10) as ScaleValue;
					this.updateOpportunityDisplay(contentEl);
				});
			});

		// Satisfaction dropdown
		new Setting(contentEl)
			.setName("Current Satisfaction")
			.setDesc("How satisfied is the user with existing solutions?")
			.addDropdown((dropdown) => {
				for (const value of SCALE_VALUES) {
					dropdown.addOption(
						value.toString(),
						`${value} - ${getScaleLabel(value, "satisfaction")}`
					);
				}
				dropdown.setValue(this.satisfaction.toString());
				dropdown.onChange((value) => {
					this.satisfaction = parseInt(value, 10) as ScaleValue;
					this.updateOpportunityDisplay(contentEl);
				});
			});

		// Opportunity Score display
		const opportunityContainer = contentEl.createDiv({
			cls: "ft-opportunity-display ft-card ft-p-3 ft-mt-2 ft-mb-4",
		});
		this.renderOpportunityScore(opportunityContainer);

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
			text: "Add Job",
			cls: "ft-btn ft-btn-primary",
		});
		createBtn.addEventListener("click", () => this.handleCreate());
	}

	/**
	 * Render the opportunity score display.
	 */
	private renderOpportunityScore(container: HTMLElement): void {
		container.empty();

		const score = this.importance + Math.max(this.importance - this.satisfaction, 0);
		const level = score >= 7 ? "high" : score >= 4 ? "medium" : "low";

		container.createDiv({
			cls: "ft-flex ft-justify-between ft-items-center",
		}).innerHTML = `
			<span class="ft-text-muted">Opportunity Score:</span>
			<span class="ft-badge ft-opportunity-${level} ft-font-bold">${score}/10</span>
		`;

		const explanation = container.createDiv({ cls: "ft-text-sm ft-text-muted ft-mt-2" });
		if (level === "high") {
			explanation.setText("High opportunity - Important job with low satisfaction");
		} else if (level === "medium") {
			explanation.setText("Medium opportunity - Room for improvement");
		} else {
			explanation.setText("Low opportunity - Already well-served or not important");
		}
	}

	/**
	 * Update the opportunity display when values change.
	 */
	private updateOpportunityDisplay(contentEl: HTMLElement): void {
		const container = contentEl.querySelector(".ft-opportunity-display");
		if (container) {
			this.renderOpportunityScore(container as HTMLElement);
		}
	}

	/**
	 * Handle the create button click.
	 */
	private async handleCreate(): Promise<void> {
		const statement = this.jobStatement.trim();

		if (!statement) {
			this.showError("Please enter a job statement");
			return;
		}

		if (!this.selectedSolutionId) {
			this.showError("Please select a solution");
			return;
		}

		try {
			const jtbd = await this.jtbdService.create({
				jobStatement: statement,
				context: this.context.trim() || undefined,
				motivation: this.motivation.trim() || undefined,
				outcome: this.outcome.trim() || undefined,
				importance: this.importance,
				satisfaction: this.satisfaction,
				solutionId: this.selectedSolutionId as UUID,
			});

			this.onSuccess?.(jtbd);
			this.close();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create job";
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
