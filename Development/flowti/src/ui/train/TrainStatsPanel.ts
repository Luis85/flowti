/**
 * Train Stats Panel — renders a stat grid showing train metrics.
 *
 * Uses the shared renderStatGrid() utility for consistent styling.
 * Stats: Total Thoughts, Branches, Chain Length, Elapsed Time.
 */

import type { TrainState } from "../../domain/train/types";
import type { TrainPanelDeps } from "./types";
import { renderStatGrid, type StatCardItem } from "../shared/StatCard";

export class TrainStatsPanel {
	constructor(
		private el: HTMLElement,
		private deps: TrainPanelDeps,
	) {}

	render(train: TrainState): void {
		this.el.empty();

		const timeline = this.deps.trainService.getTimeline(train.id);

		let branchCount = 0;
		for (const thought of train.thoughts) {
			branchCount += this.deps.trainService.getBranches(train.id, thought.id).length;
		}

		const cards: StatCardItem[] = [
			{ icon: "brain", value: String(train.thoughts.length), label: "Thoughts" },
			{ icon: "git-branch", value: String(branchCount), label: "Branches" },
			{ icon: "link", value: String(timeline.length), label: "Chain" },
			{ icon: "clock", value: this.computeElapsed(train), label: "Elapsed" },
		];

		renderStatGrid(this.el, cards, 4);
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
