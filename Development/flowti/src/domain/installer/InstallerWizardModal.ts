import { App, Modal, Setting } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import { DEFAULT_IBDE_FOLDERS } from "./folders";
import type { IInstallerService, InstallerStepStatusEntry } from "./types";

type WizardPage = "welcome" | "review" | "progress" | "complete";

/**
 * Multi-step wizard modal for the Flowti IBDE first-run installation.
 *
 * Replaces `UserSetupModal` with a richer flow:
 * 1. Welcome — collect user name
 * 2. Review  — preview what will be installed
 * 3. Progress — live step execution with status indicators
 * 4. Complete — summary or error with retry
 */
export class InstallerWizardModal extends Modal {
	private currentPage: WizardPage = "welcome";
	private userName = "";
	private installerService: IInstallerService;
	private eventBus: IEventBus;
	private stepStatuses: InstallerStepStatusEntry[] = [];
	private unsubscribers: (() => void)[] = [];
	private installSuccess = false;
	private installError = "";

	/**
	 * Shows the wizard if installation hasn't been completed.
	 */
	static showIfNeeded(
		app: App,
		installerService: IInstallerService,
		eventBus: IEventBus,
	): void {
		if (!installerService.isInstalled()) {
			const modal = new InstallerWizardModal(app, installerService, eventBus);
			modal.open();
		}
	}

	constructor(app: App, installerService: IInstallerService, eventBus: IEventBus) {
		super(app);
		this.installerService = installerService;
		this.eventBus = eventBus;
	}

	onOpen(): void {
		this.renderPage();
	}

	onClose(): void {
		this.cleanupListeners();
		this.contentEl.empty();
	}

	private renderPage(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-installer-modal");

		switch (this.currentPage) {
			case "welcome":
				this.renderWelcomePage(contentEl);
				break;
			case "review":
				this.renderReviewPage(contentEl);
				break;
			case "progress":
				this.renderProgressPage(contentEl);
				break;
			case "complete":
				this.renderCompletePage(contentEl);
				break;
		}
	}

	// ─────────────────────────────────────────────────────────
	// Page 1: Welcome
	// ─────────────────────────────────────────────────────────

