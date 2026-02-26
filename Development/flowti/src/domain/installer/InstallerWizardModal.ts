import { App, Modal, Setting } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import { DEFAULT_FOLDER_CONFIG, getTopLevelEntries } from "./folderConfig";
import type { IInstallerService, InstallerStepStatusEntry } from "./types";

type WizardPage = "welcome" | "role" | "review" | "progress" | "complete";

/** Role option shown on the role selection page. */
interface RoleOption {
	id: string;
	label: string;
	description: string;
	disabled?: boolean;
	badge?: string;
}

const ROLE_OPTIONS: RoleOption[] = [
	{
		id: "user",
		label: "User",
		description: "Standard IBDE setup with sample data and general-purpose templates",
	},
	{
		id: "supplier-manager",
		label: "Supplier Manager",
		description: "Procurement, supplier KPIs, spend tracking, quality and delivery metrics",
	},
	{
		id: "project-manager",
		label: "Project Manager",
		description: "Project tracking, governance, milestones, team coordination",
		disabled: true,
		badge: "Coming Soon",
	},
];

/**
 * Multi-step wizard modal for the Flowti IBDE first-run installation.
 *
 * Flow:
 * 1. Welcome  — collect user name
 * 2. Role     — select user role (PBI-ONB-005, Cycle 46)
 * 3. Review   — preview what will be installed
 * 4. Progress — live step execution with status indicators
 * 5. Complete — summary or error with retry
 */
export class InstallerWizardModal extends Modal {
	private currentPage: WizardPage = "welcome";
	private userName = "";
	private selectedRole = "user";
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
		this.removeKeyboardNav();
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("flowti-installer-modal");

		switch (this.currentPage) {
			case "welcome":
				this.renderWelcomePage(contentEl);
				break;
			case "role":
				this.renderRolePage(contentEl);
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

		const goToRole = () => {
			if (this.userName.trim()) {
				this.currentPage = "role";
				this.renderPage();
			}
		};

		new Setting(container)
			.setName("Your name")
			.setDesc("Enter your display name to get started")
			.addText((text) => {
				text
					.setPlaceholder("Enter your name")
					.setValue(this.userName)
					.onChange((value) => {
						this.userName = value;
					});
				text.inputEl.addEventListener("keydown", (e) => {
					if (e.key === "Enter") goToRole();
				});
			});

		const nav = container.createDiv({ cls: "ft-flex ft-justify-end ft-gap-2 ft-mt-2" });

		nav.createEl("button", {
			text: "Next",
			cls: "ft-btn ft-btn-primary",
		}).addEventListener("click", goToRole);

		this.addKeyboardNav(undefined, () => this.close());
	}

	// ─────────────────────────────────────────────────────────
	// Page 2: Role Selection
	// ─────────────────────────────────────────────────────────

