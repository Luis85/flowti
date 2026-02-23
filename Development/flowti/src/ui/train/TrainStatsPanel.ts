/**
 * Train Stats Panel — renders a stat grid showing train metrics.
 *
 * Uses the shared renderStatGrid() utility for consistent styling.
 * Stats: Total Thoughts, Branches, Chain Length, Elapsed Time.
 * Elapsed time ticks live while the train is running.
 */

import type { TrainState } from "../../domain/train/types";
import type { TrainPanelDeps } from "./types";
import { renderStatGrid, type StatCardItem } from "../shared/StatCard";

export class TrainStatsPanel {
	private timerInterval: ReturnType<typeof setInterval> | null = null;

	constructor(
		private el: HTMLElement,
		private deps: TrainPanelDeps,
	) {}

	render(train: TrainState, activePosition?: { index: number; total: number }): void {
		this.stopTimer();
		this.el.empty();

		const timeline = this.deps.trainService.getTimeline(train.id);

		let branchCount = 0;
		for (const thought of train.thoughts) {
			branchCount += this.deps.trainService.getBranches(train.id, thought.id).length;
		}

		const thoughtValue = activePosition
			? `${activePosition.index + 1}/${activePosition.total}`
			: String(train.thoughts.length);

		const cards: StatCardItem[] = [
			{ icon: "brain", value: thoughtValue, label: "Thoughts" },
			{ icon: "git-branch", value: String(branchCount), label: "Branches" },
			{ icon: "link", value: String(timeline.length), label: "Chain" },
			{ icon: "clock", value: this.computeElapsed(train), label: "Elapsed" },
		];

		renderStatGrid(this.el, cards, 4);

		if (train.status === "running") {
			this.startTimer(train);
		}
	}

	destroy(): void {
		this.stopTimer();
	}

	private startTimer(train: TrainState): void {
		const valueEls = this.el.querySelectorAll(".ft-catalog-stat-value");
		const elapsedEl = valueEls[3] as HTMLElement | undefined;
		if (!elapsedEl) return;
		this.timerInterval = setInterval(() => {
			elapsedEl.textContent = this.computeElapsed(train);
		}, 1000);
	}

	private stopTimer(): void {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
	}

	private computeElapsed(train: TrainState): string {
		if (!train.createdAt) return "—";
		const start = new Date(train.createdAt).getTime();
		const end = train.completedAt
			? new Date(train.completedAt).getTime()
			: (train.pausedAt ? new Date(train.pausedAt).getTime() : Date.now());
		const diffMs = Math.max(0, end - start);
		const mins = Math.floor(diffMs / 60_000);
		const secs = Math.floor((diffMs % 60_000) / 1000);
		return `${mins}:${String(secs).padStart(2, "0")}`;
	}
}
