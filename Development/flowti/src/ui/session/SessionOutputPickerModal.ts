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
			cls: "ft-text-muted",
		}).style.cssText = "color:var(--text-muted);margin-bottom:12px;";

		const grid = contentEl.createDiv({ cls: "ft-output-picker-grid" });
		grid.style.cssText = "display:flex;flex-direction:column;gap:8px;";

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
		card.style.cssText = "padding:12px;border:1px solid var(--background-modifier-border);border-radius:8px;cursor:pointer;";
		card.addEventListener("mouseenter", () => { card.style.background = "var(--background-modifier-hover)"; });
		card.addEventListener("mouseleave", () => { card.style.background = ""; });

		const titleRow = card.createDiv();
		titleRow.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:4px;";

		const iconEl = titleRow.createSpan();
		setIcon(iconEl, this.getTemplateIcon(template.type));

		titleRow.createEl("strong", { text: template.title });
		titleRow.createEl("span", {
			text: template.type,
			cls: "ft-badge",
		}).style.cssText = "background:var(--background-modifier-hover);padding:2px 6px;border-radius:4px;font-size:11px;";

		card.createEl("p", { text: template.description }).style.cssText = "margin:0;font-size:12px;color:var(--text-muted);";

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
