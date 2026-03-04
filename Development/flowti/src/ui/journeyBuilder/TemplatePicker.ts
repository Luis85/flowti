/**
 * TemplatePicker — displays pre-built action templates as clickable cards.
 *
 * Shown when user clicks "Add action". Offers quick multi-action patterns
 * and a "Custom" fallback to the individual tool picker.
 */
import { setIcon } from "obsidian";
import { ACTION_TEMPLATES } from "../../domain/journeyBuilder/types";

export interface TemplatePickerDeps {
	onTemplateSelected: (templateId: string) => void;
	onCustom: () => void;
}

export class TemplatePicker {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: TemplatePickerDeps,
	) {}

	render(): void {
		const wrapper = this.container.createDiv({ cls: "ft-jb-template-picker" });
		wrapper.dataset.testId = "jb-template-picker";

		for (const template of ACTION_TEMPLATES) {
			const card = wrapper.createDiv({ cls: "ft-jb-template-card" });
			card.dataset.testId = "jb-template-card";
			card.dataset.templateId = template.id;
			card.setAttribute("role", "button");
			card.tabIndex = 0;

			const iconEl = card.createSpan({ cls: "ft-jb-template-card-icon" });
			setIcon(iconEl, template.icon);

			const body = card.createDiv({ cls: "ft-jb-template-card-body" });
			const label = body.createDiv({ cls: "ft-jb-template-card-label", text: template.label });
			label.dataset.testId = "jb-template-label";
			const desc = body.createDiv({ cls: "ft-jb-template-card-desc", text: template.description });
			desc.dataset.testId = "jb-template-desc";

			card.addEventListener("click", () => this.deps.onTemplateSelected(template.id));
			card.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.deps.onTemplateSelected(template.id);
				}
			});
		}

		// Custom action fallback
		const custom = wrapper.createDiv({ cls: "ft-jb-template-card ft-jb-template-custom" });
		custom.dataset.testId = "jb-template-custom";
		custom.setAttribute("role", "button");
		custom.tabIndex = 0;

		const customIcon = custom.createSpan({ cls: "ft-jb-template-card-icon" });
		setIcon(customIcon, "plus");

		const customBody = custom.createDiv({ cls: "ft-jb-template-card-body" });
		customBody.createDiv({ cls: "ft-jb-template-card-label", text: "Custom action" });
		customBody.createDiv({ cls: "ft-jb-template-card-desc", text: "Pick any tool from the full list" });

		custom.addEventListener("click", () => this.deps.onCustom());
		custom.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.deps.onCustom();
			}
		});
	}
}
