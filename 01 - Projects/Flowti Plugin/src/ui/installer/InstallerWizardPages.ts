/**
 * Wizard page renderers — extracted from InstallerWizardModal for max-lines compliance.
 */

import { Setting, setIcon } from "obsidian";
import { DEFAULT_FOLDER_CONFIG, getTopLevelEntries } from "../../domain/installer/folderConfig";

/** Role option shown on the welcome page role selector. */
interface RoleOption {
	id: string;
	label: string;
	icon: string;
	description: string;
	disabled?: boolean;
	badge?: string;
}

export const ROLE_OPTIONS: RoleOption[] = [
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

export function renderWelcomePage(
	el: HTMLElement,
	renderStepIndicator: (el: HTMLElement) => void,
	userName: string,
	selectedRole: string,
	setUserName: (v: string) => void,
	setSelectedRole: (v: string) => void,
	onNext: () => void,
	onCancel: () => void,
	renderPage: () => void,
	addKeyboardNav: (onEnter?: () => void, onEscape?: () => void) => void,
): void {
	const container = el.createDiv({ cls: "ft-flex ft-flex-col ft-gap-4 ft-p-2" });
	renderStepIndicator(container);

	// Hero icon
	const heroIcon = container.createDiv({ cls: "ft-wizard-hero-icon ft-hero-center" });
	const iconEl = heroIcon.createSpan({ cls: "ft-hero-icon-lg" });
	setIcon(iconEl, "sparkles");

	container.createEl("h2", {
		text: "Welcome to Flowti IBDE",
		cls: "ft-heading ft-heading-lg",
	});

	container.createEl("p", {
		text: "Let's set up your environment. Enter your name and choose your primary role \u2014 you can add more roles later.",
		cls: "ft-text-muted",
	});

	const goToReview = (): void => {
		if (userName.trim()) onNext();
	};

	new Setting(container)
		.setName("Your name")
		.setDesc("Enter your display name to get started")
		.addText((text) => {
			text
				.setPlaceholder("Enter your name")
				.setValue(userName)
				.onChange((value) => { setUserName(value); });
			text.inputEl.dataset.testId = "installer-name-input";
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
		const isSelected = selectedRole === option.id;
		const card = cardContainer.createDiv({
			cls: `ft-card ft-p-2 ${isSelected ? "ft-card-selected" : ""}`,
		});
		card.dataset.testId = "installer-role-card";
		card.dataset.testSelected = isSelected ? "true" : "false";

		if (!option.disabled) {
			card.addClass("ft-role-card-enabled");
			card.addClass(isSelected ? "ft-role-card-selected-border" : "ft-role-card-unselected-border");
			card.addEventListener("click", () => {
				setSelectedRole(option.id);
				renderPage();
			});
		} else {
			card.addClass("ft-role-card-disabled");
		}

		const row = card.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });

		const roleIconEl = row.createSpan({ cls: `ft-role-icon ft-role-icon-inline ft-role-icon-18${isSelected ? " ft-role-icon-accent" : ""}` });
		setIcon(roleIconEl, option.icon);

		const textCol = row.createDiv({ cls: "ft-flex ft-flex-col" });
		const titleRow = textCol.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });
		titleRow.createSpan({ text: option.label, cls: "ft-font-medium" });

		if (option.badge) {
			titleRow.createSpan({ text: option.badge, cls: "ft-text-xs ft-text-muted ft-role-badge-pill" });
		}

		textCol.createSpan({ text: option.description, cls: "ft-text-muted ft-text-xs" });
	}

	// Navigation
	const nav = container.createDiv({ cls: "ft-flex ft-justify-between ft-mt-2" });

	const cancelBtn = nav.createEl("button", {
		text: "Cancel",
		cls: "ft-btn ft-btn-secondary",
	});
	cancelBtn.dataset.testId = "installer-cancel-btn";
	cancelBtn.addEventListener("click", onCancel);

	const nextBtn = nav.createEl("button", {
		text: "Next",
		cls: "ft-btn ft-btn-primary",
	});
	nextBtn.dataset.testId = "installer-next-btn";
	nextBtn.addEventListener("click", goToReview);

	addKeyboardNav(goToReview, onCancel);
}

export function renderFolderSection(card: HTMLElement): void {
	const allFolders = DEFAULT_FOLDER_CONFIG.folders;
	const topLevel = getTopLevelEntries(DEFAULT_FOLDER_CONFIG);

	const header = card.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-mb-1 ft-card-header" });
	const iconEl = header.createSpan({ cls: "ft-icon-muted ft-icon-inline ft-icon-14" });
	setIcon(iconEl, "folder");
	header.createSpan({ text: `Folder Structure (${allFolders.length} folders)`, cls: "ft-label-semibold" });

	const folderList = card.createDiv({ cls: "ft-list ft-folder-list ft-folder-list-font" });
	folderList.dataset.testId = "installer-folder-list";

	for (const parent of topLevel) {
		const children = allFolders.filter(
			(f) => f.path !== parent.path && f.path.startsWith(parent.path + "/"),
		);

		const row = folderList.createDiv({ cls: "ft-folder-row" });

		if (children.length > 0) {
			const toggle = row.createDiv({ cls: "ft-list-item ft-flex ft-gap-2 ft-items-center ft-folder-toggle" });
			const arrow = toggle.createSpan({ text: "\u25B8", cls: "ft-folder-arrow ft-folder-arrow-el" });
			toggle.createSpan({ text: parent.path });
			toggle.createSpan({ text: String(children.length), cls: "ft-badge ft-badge-muted ft-text-xs ft-folder-count-badge" });

			const childList = row.createDiv({ cls: "ft-folder-children ft-folder-children-hidden" });

			for (const child of children) {
				const childName = child.path.slice(parent.path.length + 1);
				const childItem = childList.createDiv({ cls: "ft-list-item ft-folder-child-item" });
				childItem.textContent = childName;
			}

			toggle.addEventListener("click", () => {
				const isOpen = !childList.classList.contains("ft-folder-children-hidden");
				childList.classList.toggle("ft-folder-children-hidden", isOpen);
				arrow.textContent = isOpen ? "\u25B8" : "\u25BE";
			});
		} else {
			const item = row.createDiv({ cls: "ft-list-item ft-folder-leaf-item" });
			item.textContent = parent.path;
		}
	}
}

export function renderNextStepsGuidance(
	container: HTMLElement,
	includeSampleContent: boolean,
	selectedRole: string,
): void {
	const nextSteps = container.createDiv({ cls: "ft-card ft-p-3" });
	nextSteps.createEl("h3", {
		text: "What to do next",
		cls: "ft-heading ft-heading-sm ft-mb-2",
	});
	const nextList = nextSteps.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2 ft-next-steps-list" });

	const tips: Array<{ icon: string; text: string }> = [];
	if (includeSampleContent) {
		if (selectedRole === "supplier-manager") {
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
		const tipIcon = row.createSpan({ cls: "ft-tip-icon ft-tip-icon-14" });
		setIcon(tipIcon, tip.icon);
		row.createSpan({ text: tip.text, cls: "ft-text-muted ft-text-sm" });
	}
}
