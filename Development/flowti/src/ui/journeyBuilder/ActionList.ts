/**
 * ActionList — renders the list of actions for the active step.
 *
 * Each action shows: [tool badge] [summary] [↑] [↓] [✕]
 * Selected action gets `is-selected` class.
 * "Add action" button at the bottom.
 */
import { setIcon } from "obsidian";
import type { JourneyAction } from "../../domain/journeyBuilder/types";
import { TOOL_SCHEMAS } from "../../domain/journeyBuilder/toolSchemas";

export interface ActionListDeps {
	actions: JourneyAction[];
	selectedIndex: number;
	onAddAction: () => void;
	onRemoveAction: (index: number) => void;
	onMoveAction: (fromIndex: number, direction: "up" | "down") => void;
	onSelectAction: (index: number) => void;
}

export class ActionList {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: ActionListDeps,
	) {}

	render(): void {
		this.container.empty();

		const list = this.container.createDiv({ cls: "ft-jb-action-list" });
		list.dataset.testId = "jb-action-list";

		const { actions, selectedIndex } = this.deps;

		for (let i = 0; i < actions.length; i++) {
			const action = actions[i];
			const isSelected = i === selectedIndex;

			const card = list.createDiv({
				cls: `ft-jb-action-card${isSelected ? " is-selected" : ""}`,
			});
			card.dataset.testId = "jb-action-card";
			card.dataset.actionIndex = `${i}`;
			card.setAttribute("role", "button");
			card.setAttribute("tabindex", "0");

			// Tool badge
			const schema = TOOL_SCHEMAS[action.tool];
			const badge = card.createSpan({
				cls: "ft-jb-action-tool-badge",
				text: schema?.label ?? action.tool,
			});
			badge.dataset.testId = "jb-action-tool-badge";

			// Summary — first required field value or description
			const summary = this.getSummary(action);
			if (summary) {
				card.createSpan({ cls: "ft-jb-action-summary", text: summary });
			}

			// Controls
			const controls = card.createDiv({ cls: "ft-jb-action-controls" });

			// Move up
			const upBtn = controls.createSpan({
				cls: `ft-jb-action-move-up${i === 0 ? " is-disabled" : ""}`,
			});
			upBtn.dataset.testId = "jb-action-move-up";
			upBtn.setAttribute("role", "button");
			upBtn.setAttribute("tabindex", i === 0 ? "-1" : "0");
			upBtn.setAttribute("aria-label", "Move up");
			if (i === 0) upBtn.setAttribute("aria-disabled", "true");
			setIcon(upBtn, "arrow-up");
			if (i > 0) {
				upBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.deps.onMoveAction(i, "up");
				});
			}

			// Move down
			const downBtn = controls.createSpan({
				cls: `ft-jb-action-move-down${i === actions.length - 1 ? " is-disabled" : ""}`,
			});
			downBtn.dataset.testId = "jb-action-move-down";
			downBtn.setAttribute("role", "button");
			downBtn.setAttribute("tabindex", i === actions.length - 1 ? "-1" : "0");
			downBtn.setAttribute("aria-label", "Move down");
			if (i === actions.length - 1) downBtn.setAttribute("aria-disabled", "true");
			setIcon(downBtn, "arrow-down");
			if (i < actions.length - 1) {
				downBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					this.deps.onMoveAction(i, "down");
				});
			}

			// Remove
			const removeBtn = controls.createSpan({ cls: "ft-jb-action-remove" });
			removeBtn.dataset.testId = "jb-action-remove";
			removeBtn.setAttribute("role", "button");
			removeBtn.setAttribute("tabindex", "0");
			removeBtn.setAttribute("aria-label", "Remove action");
			setIcon(removeBtn, "x");
			removeBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.deps.onRemoveAction(i);
			});

			// Select on card click
			card.addEventListener("click", () => this.deps.onSelectAction(i));
		}

		// Add action button
		const addBtn = list.createDiv({ cls: "ft-jb-add-action-btn" });
		addBtn.dataset.testId = "jb-add-action-btn";
		addBtn.setAttribute("role", "button");
		addBtn.setAttribute("tabindex", "0");
		addBtn.setAttribute("aria-label", "Add action");
		const addIcon = addBtn.createSpan();
		setIcon(addIcon, "plus");
		addBtn.createSpan({ text: "Add action" });
		addBtn.addEventListener("click", () => this.deps.onAddAction());
		addBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.deps.onAddAction();
			}
		});
	}

	private getSummary(action: JourneyAction): string {
		if (action.description) return String(action.description);
		const schema = TOOL_SCHEMAS[action.tool];
		if (!schema) return "";
		const firstRequired = schema.fields.find((f) => f.required);
		if (firstRequired) {
			const val = action[firstRequired.key];
			if (val !== undefined && val !== "") return String(val);
		}
		return "";
	}
}
