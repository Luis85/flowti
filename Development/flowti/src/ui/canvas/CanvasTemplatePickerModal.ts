/**
 * CanvasTemplatePickerModal — template selection modal for starting a new canvas.
 *
 * Displays canvas templates as bordered icon cards in a 2-column grid.
 * Each card shows a category badge and group preview chips.
 * Selection returns the chosen template to the caller via onSelect callback.
 */

import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";
import { CANVAS_TEMPLATES } from "../../domain/canvas/templates/canvasTemplates";
import type { CanvasTemplate } from "../../domain/canvas/templates/types";

export interface CanvasTemplatePickerOptions {
	onSelect: (template: CanvasTemplate) => void;
}

/** Extract group labels from a template's generated CanvasData. */
function getGroupLabels(template: CanvasTemplate): string[] {
	const data = template.generate();
	return data.nodes
		.filter((n) => (n as { type: string }).type === "group")
		.map((n) => (n as { label?: string }).label ?? "")
		.filter(Boolean);
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
			text: "Choose a template to start a structured canvas session.",
			cls: "ft-text-muted ft-text-sm ft-canvas-template-picker-desc",
		});

		const grid = contentEl.createDiv({ cls: "ft-canvas-template-grid" });

		for (const template of CANVAS_TEMPLATES) {
			const card = grid.createDiv({ cls: "ft-canvas-template-card" });
			card.dataset.testId = "canvas-template-card";
			card.dataset.templateId = template.id;
			card.setAttribute("role", "button");
			card.tabIndex = 0;

			// Top row: icon + label + category badge
			const top = card.createDiv({ cls: "ft-canvas-template-card-top" });

			const iconEl = top.createDiv({ cls: "ft-canvas-template-card-icon" });
			setIcon(iconEl, template.icon);

			top.createDiv({ cls: "ft-canvas-template-card-label", text: template.name });
			top.createDiv({ cls: "ft-canvas-template-card-badge", text: template.category });

			// Description
			card.createDiv({ cls: "ft-canvas-template-card-desc", text: template.description });

			// Group preview chips
			const groups = getGroupLabels(template);
			if (groups.length > 0) {
				const chips = card.createDiv({ cls: "ft-canvas-template-card-groups" });
				for (const label of groups) {
					chips.createSpan({ cls: "ft-canvas-template-card-group", text: label });
				}
			}

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
