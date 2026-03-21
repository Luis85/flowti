/**
 * ActionForm — generic form builder from a ToolSchemaDef.
 *
 * Renders one input per field definition (text, number, select, textarea).
 * Supports conditional field visibility via `visibleWhen`, assert type picker,
 * and command picker with searchable command list.
 * Always appends a description text input at the end.
 */
import type { JourneyAction, ToolSchemaDef, ToolFieldDef } from "../../domain/journeyBuilder/types";
import type { EventSuggestItem } from "./EventSuggestTypes";
import { attachEventSuggest } from "./EventSuggest";

export interface ActionFormDeps {
	action: JourneyAction;
	schema: ToolSchemaDef;
	onFieldChanged: (key: string, value: string | number) => void;
	getEventCatalog?: () => EventSuggestItem[];
	getCommands?: () => { id: string; label: string; domain: string }[];
	onReRender?: () => void;
}

export class ActionForm {
	private cleanups: (() => void)[] = [];

	constructor(
		private readonly container: HTMLElement,
		private readonly deps: ActionFormDeps,
	) {}

	render(): void {
		// Clean up previous autocomplete subscriptions
		for (const cleanup of this.cleanups) cleanup();
		this.cleanups = [];

		this.container.empty();

		const form = this.container.createDiv({ cls: "ft-jb-action-form" });
		form.dataset.testId = "jb-action-form";

		const { action, schema } = this.deps;

		// Assert type picker (before schema fields)
		if (action.tool === "assert") {
			this.renderAssertTypePicker(form, action, schema);
		}

		// Command picker (replaces plain id field for command tool)
		if (action.tool === "command" && this.deps.getCommands) {
			this.renderCommandPicker(form, action);
		}

		// Schema-driven fields
		for (const field of schema.fields) {
			// Skip command id field if command picker is active
			if (action.tool === "command" && field.key === "id" && this.deps.getCommands) continue;
			// Skip assert type field (rendered as type picker above)
			if (action.tool === "assert" && field.key === "type") continue;

			// Conditional visibility
			if (!this.isFieldVisible(field, action)) continue;

			this.renderField(form, field, action);
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

	// ── Assert type picker ──────────────────────────────────

	private renderAssertTypePicker(form: HTMLElement, action: JourneyAction, schema: ToolSchemaDef): void {
		const typeField = schema.fields.find((f) => f.key === "type");
		if (!typeField?.options) return;

		const picker = form.createDiv({ cls: "ft-jb-assert-type-picker" });
		picker.dataset.testId = "jb-assert-type-picker";

		for (const opt of typeField.options) {
			const btn = picker.createDiv({
				cls: `ft-jb-assert-type-btn${String(action.type) === opt.value ? " is-active" : ""}`,
				text: opt.label,
			});
			btn.dataset.testId = `jb-assert-type-${opt.value}`;
			btn.setAttribute("role", "button");
			btn.setAttribute("tabindex", "0");
			btn.addEventListener("click", () => {
				this.deps.onFieldChanged("type", opt.value);
				this.deps.onReRender?.();
			});
			btn.addEventListener("keydown", (e: KeyboardEvent) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					this.deps.onFieldChanged("type", opt.value);
					this.deps.onReRender?.();
				}
			});
		}
	}

	// ── Command picker ──────────────────────────────────────

	private renderCommandPicker(form: HTMLElement, action: JourneyAction): void {
		const commands = this.deps.getCommands!();
		const picker = form.createDiv({ cls: "ft-jb-command-picker" });
		picker.dataset.testId = "jb-command-picker";

		const label = picker.createEl("label", { cls: "ft-jb-form-label", text: "Command *" });
		label.dataset.testId = "jb-action-label-id";

		const input = picker.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		input.dataset.testId = "jb-action-field-id";
		input.placeholder = "Search commands\u2026";
		input.value = String(action.id ?? "");
		input.addEventListener("input", () => {
			this.deps.onFieldChanged("id", input.value);
		});

		const items: EventSuggestItem[] = commands.map((c) => ({
			type: c.id,
			category: c.domain,
			description: c.label,
		}));

		const unsub = attachEventSuggest(input, () => items, (id) => {
			this.deps.onFieldChanged("id", id);
		});
		this.cleanups.push(unsub);
	}

