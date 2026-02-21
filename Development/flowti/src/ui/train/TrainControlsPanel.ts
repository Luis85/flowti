/**
 * Train Controls Panel — status-aware action buttons.
 *
 * Shows Pause/Resume/Complete buttons based on train status.
 * Uses shared ft-btn classes for consistent button styling.
 * All mutations go through TrainService; re-render triggered via deps.scheduleRender().
 */

import { setIcon } from "obsidian";
import type { TrainState } from "../../domain/train/types";
import type { TrainPanelDeps } from "./types";

export class TrainControlsPanel {
	constructor(
		private el: HTMLElement,
		private deps: TrainPanelDeps,
	) {}

	render(train: TrainState): void {
		this.el.empty();

		const bar = this.el.createDiv({ cls: "ft-detail-actions" });

		if (train.status === "running") {
			this.addButton(bar, "Pause", "pause", async () => {
				await this.deps.trainService.pause(train.id);
				this.deps.scheduleRender();
			});
			this.addButton(bar, "Complete", "check-circle", async () => {
				await this.deps.trainService.completeTrain(train.id);
				this.deps.scheduleRender();
			});
			this.addButton(bar, "Add Thought", "plus-circle", () => {
				const fromThoughtId = this.deps.getActiveThoughtId?.() ?? undefined;
				void this.deps.eventBus.emit("ui.startTrain", { fromThoughtId });
			}, true);
		} else if (train.status === "paused") {
			this.addButton(bar, "Resume", "play", () => {
				const fromThoughtId = this.deps.getActiveThoughtId?.() ?? undefined;
				void this.deps.eventBus.emit("ui.startTrain", { fromThoughtId });
			}, true);
			this.addButton(bar, "Complete", "check-circle", async () => {
				await this.deps.trainService.completeTrain(train.id);
				this.deps.scheduleRender();
			});
		}
		// No buttons for "completed" status
	}

	private addButton(
		bar: HTMLElement,
		label: string,
		icon: string,
		onClick: () => void | Promise<void>,
		primary = false,
	): void {
		const cls = primary
			? "ft-btn ft-btn-primary ft-btn-sm"
			: "ft-btn ft-btn-secondary ft-btn-sm";
		const btn = bar.createEl("button", { cls });
		const iconEl = btn.createSpan();
		setIcon(iconEl, icon);
		btn.appendText(` ${label}`);
		btn.addEventListener("click", () => {
			void onClick();
		});
	}
}
