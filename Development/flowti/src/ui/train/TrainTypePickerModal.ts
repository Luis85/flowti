/**
 * TrainTypePickerModal — type selection modal shown before starting a new train.
 *
 * Displays built-in train types as icon cards. Selection provides
 * the type config (including default duration) to the caller.
 */

import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";
import { BUILT_IN_TRAIN_TYPES, type TrainTypeConfig } from "../../domain/train/types";

export interface TrainTypePickerOptions {
	onSelect: (config: TrainTypeConfig) => void;
}

export class TrainTypePickerModal extends Modal {
	private readonly options: TrainTypePickerOptions;
	private selected = false;

	constructor(app: App, options: TrainTypePickerOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("ft-train-type-picker");

		contentEl.createEl("h3", { text: "Choose a train type" });
		contentEl.createDiv({
			text: "Each type has a default timer duration.",
			cls: "ft-text-muted ft-text-sm ft-mb-3",
		});

		const grid = contentEl.createDiv({ cls: "ft-grid ft-grid-cols-2 ft-gap-2 ft-train-type-grid" });

		for (const typeConfig of BUILT_IN_TRAIN_TYPES) {
			const card = grid.createEl("button", {
				cls: "ft-btn ft-btn-ghost ft-p-3 ft-text-left ft-train-type-card",
			});
			card.dataset.typeId = typeConfig.id;

			const row = card.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const iconEl = row.createSpan();
			setIcon(iconEl, typeConfig.icon);
			const textCol = row.createDiv();
			textCol.createDiv({ text: typeConfig.label, cls: "ft-text-sm ft-text-bold" });
			const durationText = typeConfig.defaultDuration > 0
				? `${typeConfig.defaultDuration} min`
				: "No timer";
			textCol.createDiv({ text: durationText, cls: "ft-text-xs ft-text-muted" });

			card.addEventListener("click", () => {
				this.selected = true;
				this.options.onSelect(typeConfig);
				this.close();
			});
		}
	}

	onClose(): void {
		if (!this.selected) {
			// Default to free-form on dismiss
			const freeForm = BUILT_IN_TRAIN_TYPES.find((t) => t.id === "free-form");
			if (freeForm) this.options.onSelect(freeForm);
		}
	}
}
