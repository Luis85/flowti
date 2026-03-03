/**
 * ToolPicker — grouped <select> for choosing a journey action tool.
 *
 * Renders a <select> with <optgroup> per category, options sorted by label.
 */
import type { JourneyToolName } from "../../domain/journeyBuilder/types";
import { TOOL_CATEGORIES, getToolsByCategory } from "../../domain/journeyBuilder/toolSchemas";

export interface ToolPickerDeps {
	onToolSelected: (tool: JourneyToolName) => void;
}

export class ToolPicker {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: ToolPickerDeps,
	) {}

	render(): void {
		this.container.empty();

		const wrapper = this.container.createDiv({ cls: "ft-jb-tool-picker" });
		wrapper.dataset.testId = "jb-tool-picker";

		const select = wrapper.createEl("select", { cls: "ft-jb-tool-select" });
		select.dataset.testId = "jb-tool-select";

		// Placeholder option
		const placeholder = document.createElement("option");
		placeholder.value = "";
		placeholder.textContent = "Select a tool\u2026";
		placeholder.disabled = true;
		placeholder.selected = true;
		select.appendChild(placeholder);

		// Grouped options by category
		for (const cat of TOOL_CATEGORIES) {
			const tools = getToolsByCategory(cat.id);
			if (tools.length === 0) continue;

			const group = document.createElement("optgroup");
			group.label = cat.label;

			for (const tool of tools) {
				const option = document.createElement("option");
				option.value = tool.name;
				option.textContent = tool.label;
				group.appendChild(option);
			}

			select.appendChild(group);
		}

		select.addEventListener("change", () => {
			if (select.value) {
				this.deps.onToolSelected(select.value as JourneyToolName);
				// Reset to placeholder after selection
				select.value = "";
			}
		});
	}
}