	// ── Conditional visibility ──────────────────────────────

	private isFieldVisible(field: ToolFieldDef, action: JourneyAction): boolean {
		if (!field.visibleWhen) return true;
		const dependentValue = String(action[field.visibleWhen.field] ?? "");
		return field.visibleWhen.values.includes(dependentValue);
	}

	// ── Field rendering ─────────────────────────────────────

	private renderField(form: HTMLElement, field: ToolFieldDef, action: JourneyAction): void {
		const group = form.createDiv({ cls: "ft-jb-form-group" });
		const label = group.createEl("label", {
			cls: "ft-jb-form-label",
			text: field.required ? `${field.label} *` : field.label,
		});
		label.dataset.testId = `jb-action-label-${field.key}`;

		const currentValue = action[field.key];

		if (field.type === "select") {
			this.renderSelectField(group, field, currentValue);
		} else if (field.type === "textarea") {
			this.renderTextareaField(group, field, currentValue);
		} else if (field.type === "number") {
			this.renderNumberField(group, field, currentValue);
		} else {
			this.renderTextField(group, field, currentValue);
		}
	}

	private renderSelectField(group: HTMLElement, field: ToolFieldDef, currentValue: unknown): void {
		const select = group.createEl("select", { cls: "ft-jb-form-select" });
		select.dataset.testId = `jb-action-field-${field.key}`;

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
			if (this.hasDependentFields(field.key)) {
				this.deps.onReRender?.();
			}
		});
	}

	private renderTextareaField(group: HTMLElement, field: ToolFieldDef, currentValue: unknown): void {
		const textarea = group.createEl("textarea", { cls: "ft-jb-form-textarea" });
		textarea.dataset.testId = `jb-action-field-${field.key}`;
		textarea.placeholder = field.placeholder ?? "";
		textarea.value = currentValue != null ? String(currentValue) : "";
		textarea.rows = 3;
		textarea.addEventListener("input", () => {
			this.deps.onFieldChanged(field.key, textarea.value);
		});
	}

	private renderNumberField(group: HTMLElement, field: ToolFieldDef, currentValue: unknown): void {
		const input = group.createEl("input", { cls: "ft-jb-form-input", type: "number" });
		input.dataset.testId = `jb-action-field-${field.key}`;
		input.placeholder = field.placeholder ?? "";
		input.value = currentValue != null ? String(currentValue) : "";
		input.addEventListener("input", () => {
			const num = input.value === "" ? "" : Number(input.value);
			this.deps.onFieldChanged(field.key, num);
		});
	}

	private renderTextField(group: HTMLElement, field: ToolFieldDef, currentValue: unknown): void {
		const input = group.createEl("input", { cls: "ft-jb-form-input", type: "text" });
		input.dataset.testId = `jb-action-field-${field.key}`;
		input.placeholder = field.placeholder ?? "";
		input.value = currentValue != null ? String(currentValue) : "";
		input.addEventListener("input", () => {
			this.deps.onFieldChanged(field.key, input.value);
		});

		// Attach event suggest to event fields (assert, emit, query-trace)
		if (field.key === "event" && this.deps.getEventCatalog) {
			input.dataset.testId = "jb-event-suggest-input";
			const unsub = attachEventSuggest(input, this.deps.getEventCatalog, (value) => {
				this.deps.onFieldChanged(field.key, value);
			});
			this.cleanups.push(unsub);
		}
	}

	private hasDependentFields(fieldKey: string): boolean {
		return this.deps.schema.fields.some(
			(f) => f.visibleWhen?.field === fieldKey,
		);
	}
}
