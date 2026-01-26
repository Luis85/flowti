import { App, Modal, Setting } from "obsidian";
import type { ISolutionService, SolutionTypeName } from "./types";
import { getSolutionTypeIcon, getSolutionTypeLabel, SOLUTION_TYPES } from "./types";

/**
 * Modal dialog for creating a new solution.
 * Prompts the user to enter solution name, type, and optional description.
 */
export class CreateSolutionModal extends Modal {
	private solutionName: string = "";
	private solutionType: SolutionTypeName = "Application";
	private solutionDescription: string = "";
	private solutionService: ISolutionService;
	private onSuccess?: (name: string) => void;

	/**
	 * Creates a new CreateSolutionModal.
	 * @param app - The Obsidian app instance
	 * @param solutionService - The solution service to create solutions
	 * @param onSuccess - Optional callback when solution is created successfully
	 */
	constructor(
		app: App,
		solutionService: ISolutionService,
		onSuccess?: (name: string) => void
	) {
		super(app);
		this.solutionService = solutionService;
		this.onSuccess = onSuccess;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-create-solution-modal");

		// Header
		contentEl.createEl("h2", { text: "Create New Solution" });
		contentEl.createEl("p", {
			text: "Define the foundation for your new solution. Choose a type that best describes what you're building.",
			cls: "ft-text-muted",
		});

		// Name input
		new Setting(contentEl)
			.setName("Solution Name")
			.setDesc("A clear, descriptive name for your solution")
			.addText((text) =>
				text
					.setPlaceholder("e.g., Customer Onboarding Process")
					.setValue(this.solutionName)
					.onChange((value) => {
						this.solutionName = value;
					})
			);

		// Type dropdown
		new Setting(contentEl)
			.setName("Solution Type")
			.setDesc("The category that best describes this solution")
			.addDropdown((dropdown) => {
				for (const type of SOLUTION_TYPES) {
					dropdown.addOption(type, getSolutionTypeLabel(type));
				}
				dropdown.setValue(this.solutionType);
				dropdown.onChange((value) => {
					this.solutionType = value as SolutionTypeName;
					this.updateTypeDescription(contentEl);
				});
			});

		// Type description (dynamic)
		const typeDescEl = contentEl.createDiv({
			cls: "flowti-type-description ft-text-muted ft-text-sm",
		});
		typeDescEl.setAttribute("data-type-desc", "true");
		this.updateTypeDescription(contentEl);

		// Description textarea
		new Setting(contentEl)
			.setName("Description (optional)")
			.setDesc("A brief description of what this solution aims to achieve")
			.addTextArea((textarea) =>
				textarea
					.setPlaceholder("Describe the problem this solution addresses...")
					.setValue(this.solutionDescription)
					.onChange((value) => {
						this.solutionDescription = value;
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
			text: "Create Solution",
			cls: "ft-btn ft-btn-primary",
		});
		createBtn.addEventListener("click", () => this.handleCreate());
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}

	/**
	 * Update the type description based on selected type.
	 */
	private updateTypeDescription(contentEl: HTMLElement): void {
		const descEl = contentEl.querySelector("[data-type-desc]");
		if (!descEl) return;

		const descriptions: Record<SolutionTypeName, string> = {
			Application:
				"Software-based solutions like web apps, plugins, tools, or SaaS products.",
			Process:
				"Business or operational processes defining how work is executed.",
			Service:
				"Customer-facing or internal services delivering ongoing value.",
			Product:
				"Market-facing offerings combining applications, services, and processes.",
			Capability:
				"Organizational abilities combining people, processes, and tools.",
			Data: "Data products, analytics, and information supporting decisions.",
			Tool: "Supporting systems or platforms enabling work.",
			Organization:
				"Organizational structures, teams, and governance models.",
			Policy: "Rules, standards, and policies guiding behavior and decisions.",
		};

		const icon = getSolutionTypeIcon(this.solutionType);
		descEl.innerHTML = `<span class="ft-flex ft-items-center ft-gap-2">
			<span data-lucide="${icon}"></span>
			${descriptions[this.solutionType]}
		</span>`;
	}

	/**
	 * Handle the create button click.
	 */
	private async handleCreate(): Promise<void> {
		const name = this.solutionName.trim();

		if (!name) {
			// Show validation error
			this.showError("Please enter a solution name");
			return;
		}

		try {
			await this.solutionService.create({
				name,
				type: this.solutionType,
				description: this.solutionDescription.trim() || undefined,
			});

			this.onSuccess?.(name);
			this.close();
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Failed to create solution";
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