	private renderWelcomePage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });

		container.createEl("h2", {
			text: "Welcome to Flowti IBDE",
			cls: "ft-heading ft-heading-lg",
		});

		container.createEl("p", {
			text: "Let's set up your Integrated Business Development Environment. This wizard will create your user profile and scaffold the folder structure for your vault.",
			cls: "ft-text-muted",
		});

		container.createEl("p", {
			text: "IBDE stands for Integrated Business Development Environment \u2014 an event-driven framework that watches, ingests, and processes files in your vault, turning raw file changes into meaningful business events.",
			cls: "ft-text-muted ft-text-sm",
		});

		new Setting(container)
			.setName("Your name")
			.setDesc("Enter your display name to get started")
			.addText((text) =>
				text
					.setPlaceholder("Enter your name")
					.setValue(this.userName)
					.onChange((value) => {
						this.userName = value;
					}),
			);

		const nav = container.createDiv({ cls: "ft-flex ft-justify-end ft-gap-2 ft-mt-2" });

		nav.createEl("button", {
			text: "Next",
			cls: "ft-btn ft-btn-primary",
		}).addEventListener("click", () => {
			if (this.userName.trim()) {
				this.currentPage = "review";
				this.renderPage();
			}
		});
	}

	// ─────────────────────────────────────────────────────────
	// Page 2: Review
	// ─────────────────────────────────────────────────────────

	private renderReviewPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });

		container.createEl("h2", {
			text: "Review Installation",
			cls: "ft-heading ft-heading-lg",
		});

		container.createEl("p", {
			text: `Installing as: ${this.userName.trim()}`,
			cls: "ft-text-muted",
		});

		container.createEl("p", {
			text: "Each step is idempotent \u2014 if you run the installer again later, already-completed steps will be safely skipped.",
			cls: "ft-text-muted ft-text-sm",
		});

		// Render a card per step with its onboarding intro
		for (const step of this.installerService.getSteps()) {
			const card = container.createDiv({ cls: "ft-card ft-p-3" });
			card.createEl("h3", {
				text: step.name,
				cls: "ft-heading ft-heading-sm ft-mb-2",
			});
			card.createEl("p", {
				text: step.intro,
				cls: "ft-text-muted ft-mb-2",
			});
			card.createEl("p", {
				text: step.description,
				cls: "ft-text-faint ft-text-sm",
			});
		}

		// Folder preview (collapsed detail)
		const folderCard = container.createDiv({ cls: "ft-card ft-p-3" });
		folderCard.createEl("h3", {
			text: "Folders to create",
			cls: "ft-heading ft-heading-sm ft-mb-2",
		});
		const folderList = folderCard.createDiv({ cls: "ft-list ft-folder-list" });
		for (const folder of DEFAULT_IBDE_FOLDERS) {
			const item = folderList.createDiv({ cls: "ft-list-item" });
			item.createSpan({ text: `📁 ${folder}` });
		}

		// Navigation
		const nav = container.createDiv({ cls: "ft-flex ft-justify-between ft-mt-2" });

		nav.createEl("button", {
			text: "Back",
			cls: "ft-btn ft-btn-secondary",
		}).addEventListener("click", () => {
			this.currentPage = "welcome";
			this.renderPage();
		});

		nav.createEl("button", {
			text: "Install",
			cls: "ft-btn ft-btn-primary",
		}).addEventListener("click", () => {
			this.currentPage = "progress";
			this.renderPage();
			void this.runInstallation();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Page 3: Progress
	// ─────────────────────────────────────────────────────────

	private renderProgressPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });

		container.createEl("h2", {
			text: "Installing...",
			cls: "ft-heading ft-heading-lg",
		});

		container.createEl("p", {
			text: "Setting up your environment. This will only take a moment.",
			cls: "ft-text-muted",
		});

		// Initialize step statuses
		this.stepStatuses = this.installerService.getSteps().map((step) => ({
			id: step.id,
			name: step.name,
			status: "pending" as const,
		}));

		// Render step list
		const stepList = container.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2" });
		this.renderStepList(stepList);

		// Subscribe to step events for live updates
		this.subscribeToStepEvents(stepList);
	}

	private renderStepList(el: HTMLElement): void {
		el.empty();
		for (const entry of this.stepStatuses) {
			const row = el.createDiv({
				cls: `ft-step-indicator ft-step-${entry.status}`,
			});

			const icon = row.createDiv({ cls: "ft-step-icon" });
			icon.textContent = this.getStepIcon(entry.status);

			const info = row.createDiv({ cls: "ft-flex ft-flex-col" });
			info.createEl("span", { text: entry.name, cls: "ft-font-medium" });
			if (entry.message) {
				info.createEl("span", { text: entry.message, cls: "ft-text-muted ft-text-sm" });
			}
		}
	}

	private getStepIcon(status: string): string {
		switch (status) {
			case "completed":
				return "✓";
			case "failed":
				return "✗";
			case "running":
				return "…";
			case "skipped":
				return "—";
			default:
				return "○";
		}
	}

	private subscribeToStepEvents(stepListEl: HTMLElement): void {
		const unsub1 = this.eventBus.on("installer.step.started", (event) => {
			const entry = this.stepStatuses.find((s) => s.id === event.payload.stepId);
			if (entry) {
				entry.status = "running";
				this.renderStepList(stepListEl);
			}
		});

		const unsub2 = this.eventBus.on("installer.step.completed", (event) => {
			const entry = this.stepStatuses.find((s) => s.id === event.payload.id);
			if (entry) {
				entry.status = event.payload.status;
				entry.message = event.payload.message;
				this.renderStepList(stepListEl);
			}
		});

		this.unsubscribers.push(unsub1, unsub2);
	}

	private async runInstallation(): Promise<void> {
		const success = await this.installerService.runAll({
			userName: this.userName.trim(),
		});

		this.installSuccess = success;
		if (!success) {
			const failedStep = this.stepStatuses.find((s) => s.status === "failed");
			this.installError = failedStep?.message ?? "Installation failed";
		}

		this.cleanupListeners();
		this.currentPage = "complete";
		this.renderPage();
	}

	// ─────────────────────────────────────────────────────────
	// Page 4: Complete
	// ─────────────────────────────────────────────────────────

	private renderCompletePage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });

		if (this.installSuccess) {
			container.createEl("h2", {
				text: "Setup Complete",
				cls: "ft-heading ft-heading-lg",
			});

			const alert = container.createDiv({ cls: "ft-alert ft-alert-success ft-p-3" });
			alert.createEl("p", {
				text: `Welcome, ${this.userName.trim()}! Your Flowti IBDE environment is ready.`,
			});

			const summary = container.createDiv({ cls: "ft-card ft-p-3" });
			summary.createEl("h3", {
				text: "What was set up",
				cls: "ft-heading ft-heading-sm ft-mb-2",
			});
			const list = summary.createEl("ul", { cls: "ft-flex ft-flex-col ft-gap-1" });
			for (const entry of this.stepStatuses) {
				const statusLabel = entry.status === "skipped" ? " (skipped)" : "";
				list.createEl("li", {
					text: `\u2713 ${entry.name}${statusLabel}`,
					cls: "ft-text-muted",
				});
			}

			// Next steps guidance
			const nextSteps = container.createDiv({ cls: "ft-card ft-p-3" });
			nextSteps.createEl("h3", {
				text: "What to do next",
				cls: "ft-heading ft-heading-sm ft-mb-2",
			});
			const nextList = nextSteps.createEl("ul", { cls: "ft-flex ft-flex-col ft-gap-1" });
			nextList.createEl("li", {
				text: "Open the Event Catalog to explore available events and configure subscriptions",
				cls: "ft-text-muted",
			});
			nextList.createEl("li", {
				text: "Create subscriptions to watch for file changes in specific folders",
				cls: "ft-text-muted",
			});
			nextList.createEl("li", {
				text: "Define event definitions to turn file events into named domain events",
				cls: "ft-text-muted",
			});
			nextList.createEl("li", {
				text: "Drop files into the Connectivity/input folder to see the ingestion pipeline in action",
				cls: "ft-text-muted",
			});
		} else {
			container.createEl("h2", {
				text: "Setup Failed",
				cls: "ft-heading ft-heading-lg",
			});

			const alert = container.createDiv({ cls: "ft-alert ft-alert-error ft-p-3" });
			alert.createEl("p", { text: this.installError });
		}

		// Navigation
		const nav = container.createDiv({ cls: "ft-flex ft-justify-end ft-gap-2 ft-mt-2" });

		if (!this.installSuccess) {
			nav.createEl("button", {
				text: "Retry",
				cls: "ft-btn ft-btn-secondary",
			}).addEventListener("click", () => {
				this.currentPage = "progress";
				this.renderPage();
				void this.runInstallation();
			});
		}

		nav.createEl("button", {
			text: "Close",
			cls: "ft-btn ft-btn-primary",
		}).addEventListener("click", () => {
			this.close();
		});
	}

	// ─────────────────────────────────────────────────────────
	// Cleanup
	// ─────────────────────────────────────────────────────────

	private cleanupListeners(): void {
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