	private renderRolePage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });

		container.createEl("h2", {
			text: "What best describes your role?",
			cls: "ft-heading ft-heading-lg",
		});

		container.createEl("p", {
			text: "This helps us tailor your setup with relevant sample data and templates.",
			cls: "ft-text-muted",
		});

		const cardContainer = container.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2" });

		for (const option of ROLE_OPTIONS) {
			const isSelected = this.selectedRole === option.id;
			const card = cardContainer.createDiv({
				cls: `ft-card ft-p-3 ${isSelected ? "ft-card-selected" : ""}`,
			});

			if (!option.disabled) {
				card.style.cursor = "pointer";
				card.style.border = isSelected
					? "2px solid var(--interactive-accent)"
					: "1px solid var(--background-modifier-border)";
				card.addEventListener("click", () => {
					this.selectedRole = option.id;
					this.renderPage();
				});
			} else {
				card.style.opacity = "0.5";
				card.style.cursor = "not-allowed";
				card.style.border = "1px solid var(--background-modifier-border)";
			}

			const header = card.createDiv({ cls: "ft-flex ft-justify-between ft-items-center" });
			const titleRow = header.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });

			const radio = titleRow.createEl("span");
			radio.textContent = isSelected ? "\u25C9" : "\u25CB";
			radio.style.fontSize = "1.2em";

			titleRow.createEl("span", {
				text: option.label,
				cls: "ft-font-medium",
			});

			if (option.badge) {
				const badge = header.createEl("span", {
					text: option.badge,
					cls: "ft-text-xs ft-text-muted",
				});
				badge.style.padding = "0.1rem 0.4rem";
				badge.style.borderRadius = "4px";
				badge.style.background = "var(--background-modifier-border)";
			}

			card.createEl("p", {
				text: option.description,
				cls: "ft-text-muted ft-text-sm",
			});
		}

		// Navigation
		const goBack = () => { this.currentPage = "welcome"; this.renderPage(); };
		const goNext = () => { this.currentPage = "review"; this.renderPage(); };

		const nav = container.createDiv({ cls: "ft-flex ft-justify-between ft-mt-2" });

		nav.createEl("button", {
			text: "Back",
			cls: "ft-btn ft-btn-secondary",
		}).addEventListener("click", goBack);

		nav.createEl("button", {
			text: "Next",
			cls: "ft-btn ft-btn-primary",
		}).addEventListener("click", goNext);

		this.addKeyboardNav(goNext, goBack);
	}

	// ─────────────────────────────────────────────────────────
	// Page 3: Review
	// ─────────────────────────────────────────────────────────

	private renderReviewPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });

		container.createEl("h2", {
			text: "Ready to set up your vault?",
			cls: "ft-heading ft-heading-lg",
		});

		const roleLabel = ROLE_OPTIONS.find((r) => r.id === this.selectedRole)?.label ?? "User";
		container.createEl("p", {
			text: `Installing as: ${this.userName.trim()} (${roleLabel})`,
			cls: "ft-text-muted",
		});

		// ── Section 1: Folder Structure ───────────────────
		const folderCard = container.createDiv({ cls: "ft-card ft-p-3" });
		const folderHeader = folderCard.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-mb-2" });
		folderHeader.createSpan({ text: "\uD83D\uDCC1" });
		folderHeader.createEl("h3", {
			text: "Folder Structure",
			cls: "ft-heading ft-heading-sm",
		});
		const folderList = folderCard.createDiv({ cls: "ft-list ft-folder-list" });
		for (const entry of getTopLevelEntries(DEFAULT_FOLDER_CONFIG)) {
			const item = folderList.createDiv({ cls: "ft-list-item ft-flex ft-gap-2" });
			item.createSpan({ text: entry.path });
			item.createSpan({ text: `(${entry.description})`, cls: "ft-text-faint ft-text-sm" });
		}

		// ── Section 2: Sample Content ─────────────────────
		const contentCard = container.createDiv({ cls: "ft-card ft-p-3" });
		const contentHeader = contentCard.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-mb-2" });
		contentHeader.createSpan({ text: "\uD83D\uDCC4" });
		contentHeader.createEl("h3", {
			text: "Sample Content",
			cls: "ft-heading ft-heading-sm",
		});
		const contentList = contentCard.createDiv({ cls: "ft-list" });
		contentList.createDiv({ cls: "ft-list-item", text: "Supplier overview CSV (48 rows)" });
		contentList.createDiv({ cls: "ft-list-item", text: "Welcome note" });
		if (this.selectedRole === "supplier-manager") {
			contentList.createDiv({ cls: "ft-list-item", text: "3 session templates (Supplier Review, KPI Review, Procurement Planning)" });
		}

		// ── Section 3: Pre-Built Dashboard ────────────────
		const dashCard = container.createDiv({ cls: "ft-card ft-p-3" });
		const dashHeader = dashCard.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-mb-2" });
		dashHeader.createSpan({ text: "\uD83D\uDCCA" });
		dashHeader.createEl("h3", {
			text: "Pre-Built Dashboard",
			cls: "ft-heading ft-heading-sm",
		});
		const dashList = dashCard.createDiv({ cls: "ft-list" });
		dashList.createDiv({ cls: "ft-list-item", text: "Supplier Overview (5 tiles, 2 queries)" });

		// Navigation
		const goBack = () => { this.currentPage = "role"; this.renderPage(); };
		const goInstall = () => {
			this.currentPage = "progress";
			this.renderPage();
			void this.runInstallation();
		};

		const nav = container.createDiv({ cls: "ft-flex ft-justify-between ft-mt-2" });

		nav.createEl("button", {
			text: "Back",
			cls: "ft-btn ft-btn-secondary",
		}).addEventListener("click", goBack);

		nav.createEl("button", {
			text: "Install",
			cls: "ft-btn ft-btn-primary",
		}).addEventListener("click", goInstall);

		this.addKeyboardNav(goInstall, goBack);
	}

	// ─────────────────────────────────────────────────────────
	// Page 4: Progress
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
			role: this.selectedRole,
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
	// Page 5: Complete
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

			// Next steps guidance — adapts to selected role
			this.renderNextStepsGuidance(container);
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
			cls: `ft-btn ${this.installSuccess ? "ft-btn-secondary" : "ft-btn-primary"}`,
		}).addEventListener("click", () => {
			this.close();
		});

		if (this.installSuccess) {
			const explore = () => {
				this.close();
				setTimeout(() => {
					void this.eventBus.emit("ui.openAnalyticsHub", {});
				}, 100);
			};
			nav.createEl("button", {
				text: "Explore Your Dashboard",
				cls: "ft-btn ft-btn-primary",
			}).addEventListener("click", explore);

			this.addKeyboardNav(explore, () => this.close());
		} else {
			this.addKeyboardNav(undefined, () => this.close());
		}
	}

	private renderNextStepsGuidance(container: HTMLElement): void {
		const nextSteps = container.createDiv({ cls: "ft-card ft-p-3" });
		nextSteps.createEl("h3", {
			text: "What to do next",
			cls: "ft-heading ft-heading-sm ft-mb-2",
		});
		const nextList = nextSteps.createEl("ul", { cls: "ft-flex ft-flex-col ft-gap-1" });

		const tips =
			this.selectedRole === "supplier-manager"
				? [
						"Explore your Supplier Overview dashboard with live charts and KPI cards",
						"Review the sample supplier data in 03 - Resources/Sample Data/",
						"Import your own CSV files by dropping them into 00 - Connectivity/imports/",
						"Build custom queries and dashboards in the Analytics Hub",
					]
				: [
						"Open the Analytics Hub to explore your pre-built dashboard",
						"Review the sample data in 03 - Resources/Sample Data/",
						"Import your own CSV files by dropping them into 00 - Connectivity/imports/",
						"Build custom queries and pin them to dashboards",
					];

		for (const tip of tips) {
			nextList.createEl("li", { text: tip, cls: "ft-text-muted" });
		}
	}

	// ─────────────────────────────────────────────────────────
	// Keyboard navigation
	// ─────────────────────────────────────────────────────────

	private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

	/** Register Enter (advance) and Escape (back/close) for the current page. */
	private addKeyboardNav(onEnter?: () => void, onEscape?: () => void): void {
		this.removeKeyboardNav();
		this.keydownHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter" && onEnter) {
				e.preventDefault();
				onEnter();
			} else if (e.key === "Escape" && onEscape) {
				e.preventDefault();
				onEscape();
			}
		};
		this.contentEl.addEventListener("keydown", this.keydownHandler);
	}

	private removeKeyboardNav(): void {
		if (this.keydownHandler) {
			this.contentEl.removeEventListener("keydown", this.keydownHandler);
			this.keydownHandler = null;
		}
	}

	// ─────────────────────────────────────────────────────────
	// Cleanup
	// ─────────────────────────────────────────────────────────

	private cleanupListeners(): void {
		this.removeKeyboardNav();
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
	}
}
