/**
 * CanvasTemplatePickerModal — template selection modal for starting a new canvas.
 *
 * Displays the 5 canvas templates as bordered icon cards in a grid.
 * Selection returns the chosen template to the caller via onSelect callback.
 */

import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";
import { CANVAS_TEMPLATES } from "../../domain/canvas/templates/canvasTemplates";
import type { CanvasTemplate } from "../../domain/canvas/templates/types";

export interface CanvasTemplatePickerOptions {
	onSelect: (template: CanvasTemplate) => void;
}

export class CanvasTemplatePickerModal extends Modal {
	private readonly options: CanvasTemplatePickerOptions;

	constructor(app: App, options: CanvasTemplatePickerOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("ft-canvas-template-picker");

		const header = contentEl.createDiv({ cls: "ft-canvas-template-picker-header" });
		const headerIcon = header.createSpan({ cls: "ft-icon-muted" });
		setIcon(headerIcon, "layout-template");
		header.createEl("h3", { text: "New canvas from template" });

		contentEl.createDiv({
			text: "Choose a template to get started with a structured canvas.",
			cls: "ft-text-muted ft-text-sm ft-canvas-template-picker-desc",
		});

		const grid = contentEl.createDiv({ cls: "ft-canvas-template-grid" });

		for (const template of CANVAS_TEMPLATES) {
			const card = grid.createDiv({ cls: "ft-canvas-template-card" });
			card.dataset.testId = "canvas-template-card";
			card.dataset.templateId = template.id;
			card.setAttribute("role", "button");
			card.tabIndex = 0;

			const iconEl = card.createDiv({ cls: "ft-canvas-template-card-icon" });
			setIcon(iconEl, template.icon);

			const label = card.createDiv({ cls: "ft-canvas-template-card-label" });
			label.setText(template.name);

			const desc = card.createDiv({ cls: "ft-canvas-template-card-desc" });
			desc.setText(template.description);

			const select = (): void => {
				this.options.onSelect(template);
				this.close();
			};

			card.addEventListener("click", select);
			card.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					select();
				}
			});
		}
	}

	onClose(): void {
		// No-op: if the user dismissed without selecting, do nothing
	}
}
