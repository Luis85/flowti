/**
 * StepCard — renders a single active step with editable title.
 *
 * Shows: [step number badge] [editable title input] [remove ✕]
 */
import { setIcon } from "obsidian";
import type { JourneyStep } from "./JourneyBuilderSidebar";

export interface StepCardDeps {
	/** The step to render. */
	step: JourneyStep;
	/** 1-based step number for the badge. */
	stepNumber: number;
	/** Number of actions on this step (for display). */
	actionCount?: number;
	/** Called when the user edits the step title. */
	onTitleChanged: (newTitle: string) => void;
	/** Called when the user edits the step description. */
	onDescriptionChanged: (desc: string) => void;
	/** Called when the user changes the swimlane. */
	onSwimlanChanged: (swimlane: string) => void;
	/** Called when the user clicks the remove button. */
	onRemove: () => void;
}

export class StepCard {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: StepCardDeps,
	) {}

	render(): void {
		this.container.empty();

		const { step, stepNumber } = this.deps;

		const card = this.container.createDiv({ cls: "ft-jb-step-card" });
		card.dataset.testId = "jb-step-card";
		card.dataset.stepId = step.id;

		const header = card.createDiv({ cls: "ft-jb-step-card-header" });

		// Step number badge
		const numBadge = header.createSpan({ cls: "ft-jb-step-num", text: `${stepNumber}` });
		numBadge.dataset.testId = "jb-step-num";

		// Editable title input
		const titleInput = header.createEl("input", { cls: "ft-jb-step-title-input", type: "text" });
		titleInput.dataset.testId = "jb-step-title-input";
		titleInput.placeholder = "Enter step title…";
		titleInput.value = step.title;
		titleInput.addEventListener("input", () => {
			this.deps.onTitleChanged(titleInput.value);
		});

		// Remove button
		const removeBtn = header.createSpan({ cls: "ft-jb-step-remove" });
		removeBtn.dataset.testId = "jb-step-remove";
		removeBtn.setAttribute("role", "button");
		removeBtn.setAttribute("tabindex", "0");
		setIcon(removeBtn, "x");
		removeBtn.addEventListener("click", () => this.deps.onRemove());
		removeBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				this.deps.onRemove();
			}
		});

		// Description textarea
		const descEl = card.createEl("textarea", { cls: "ft-jb-step-description" });
		descEl.dataset.testId = "jb-step-description";
		descEl.placeholder = "Step description…";
		descEl.rows = 2;
		descEl.value = step.description;
		descEl.addEventListener("input", () => {
			this.deps.onDescriptionChanged(descEl.value);
		});

		// Swimlane dropdown
		const swimlaneEl = card.createEl("select", { cls: "ft-jb-step-swimlane" });
		swimlaneEl.dataset.testId = "jb-step-swimlane";
		const placeholder = swimlaneEl.createEl("option", { text: "Select swimlane…" });
		placeholder.value = "";
		placeholder.disabled = true;
		for (const { value, label } of [
			{ value: "customer", label: "Customer" },
			{ value: "frontstage", label: "Frontstage" },
			{ value: "backstage", label: "Backstage" },
			{ value: "support", label: "Support" },
		]) {
			const opt = swimlaneEl.createEl("option", { text: label });
			opt.value = value;
		}
		swimlaneEl.value = step.swimlane || "";
		swimlaneEl.addEventListener("change", () => {
			this.deps.onSwimlanChanged(swimlaneEl.value);
		});

		// Action count
		if (this.deps.actionCount !== undefined) {
			const countEl = card.createDiv({ cls: "ft-jb-step-action-count" });
			countEl.dataset.testId = "jb-step-action-count";
			countEl.textContent = this.deps.actionCount === 0
				? "No actions"
				: `${this.deps.actionCount} action${this.deps.actionCount === 1 ? "" : "s"}`;
		}
	}
}
