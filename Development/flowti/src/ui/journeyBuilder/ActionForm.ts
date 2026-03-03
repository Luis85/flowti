/**
 * ActionForm — generic form builder from a ToolSchemaDef.
 *
 * Renders one input per field definition (text, number, select, textarea).
 * Always appends a description text input at the end.
 */
import type { JourneyAction, ToolSchemaDef } from "../../domain/journeyBuilder/types";

export interface ActionFormDeps {
	action: JourneyAction;
	schema: ToolSchemaDef;
	onFieldChanged: (key: string, value: string | number) => void;
}

export class ActionForm {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: ActionFormDeps,
	) {}

	render(): void {
		this.container.empty();

		const form = this.container.createDiv({ cls: "ft-jb-action-form" });
		form.dataset.testId = "jb-action-form";

		const { action, schema } = this.deps;

		// Schema-driven fields
		for (const field of schema.fields) {
			const group = form.createDiv({ cls: "ft-jb-form-group" });
			const label = group.createEl("label", {
				cls: "ft-jb-form-label",
				text: field.required ? `${field.label} *` : field.label,
			});
			label.dataset.testId = `jb-action-label-${field.key}`;

			const currentValue = action[field.key];

			if (field.type === "select") {
				const select = group.createEl("select", { cls: "ft-jb-form-select" });
				select.dataset.testId = `jb-action-field-${field.key}`;

				// Empty option
				const emptyOpt = document.createElement("option");
				emptyOpt.value = "";
				emptyOpt.textContent = field.placeholder ?? "";
				select.appendChild(emptyOpt);

				for (const opt of field.options ?? []) {
					const option = document.createElement("option");
					option.value = opt.value;
					option.textContent = opt.label;
					if (String(currentValue) === opt.value) option.selected = true;
					select.appendChild(option);
				}

				select.addEventListener("change", () => {
					this.deps.onFieldChanged(field.key, select.value);
				});
			} else if (field.type === "textarea") {
				const textarea = group.createEl("textarea", { cls: "ft-jb-form-textarea" });
				textarea.dataset.testId = `jb-action-field-${field.key}`;
				textarea.placeholder = field.placeholder ?? "";
				textarea.value = currentValue != null ? String(currentValue) : "";
				textarea.rows = 3;
				textarea.addEventListener("input", () => {
					this.deps.onFieldChanged(field.key, textarea.value);
				});
			} else if (field.type === "number") {
				const input = group.createEl("input", { cls: "ft-jb-form-input", type: "number" });
				input.dataset.testId = `jb-action-field-${field.key}`;
				input.placeholder = field.placeholder ?? "";
				input.value = currentValue != null ? String(currentValue) : "";
				input.addEventListener("input", () => {
					const num = input.value === "" ? "" : Number(input.value);
					this.deps.onFieldChanged(field.key, num);
				});
			} else {
				// text
				const input = group.createEl("input", { cls: "ft-jb-form-input", type: "text" });
				input.dataset.testId = `jb-action-field-${field.key}`;
				input.placeholder = field.placeholder ?? "";
				input.value = currentValue != null ? String(currentValue) : "";
				input.addEventListener("input", () => {
					this.deps.onFieldChanged(field.key, input.value);
				});
			}
		}

		// Description field (always appended)
		const descGroup = form.createDiv({ cls: "ft-jb-form-group" });
		descGroup.createEl("label", { cls: "ft-jb-form-label", text: "Description" });
		const descInput = descGroup.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		descInput.dataset.testId = "jb-action-field-description";
		descInput.placeholder = "Optional description for this action";
		descInput.value = action.description ?? "";
		descInput.addEventListener("input", () => {
			this.deps.onFieldChanged("description", descInput.value);
		});
	}
}
