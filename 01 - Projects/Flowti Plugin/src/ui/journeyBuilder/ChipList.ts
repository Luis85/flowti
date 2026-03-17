/**
 * ChipList — reusable add/remove chip list for step metadata arrays.
 *
 * Renders inline chips with remove buttons and a text input for adding items.
 * Used for events, commands, interactions, and components on the StepCard.
 */

export interface ChipListDeps {
	label: string;
	items: string[];
	testIdPrefix: string;
	placeholder?: string;
	onChanged: (items: string[]) => void;
}

export class ChipList {
	constructor(
		private readonly container: HTMLElement,
		private readonly deps: ChipListDeps,
	) {}

	render(): void {
		const { label, items, testIdPrefix, placeholder, onChanged } = this.deps;

		const wrapper = this.container.createDiv({ cls: "ft-jb-chip-list" });
		wrapper.dataset.testId = `${testIdPrefix}-list`;

		const header = wrapper.createEl("label", { cls: "ft-jb-form-label", text: label });
		header.dataset.testId = `${testIdPrefix}-label`;

		const chipContainer = wrapper.createDiv({ cls: "ft-jb-chip-container" });

		const current = [...items];

		const renderChips = (): void => {
			chipContainer.empty();
			for (let i = 0; i < current.length; i++) {
				const chip = chipContainer.createDiv({ cls: "ft-jb-chip" });
				chip.dataset.testId = `${testIdPrefix}-chip`;

				const text = chip.createSpan({ cls: "ft-jb-chip-text", text: current[i] });
				text.dataset.testId = `${testIdPrefix}-chip-text`;

				const remove = chip.createSpan({ cls: "ft-jb-chip-remove", text: "\u00d7" });
				remove.dataset.testId = `${testIdPrefix}-remove`;
				remove.setAttribute("role", "button");
				remove.tabIndex = 0;

				const idx = i;
				remove.addEventListener("click", () => {
					current.splice(idx, 1);
					onChanged([...current]);
					renderChips();
				});
				remove.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter" || e.key === " ") {
						e.preventDefault();
						current.splice(idx, 1);
						onChanged([...current]);
						renderChips();
					}
				});
			}
		};

		renderChips();

		const input = wrapper.createEl("input", {
			cls: "ft-jb-chip-input",
			type: "text",
		});
		input.placeholder = placeholder ?? `Add ${label.toLowerCase()}\u2026`;
		input.dataset.testId = `${testIdPrefix}-input`;

		input.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				e.preventDefault();
				const value = input.value.trim();
				if (!value || current.includes(value)) return;
				current.push(value);
				onChanged([...current]);
				renderChips();
				input.value = "";
			}
		});
	}
}
