import { ItemView, WorkspaceLeaf } from "obsidian";

export const VIEW_TYPE_COMPONENT_SHOWCASE = "flowti-component-showcase";

/**
 * A view that showcases all available CSS components and utilities.
 * Useful for development and testing the design system.
 */
export class ComponentShowcaseView extends ItemView {
	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_COMPONENT_SHOWCASE;
	}

	getDisplayText(): string {
		return "Flowti components";
	}

	getIcon(): string {
		return "palette";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();

		// Main wrapper with our container class
		const wrapper = container.createDiv({ cls: "flowti-container ft-p-4" });

		this.renderHeader(wrapper);
		this.renderButtons(wrapper);
		this.renderInputs(wrapper);
		this.renderCards(wrapper);
		this.renderBadges(wrapper);
		this.renderAlerts(wrapper);
		this.renderLists(wrapper);
		this.renderTypography(wrapper);
		this.renderUtilities(wrapper);
	}

	async onClose(): Promise<void> {
		// Cleanup if needed
	}

	private renderHeader(container: HTMLElement): void {
		const section = container.createDiv({ cls: "ft-mb-4" });

		section.createEl("h1", {
			text: "Flowti component showcase",
			cls: "ft-heading ft-heading-lg ft-mb-2",
		});

		section.createEl("p", {
			text: "This view shows all available CSS components and utilities.",
			cls: "ft-text-muted",
		});

		section.createEl("hr", { cls: "ft-divider" });
	}

	private renderButtons(container: HTMLElement): void {
		const section = this.createSection(container, "Buttons", "Various button variants");

		const row = section.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });

		row.createEl("button", { text: "Primary", cls: "ft-btn ft-btn-primary" });
		row.createEl("button", { text: "Secondary", cls: "ft-btn ft-btn-secondary" });
		row.createEl("button", { text: "Ghost", cls: "ft-btn ft-btn-ghost" });

		// Buttons with icons (using Obsidian's built-in icons concept)
		const row2 = section.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center ft-mt-2" });

		const iconBtn = row2.createEl("button", { cls: "ft-btn ft-btn-primary" });
		iconBtn.createSpan({ text: "✓ " });
		iconBtn.createSpan({ text: "With Icon" });

		const disabledBtn = row2.createEl("button", {
			text: "Disabled",
			cls: "ft-btn ft-btn-secondary",
		});
		disabledBtn.setAttribute("disabled", "true");
		disabledBtn.addClass("ft-icon-muted");
		disabledBtn.addClass("ft-cursor-not-allowed");
	}

	private renderInputs(container: HTMLElement): void {
		const section = this.createSection(container, "Inputs", "Form elements");

		const formGroup = section.createDiv({ cls: "ft-flex ft-flex-col ft-gap-3" });

		// Text input
		const inputGroup1 = formGroup.createDiv();
		inputGroup1.createEl("label", { text: "Text input", cls: "ft-label" });
		const input1 = inputGroup1.createEl("input", { cls: "ft-input" });
		input1.type = "text";
		input1.placeholder = "Placeholder text...";

		// Input with value
		const inputGroup2 = formGroup.createDiv();
		inputGroup2.createEl("label", { text: "With value", cls: "ft-label" });
		const input2 = inputGroup2.createEl("input", { cls: "ft-input" });
		input2.type = "text";
		input2.value = "Pre-filled text";

		// Textarea simulation (using input for simplicity)
		const inputGroup3 = formGroup.createDiv();
		inputGroup3.createEl("label", { text: "Readonly input", cls: "ft-label" });
		const input3 = inputGroup3.createEl("input", { cls: "ft-input" });
		input3.type = "text";
		input3.value = "Not editable";
		input3.readOnly = true;
	}

	private renderCards(container: HTMLElement): void {
		const section = this.createSection(container, "Cards", "Content containers");

		const cardsRow = section.createDiv({ cls: "ft-flex ft-gap-4" });

		// Simple card
		const card1 = cardsRow.createDiv({ cls: "ft-card" });
		card1.addClass("ft-flex-1");
		card1.createEl("h3", { text: "Simple card", cls: "ft-heading ft-heading-sm ft-mb-2" });
		card1.createEl("p", { text: "This is a simple card with text.", cls: "ft-text-muted" });

		// Card with button
		const card2 = cardsRow.createDiv({ cls: "ft-card ft-flex ft-flex-col ft-gap-2" });
		card2.addClass("ft-flex-1");
		card2.createEl("h3", { text: "Card with action", cls: "ft-heading ft-heading-sm" });
		card2.createEl("p", {
			text: "This card contains a button.",
			cls: "ft-text-muted ft-mb-2",
		});
		card2.createEl("button", { text: "Action", cls: "ft-btn ft-btn-primary" });
	}

	private renderBadges(container: HTMLElement): void {
		const section = this.createSection(container, "Badges", "Labels and tags");

		const row = section.createDiv({ cls: "ft-flex ft-gap-2 ft-items-center" });

		row.createSpan({ text: "Accent", cls: "ft-badge ft-badge-accent" });
		row.createSpan({ text: "Muted", cls: "ft-badge ft-badge-muted" });
		row.createSpan({ text: "Status: Active", cls: "ft-badge ft-badge-accent" });
		row.createSpan({ text: "v1.0.0", cls: "ft-badge ft-badge-muted" });
	}

	private renderAlerts(container: HTMLElement): void {
		const section = this.createSection(container, "Alerts", "Notification messages");

		const alertsColumn = section.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2" });

		alertsColumn.createDiv({
			text: "Info: This is an informational message.",
			cls: "ft-alert ft-alert-info",
		});

		alertsColumn.createDiv({
			text: "Success: The action was completed successfully.",
			cls: "ft-alert ft-alert-success",
		});

		alertsColumn.createDiv({
			text: "Warning: Please check your input.",
			cls: "ft-alert ft-alert-warning",
		});

		alertsColumn.createDiv({
			text: "Error: An error occurred.",
			cls: "ft-alert ft-alert-error",
		});
	}

	private renderLists(container: HTMLElement): void {
		const section = this.createSection(container, "Lists", "List components");

		const list = section.createDiv({ cls: "ft-list" });

		const item1 = list.createDiv({ cls: "ft-list-item" });
		item1.createSpan({ text: "📄" });
		item1.createSpan({ text: "First Item" });

		const item2 = list.createDiv({ cls: "ft-list-item ft-list-item-active" });
		item2.createSpan({ text: "📄" });
		item2.createSpan({ text: "Active Item" });

		const item3 = list.createDiv({ cls: "ft-list-item" });
		item3.createSpan({ text: "📄" });
		item3.createSpan({ text: "Third Item" });

		const item4 = list.createDiv({ cls: "ft-list-item" });
		item4.createSpan({ text: "📁" });
		item4.createSpan({ text: "Folder Item" });
	}

	private renderTypography(container: HTMLElement): void {
		const section = this.createSection(container, "Typography", "Text styles");

		section.createEl("h2", { text: "Heading large", cls: "ft-heading ft-heading-lg ft-mb-1" });
		section.createEl("h3", { text: "Heading medium", cls: "ft-heading ft-heading-md ft-mb-1" });
		section.createEl("h4", { text: "Heading small", cls: "ft-heading ft-heading-sm ft-mb-2" });

		section.createEl("p", { text: "Normal text with standard styling.", cls: "ft-mb-1" });
		section.createEl("p", { text: "Muted text for secondary information.", cls: "ft-text-muted ft-mb-1" });
		section.createEl("p", { text: "Faint text for tertiary information.", cls: "ft-text-faint ft-mb-1" });

		const textRow = section.createDiv({ cls: "ft-flex ft-gap-4 ft-mt-2" });
		textRow.createSpan({ text: "Small Text", cls: "ft-text-sm" });
		textRow.createSpan({ text: "Base Text", cls: "ft-text-base" });
		textRow.createSpan({ text: "Large Text", cls: "ft-text-lg" });

		const fontRow = section.createDiv({ cls: "ft-flex ft-gap-4 ft-mt-2" });
		fontRow.createSpan({ text: "Medium", cls: "ft-font-medium" });
		fontRow.createSpan({ text: "Semibold", cls: "ft-font-semibold" });
		fontRow.createSpan({ text: "Bold", cls: "ft-font-bold" });
	}

	private renderUtilities(container: HTMLElement): void {
		const section = this.createSection(container, "Utilities", "Layout and spacing");

		// Flexbox demo
		const flexDemo = section.createDiv({ cls: "ft-card ft-mb-4" });
		flexDemo.createEl("h4", { text: "Flexbox", cls: "ft-heading ft-heading-sm ft-mb-2" });

		const flexRow = flexDemo.createDiv({
			cls: "ft-flex ft-justify-between ft-items-center ft-p-2 ft-showcase-flex-bg",
		});

		flexRow.createSpan({ text: "Left" });
		flexRow.createSpan({ text: "Center" });
		flexRow.createSpan({ text: "Right" });

		// Spacing demo
		const spacingDemo = section.createDiv({ cls: "ft-card ft-mb-4" });
		spacingDemo.createEl("h4", { text: "Spacing (gap)", cls: "ft-heading ft-heading-sm ft-mb-2" });

		const gapRow = spacingDemo.createDiv({ cls: "ft-flex ft-gap-4" });

		["ft-gap-1", "ft-gap-2", "ft-gap-3", "ft-gap-4"].forEach((gapClass) => {
			const box = gapRow.createDiv({ cls: `ft-flex ${gapClass} ft-showcase-gap-box` });

			for (let i = 0; i < 3; i++) {
				box.createDiv({ cls: "ft-showcase-dot" });
			}

			gapRow.createSpan({ text: gapClass.replace("ft-", ""), cls: "ft-text-sm ft-text-muted ft-align-self-center" });
		});

		// Animation demo
		const animDemo = section.createDiv({ cls: "ft-card" });
		animDemo.createEl("h4", { text: "Animation", cls: "ft-heading ft-heading-sm ft-mb-2" });

		const animBtn = animDemo.createEl("button", {
			text: "Fade in test",
			cls: "ft-btn ft-btn-secondary",
		});

		const animTarget = animDemo.createDiv({ cls: "ft-mt-2 ft-p-2 ft-hidden ft-showcase-anim-target" });
		animTarget.createSpan({ text: "Animated content appears here!", cls: "ft-text-muted" });

		animBtn.addEventListener("click", () => {
			if (animTarget.classList.contains("ft-hidden")) {
				animTarget.classList.remove("ft-hidden");
				animTarget.classList.add("ft-animate-fade-in");
			} else {
				animTarget.classList.add("ft-hidden");
				animTarget.classList.remove("ft-animate-fade-in");
			}
		});
	}

	/**
	 * Helper to create a section with title and description.
	 */
	private createSection(container: HTMLElement, title: string, description: string): HTMLElement {
		const section = container.createDiv({ cls: "ft-mb-4" });

		section.createEl("h2", { text: title, cls: "ft-heading ft-heading-md ft-mb-1" });
		section.createEl("p", { text: description, cls: "ft-text-muted ft-text-sm ft-mb-2" });

		return section;
	}
}
