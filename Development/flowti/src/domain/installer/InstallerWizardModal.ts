import { App, Modal, Setting, setIcon } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import { DEFAULT_FOLDER_CONFIG, getTopLevelEntries } from "./folderConfig";
import type { IInstallerService, InstallerStepStatusEntry } from "./types";

type WizardPage = "welcome" | "review" | "progress" | "complete";

const WIZARD_STEPS: { page: WizardPage; label: string }[] = [
	{ page: "welcome", label: "Welcome" },
	{ page: "review", label: "Review" },
	{ page: "progress", label: "Install" },
	{ page: "complete", label: "Done" },
];

/** Role option shown on the welcome page role selector. */
interface RoleOption {
	id: string;
	label: string;
	icon: string;
	description: string;
	disabled?: boolean;
	badge?: string;
}

const ROLE_OPTIONS: RoleOption[] = [
	{
		id: "user",
		icon: "user",
		label: "User",
		description: "Standard IBDE setup with sample data and templates",
	},
	{
		id: "supplier-manager",
		icon: "package",
		label: "Supplier Manager",
		description: "Procurement, supplier KPIs, spend and delivery metrics",
	},
	{
		id: "project-manager",
		icon: "clipboard-list",
		label: "Project Manager",
		description: "Project tracking, governance, milestones",
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
	private includeSampleContent = true;
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
	// Step indicator
	// ─────────────────────────────────────────────────────────

	private renderStepIndicator(container: HTMLElement): void {
		const currentIndex = WIZARD_STEPS.findIndex((s) => s.page === this.currentPage);

		const bar = container.createDiv({ cls: "ft-wizard-steps" });
		bar.style.cssText = "display:flex;align-items:center;gap:0;margin-bottom:1rem;padding-bottom:0.75rem;border-bottom:1px solid var(--background-modifier-border)";

		for (let i = 0; i < WIZARD_STEPS.length; i++) {
			const step = WIZARD_STEPS[i];
			const isCompleted = i < currentIndex;
			const isActive = i === currentIndex;

			// Connector line (before every step except the first)
			if (i > 0) {
				const line = bar.createSpan({ cls: "ft-wizard-line" });
				line.style.cssText = `flex:1;height:2px;background:${isCompleted || isActive ? "var(--interactive-accent)" : "var(--background-modifier-border)"}`;
			}

			// Step circle + label wrapper
			const stepEl = bar.createDiv({ cls: "ft-wizard-step" });
			stepEl.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:0.25rem";

			const circle = stepEl.createDiv({ cls: "ft-wizard-circle" });
			circle.style.cssText = `width:1.5rem;height:1.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:600;flex-shrink:0`;

			if (isCompleted) {
				circle.style.background = "var(--interactive-accent)";
				circle.style.color = "var(--text-on-accent)";
				circle.textContent = "\u2713";
			} else if (isActive) {
				circle.style.background = "var(--interactive-accent)";
				circle.style.color = "var(--text-on-accent)";
				circle.textContent = String(i + 1);
			} else {
				circle.style.border = "2px solid var(--background-modifier-border)";
				circle.style.color = "var(--text-muted)";
				circle.textContent = String(i + 1);
			}

			const label = stepEl.createSpan({ text: step.label, cls: "ft-text-xs" });
			label.style.color = isActive ? "var(--text-normal)" : "var(--text-muted)";
			if (isActive) label.style.fontWeight = "600";
		}
	}

	// ─────────────────────────────────────────────────────────
	// Review page helpers
	// ─────────────────────────────────────────────────────────

	/** Render a compact, uniform card header: 14px icon + small bold label. */
	private renderCardHeader(parent: HTMLElement, iconName: string, label: string): void {
		const header = parent.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-mb-1 ft-card-header" });
		const iconEl = header.createSpan({ cls: "ft-icon-muted" });
		iconEl.style.cssText = "display:flex;flex-shrink:0;line-height:1";
		setIcon(iconEl, iconName);
		const svg = iconEl.querySelector("svg");
		if (svg) { svg.style.width = "14px"; svg.style.height = "14px"; }
		const labelEl = header.createSpan({ text: label });
		labelEl.style.cssText = "font-weight:600;font-size:var(--font-ui-small)";
	}

	private renderFolderSection(card: HTMLElement): void {
		const allFolders = DEFAULT_FOLDER_CONFIG.folders;
		const topLevel = getTopLevelEntries(DEFAULT_FOLDER_CONFIG);

		this.renderCardHeader(card, "folder", `Folder Structure (${allFolders.length} folders)`);

		const folderList = card.createDiv({ cls: "ft-list ft-folder-list" });
		folderList.style.cssText = "font-size:var(--font-ui-smaller);cursor:default";

		for (const parent of topLevel) {
			const children = allFolders.filter(
				(f) => f.path !== parent.path && f.path.startsWith(parent.path + "/"),
			);

			const row = folderList.createDiv({ cls: "ft-folder-row" });

			if (children.length > 0) {
				// Expandable parent
				const toggle = row.createDiv({ cls: "ft-list-item ft-flex ft-gap-2 ft-items-center" });
				toggle.style.cssText = "cursor:pointer;padding:0.15rem 0";

				const arrow = toggle.createSpan({ text: "\u25B8", cls: "ft-folder-arrow" });
				arrow.style.cssText = "width:0.8em;text-align:center;font-size:0.65rem";
				toggle.createSpan({ text: parent.path });

				const badge = toggle.createSpan({ text: String(children.length), cls: "ft-badge ft-badge-muted ft-text-xs" });
				badge.style.cssText = "margin-left:auto;padding:0 0.3rem;border-radius:4px;background:var(--background-modifier-border);font-size:0.65rem";

				const childList = row.createDiv({ cls: "ft-folder-children" });
				childList.style.cssText = "display:none;padding-left:1.25rem";

				for (const child of children) {
					const childName = child.path.slice(parent.path.length + 1);
					const childItem = childList.createDiv({ cls: "ft-list-item" });
					childItem.style.cssText = "padding:0.1rem 0;color:var(--text-muted)";
					childItem.textContent = childName;
				}

				toggle.addEventListener("click", () => {
					const isOpen = childList.style.display !== "none";
					childList.style.display = isOpen ? "none" : "block";
					arrow.textContent = isOpen ? "\u25B8" : "\u25BE";
				});
			} else {
				// Leaf folder (no children)
				const item = row.createDiv({ cls: "ft-list-item" });
				item.style.cssText = "padding:0.15rem 0";
				item.textContent = parent.path;
			}
		}
	}

	// ─────────────────────────────────────────────────────────
	// Page 1: Welcome
	// ─────────────────────────────────────────────────────────

	private renderWelcomePage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });
		this.renderStepIndicator(container);

		// Hero icon
		const heroIcon = container.createDiv({ cls: "ft-wizard-hero-icon" });
		heroIcon.style.cssText = "text-align:center;margin-bottom:0.25rem";
		const iconEl = heroIcon.createSpan();
		setIcon(iconEl, "sparkles");
		const svg = iconEl.querySelector("svg");
		if (svg) { svg.style.width = "2.5rem"; svg.style.height = "2.5rem"; svg.style.opacity = "0.5"; }

		container.createEl("h2", {
			text: "Welcome to Flowti IBDE",
			cls: "ft-heading ft-heading-lg",
		});

		container.createEl("p", {
			text: "Let's set up your environment. Enter your name and choose your primary role \u2014 you can add more roles later.",
			cls: "ft-text-muted",
		});

		const goToReview = () => {
			if (this.userName.trim()) {
				this.currentPage = "review";
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
					if (e.key === "Enter") goToReview();
				});
			});

		// ── Role selector ────────────────────────────────
		container.createEl("p", {
			text: "Choose your primary role",
			cls: "ft-font-medium",
		});

		const cardContainer = container.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2 ft-role-cards" });

		for (const option of ROLE_OPTIONS) {
			const isSelected = this.selectedRole === option.id;
			const card = cardContainer.createDiv({
				cls: `ft-card ft-p-2 ${isSelected ? "ft-card-selected" : ""}`,
			});

			if (!option.disabled) {
				card.style.cssText = `cursor:pointer;border:${isSelected ? "2px solid var(--interactive-accent)" : "1px solid var(--background-modifier-border)"}`;
				card.addEventListener("click", () => {
					this.selectedRole = option.id;
					this.renderPage();
				});
			} else {
				card.style.cssText = "opacity:0.5;cursor:not-allowed;border:1px solid var(--background-modifier-border)";
			}

			const row = card.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });

			// Role icon
			const roleIconEl = row.createSpan({ cls: "ft-role-icon" });
			roleIconEl.style.cssText = "display:flex;flex-shrink:0";
			setIcon(roleIconEl, option.icon);
			const roleSvg = roleIconEl.querySelector("svg");
			if (roleSvg) {
				roleSvg.style.width = "18px";
				roleSvg.style.height = "18px";
				if (isSelected) roleSvg.style.color = "var(--interactive-accent)";
			}

			const textCol = row.createDiv({ cls: "ft-flex ft-flex-col" });
			const titleRow = textCol.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });
			titleRow.createSpan({ text: option.label, cls: "ft-font-medium" });

			if (option.badge) {
				const badge = titleRow.createSpan({ text: option.badge, cls: "ft-text-xs ft-text-muted" });
				badge.style.cssText = "padding:0 0.3rem;border-radius:4px;background:var(--background-modifier-border)";
			}

			textCol.createSpan({ text: option.description, cls: "ft-text-muted ft-text-xs" });
		}

		// Navigation: cancel left, progress right
		const nav = container.createDiv({ cls: "ft-flex ft-justify-between ft-mt-2" });

		nav.createEl("button", {
			text: "Cancel",
			cls: "ft-btn ft-btn-secondary",
		}).addEventListener("click", () => this.close());

		nav.createEl("button", {
			text: "Next",
			cls: "ft-btn ft-btn-primary",
		}).addEventListener("click", goToReview);

		this.addKeyboardNav(goToReview, () => this.close());
	}

	// ─────────────────────────────────────────────────────────
	// Page 3: Review
	// ─────────────────────────────────────────────────────────

	private renderReviewPage(el: HTMLElement): void {
		const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });
		this.renderStepIndicator(container);

		container.createEl("h2", {
			text: "Ready to set up your vault?",
			cls: "ft-heading ft-heading-lg",
		});

		const roleLabel = ROLE_OPTIONS.find((r) => r.id === this.selectedRole)?.label ?? "User";
		const identityRow = container.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-review-identity" });
		const userIcon = identityRow.createSpan({ cls: "ft-icon-muted" });
		setIcon(userIcon, "user");
		const userSvg = userIcon.querySelector("svg");
		if (userSvg) { userSvg.style.width = "14px"; userSvg.style.height = "14px"; }
		identityRow.createSpan({ text: this.userName.trim(), cls: "ft-font-medium" });
		const roleBadge = identityRow.createSpan({ text: roleLabel, cls: "ft-text-xs ft-role-badge" });
		roleBadge.style.cssText = "padding:0.1rem 0.5rem;border-radius:4px;background:var(--background-modifier-border);color:var(--text-muted)";

		// ── Preferences ──────────────────────────────────
		new Setting(container)
			.setName("Include sample data")
			.setDesc("Supplier CSV, welcome note, and pre-built dashboard")
			.addToggle((toggle) => {
				toggle.setValue(this.includeSampleContent).onChange((value) => {
					this.includeSampleContent = value;
					this.renderPage();
				});
			});

		// ── Section 1: Folder Structure ───────────────────
		const folderCard = container.createDiv({ cls: "ft-card ft-p-2" });
		this.renderFolderSection(folderCard);

		// ── Section 2: Sample Content ─────────────────────
		const contentCard = container.createDiv({ cls: "ft-card ft-p-2" });
		contentCard.style.textAlign = "left";
		this.renderCardHeader(contentCard, "file-text", "Sample Content");

		if (this.includeSampleContent) {
			const contentList = contentCard.createDiv({ cls: "ft-list" });
			contentList.style.cssText = "font-size:var(--font-ui-smaller);cursor:default";

			// CSV file
			const csvItem = contentList.createDiv({ cls: "ft-list-item" });
			csvItem.style.cssText = "padding:0.15rem 0";
			csvItem.createSpan({ text: "Supplier overview CSV" });
			csvItem.createSpan({ text: " \u2014 48 rows, 10 columns", cls: "ft-text-faint" });

			// Welcome note
			const noteItem = contentList.createDiv({ cls: "ft-list-item" });
			noteItem.style.cssText = "padding:0.15rem 0";
			noteItem.textContent = "Welcome note";

			// Session templates (supplier-manager only)
			if (this.selectedRole === "supplier-manager") {
				for (const label of ["Supplier Review", "Monthly KPI Review", "Procurement Planning"]) {
					const tmplItem = contentList.createDiv({ cls: "ft-list-item" });
					tmplItem.style.cssText = "padding:0.15rem 0";
					tmplItem.textContent = label;
				}
			}
		} else {
			contentCard.createDiv({
				text: "Sample data will not be installed",
				cls: "ft-text-muted ft-text-sm ft-sample-skipped",
			});
		}

		// ── Section 3: Pre-Built Dashboard ────────────────
		if (this.includeSampleContent) {
			const dashCard = container.createDiv({ cls: "ft-card ft-p-2" });
			dashCard.style.textAlign = "left";
			this.renderCardHeader(dashCard, "bar-chart-big", "Pre-Built Dashboard");

			const dashBody = dashCard.createDiv({ cls: "ft-list" });
			dashBody.style.cssText = "font-size:var(--font-ui-smaller);cursor:default";

			// Tiles
			const tiles = [
				{ type: "stat-card", name: "Total Spend" },
				{ type: "stat-card", name: "Avg Quality Score" },
				{ type: "stat-card", name: "Avg On-Time Delivery" },
				{ type: "bar-chart", name: "Monthly Spend Trend" },
				{ type: "table", name: "Supplier Breakdown" },
			];
			for (const tile of tiles) {
				const row = dashBody.createDiv({ cls: "ft-list-item ft-flex ft-gap-2 ft-items-center" });
				row.style.cssText = "padding:0.15rem 0";
				row.createSpan({ text: tile.name });
				const typeBadge = row.createSpan({ text: tile.type, cls: "ft-text-faint" });
				typeBadge.style.cssText = "margin-left:auto;padding:0 0.3rem;border-radius:4px;background:var(--background-modifier-border);font-size:0.65rem";
			}

			// Queries
			const querySep = dashBody.createDiv();
			querySep.style.cssText = "margin-top:0.25rem;padding-top:0.25rem;border-top:1px solid var(--background-modifier-border)";
			querySep.createSpan({ text: "2 queries", cls: "ft-text-faint" });
			const queryList = dashBody.createDiv();
			for (const qName of ["Supplier Overview - By Supplier", "Supplier Trend - Monthly Spend"]) {
				const qItem = queryList.createDiv({ cls: "ft-list-item" });
				qItem.style.cssText = "padding:0.1rem 0;color:var(--text-muted)";
				qItem.textContent = qName;
			}
		}

		// Navigation
		const goBack = () => { this.currentPage = "welcome"; this.renderPage(); };
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
		this.renderStepIndicator(container);

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
			includeSampleContent: this.includeSampleContent,
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
		this.renderStepIndicator(container);

		if (this.installSuccess) {
			const heading = container.createEl("h2", {
				text: "Setup complete",
				cls: "ft-heading ft-heading-lg",
			});
			heading.style.textAlign = "center";

			// Hero icon
			const heroDiv = container.createDiv({ cls: "ft-complete-hero" });
			heroDiv.style.cssText = "text-align:center;margin-bottom:0.25rem";
			const heroIconEl = heroDiv.createSpan();
			setIcon(heroIconEl, "circle-check-big");
			const heroSvg = heroIconEl.querySelector("svg");
			if (heroSvg) { heroSvg.style.width = "2.5rem"; heroSvg.style.height = "2.5rem"; heroSvg.style.color = "var(--interactive-accent)"; }

			const alert = container.createDiv({ cls: "ft-alert ft-alert-success ft-p-3" });
			alert.createEl("p", {
				text: `Welcome, ${this.userName.trim()}! Your Flowti IBDE environment is ready.`,
			});

			const summary = container.createDiv({ cls: "ft-card ft-p-3" });
			summary.createEl("h3", {
				text: "What was set up",
				cls: "ft-heading ft-heading-sm ft-mb-2",
			});
			const list = summary.createDiv({ cls: "ft-flex ft-flex-col ft-gap-1" });
			for (const entry of this.stepStatuses) {
				const row = list.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });
				const statusIcon = row.createSpan({ cls: "ft-step-status-icon" });
				setIcon(statusIcon, entry.status === "skipped" ? "minus" : "check");
				const statusSvg = statusIcon.querySelector("svg");
				if (statusSvg) { statusSvg.style.width = "14px"; statusSvg.style.height = "14px"; }
				const label = entry.status === "skipped" ? `${entry.name} (skipped)` : entry.name;
				row.createSpan({ text: label, cls: "ft-text-muted" });
			}

			// Next steps guidance — adapts to selected role
			this.renderNextStepsGuidance(container);
		} else {
			const heading = container.createEl("h2", {
				text: "Setup failed",
				cls: "ft-heading ft-heading-lg",
			});
			heading.style.textAlign = "center";

			// Error hero icon
			const heroDiv = container.createDiv({ cls: "ft-complete-hero" });
			heroDiv.style.cssText = "text-align:center;margin-bottom:0.25rem";
			const heroIconEl = heroDiv.createSpan();
			setIcon(heroIconEl, "alert-triangle");
			const heroSvg = heroIconEl.querySelector("svg");
			if (heroSvg) { heroSvg.style.width = "2.5rem"; heroSvg.style.height = "2.5rem"; heroSvg.style.color = "var(--text-error)"; }

			const alert = container.createDiv({ cls: "ft-alert ft-alert-error ft-p-3" });
			alert.style.borderLeft = "4px solid var(--text-error)";
			alert.createEl("p", { text: this.installError });
		}

		// Navigation: cancel/close left, primary action right
		const nav = container.createDiv({ cls: "ft-flex ft-justify-between ft-mt-2" });

		const navLeft = nav.createDiv({ cls: "ft-flex ft-gap-2" });
		const navRight = nav.createDiv({ cls: "ft-flex ft-gap-2" });

		navLeft.createEl("button", {
			text: "Close",
			cls: "ft-btn ft-btn-secondary",
		}).addEventListener("click", () => {
			this.close();
		});

		if (!this.installSuccess) {
			navRight.createEl("button", {
				text: "Retry",
				cls: "ft-btn ft-btn-primary",
			}).addEventListener("click", () => {
				this.currentPage = "progress";
				this.renderPage();
				void this.runInstallation();
			});
		}

		if (this.installSuccess && this.includeSampleContent) {
			const explore = () => {
				this.close();
				setTimeout(() => {
					void this.eventBus.emit("ui.openAnalyticsHub", {});
				}, 100);
			};
			navRight.createEl("button", {
				text: "Explore your dashboard",
				cls: "ft-btn ft-btn-primary",
			}).addEventListener("click", explore);

			this.addKeyboardNav(explore, () => this.close());
		} else if (this.installSuccess) {
			this.addKeyboardNav(undefined, () => this.close());
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
		const nextList = nextSteps.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2 ft-next-steps-list" });

		const tips: Array<{ icon: string; text: string }> = [];
		if (this.includeSampleContent) {
			if (this.selectedRole === "supplier-manager") {
				tips.push(
					{ icon: "bar-chart-big", text: "Explore your Supplier Overview dashboard with live charts and KPI cards" },
					{ icon: "file-spreadsheet", text: "Review the sample supplier data in 03 - Resources/Sample Data/" },
				);
			} else {
				tips.push(
					{ icon: "bar-chart-big", text: "Open the Analytics Hub to explore your pre-built dashboard" },
					{ icon: "file-spreadsheet", text: "Review the sample data in 03 - Resources/Sample Data/" },
				);
			}
		}
		tips.push(
			{ icon: "file-input", text: "Import your own CSV files by dropping them into 00 - Connectivity/imports/" },
			{ icon: "search", text: "Build custom queries and dashboards in the Analytics Hub" },
		);

		for (const tip of tips) {
			const row = nextList.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });
			const tipIcon = row.createSpan({ cls: "ft-tip-icon" });
			setIcon(tipIcon, tip.icon);
			const tipSvg = tipIcon.querySelector("svg");
			if (tipSvg) { tipSvg.style.width = "14px"; tipSvg.style.height = "14px"; tipSvg.style.flexShrink = "0"; }
			row.createSpan({ text: tip.text, cls: "ft-text-muted ft-text-sm" });
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
