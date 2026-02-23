/**
 * TrainTypePickerModal — type selection modal shown before starting a new train.
 *
 * Displays built-in train types as bordered icon cards in a 2-column grid.
 * Uses div-based cards (not <button>) to avoid Obsidian's aggressive button styling.
 * Selection provides the type config (including default duration) to the caller.
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

		// Header
		const header = contentEl.createDiv({ cls: "ft-train-type-picker-header" });
		const headerIcon = header.createSpan({ cls: "ft-icon-muted" });
		setIcon(headerIcon, "train-front");
		header.createEl("h3", { text: "Start a new ride" });

		contentEl.createDiv({
			text: "Pick a mode — each comes with a suggested timer.",
			cls: "ft-text-muted ft-text-sm ft-train-type-picker-desc",
		});

		// Card grid
		const grid = contentEl.createDiv({ cls: "ft-train-type-grid" });

		for (const typeConfig of BUILT_IN_TRAIN_TYPES) {
			const card = grid.createDiv({ cls: "ft-train-type-card" });
			card.dataset.typeId = typeConfig.id;
			card.setAttribute("role", "button");
			card.tabIndex = 0;

			const iconEl = card.createDiv({ cls: "ft-train-type-card-icon" });
			setIcon(iconEl, typeConfig.icon);

			const label = card.createDiv({ cls: "ft-train-type-card-label" });
			label.setText(typeConfig.label);

			const duration = card.createDiv({ cls: "ft-train-type-card-duration" });
			duration.setText(typeConfig.defaultDuration > 0
				? `${typeConfig.defaultDuration} min`
				: "No timer");

			const select = (): void => {
				this.selected = true;
				this.options.onSelect(typeConfig);
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
