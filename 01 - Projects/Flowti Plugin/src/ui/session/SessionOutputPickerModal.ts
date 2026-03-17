import { Modal, Setting, setIcon } from "obsidian";
import type { App } from "obsidian";
import type { SessionOutputTemplate } from "../../domain/session/types";
import { BUILT_IN_OUTPUT_TEMPLATES } from "../../domain/session/helpers";

/**
 * Modal that presents built-in and custom output templates as selectable cards.
 * On selection, calls onSelect with the chosen template.
 */
export class SessionOutputPickerModal extends Modal {
	private customTemplates: readonly SessionOutputTemplate[];
	private onSelect: (template: SessionOutputTemplate) => void;

	constructor(app: App, options: {
		customTemplates?: readonly SessionOutputTemplate[];
		onSelect: (template: SessionOutputTemplate) => void;
	}) {
		super(app);
		this.customTemplates = options.customTemplates ?? [];
		this.onSelect = options.onSelect;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Generate output artifact" });
		contentEl.createEl("p", {
			text: "Choose a template to generate an output document from this session.",
			cls: "ft-text-muted ft-output-picker-subtitle",
		});

		const grid = contentEl.createDiv({ cls: "ft-output-picker-grid" });

		// Built-in templates
		for (const template of BUILT_IN_OUTPUT_TEMPLATES) {
			this.renderCard(grid, template);
		}

		// Custom templates
		for (const template of this.customTemplates) {
			this.renderCard(grid, template);
		}

		// Cancel
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderCard(parent: HTMLElement, template: SessionOutputTemplate): void {
		const card = parent.createDiv({ cls: "ft-output-picker-card" });

		const titleRow = card.createDiv({ cls: "ft-output-picker-title-row" });

		const iconEl = titleRow.createSpan();
		setIcon(iconEl, this.getTemplateIcon(template.type));

		titleRow.createEl("strong", { text: template.title });
		titleRow.createEl("span", {
			text: template.type,
			cls: "ft-badge ft-output-picker-type-badge",
		});

		card.createEl("p", { text: template.description, cls: "ft-output-picker-desc" });

		card.addEventListener("click", () => {
			this.onSelect(template);
			this.close();
		});
	}

	private getTemplateIcon(type: string): string {
		switch (type) {
			case "meeting-invite": return "calendar";
			case "action-items": return "check-square";
			case "review-summary": return "clipboard-list";
			default: return "file-text";
		}
	}
}
