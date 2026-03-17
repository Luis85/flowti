/**
 * Train Closure Panel — train-specific context shown in the session closure overlay.
 *
 * Displays train stats (thoughts, branches, merges, duration, type badge)
 * and key thought titles (max 5) so the user can reflect on their train
 * journey before completing the session.
 *
 * Read-only — reads existing train state, does not mutate.
 */

import { setIcon } from "obsidian";
import type { TrainState } from "../../domain/train/types";
import { BUILT_IN_TRAIN_TYPES } from "../../domain/train/types";

/** Maximum key thoughts to display. */
const MAX_KEY_THOUGHTS = 5;

export class TrainClosurePanel {
	constructor(
		private container: HTMLElement,
		private train: TrainState,
	) {}

	render(): void {
		const panel = this.container.createDiv({ cls: "ft-train-closure-panel" });

		// Type badge + train title
		const headerRow = panel.createDiv({ cls: "ft-train-closure-header" });
		const typeConfig = BUILT_IN_TRAIN_TYPES.find((t) => t.id === this.train.trainType);
		if (typeConfig) {
			const badge = headerRow.createSpan({ cls: "ft-badge ft-badge-muted ft-text-sm" });
			const badgeIcon = badge.createSpan();
			setIcon(badgeIcon, typeConfig.icon);
			badge.appendText(` ${typeConfig.label}`);
		}
		headerRow.createSpan({ cls: "ft-train-closure-title", text: this.train.title });

		// Stat row
		const stats = panel.createDiv({ cls: "ft-train-closure-stats" });
		const thoughtCount = this.train.thoughts.length;
		const branchCount = this.train.relations.filter((r) => r.direction === "branch").length;
		const mergeCount = this.train.relations.filter((r) => r.direction === "merge").length;
		const elapsed = this.computeElapsed();

		this.renderStat(stats, "brain", String(thoughtCount), "thoughts");
		this.renderStat(stats, "git-branch", String(branchCount), branchCount === 1 ? "branch" : "branches");
		if (mergeCount > 0) {
			this.renderStat(stats, "git-merge", String(mergeCount), mergeCount === 1 ? "merge" : "merges");
		}
		this.renderStat(stats, "clock", elapsed, "elapsed");

		// Key thought titles
		const keyThoughts = this.getKeyThoughts();
		if (keyThoughts.length > 0) {
			const list = panel.createDiv({ cls: "ft-train-closure-thoughts" });
			list.createDiv({ cls: "ft-text-sm ft-text-muted", text: "Key thoughts:" });
			for (const title of keyThoughts) {
				const item = list.createDiv({ cls: "ft-train-closure-thought-item" });
				const dot = item.createSpan({ cls: "ft-train-closure-dot" });
				dot.setText("\u2022");
				item.createSpan({ text: title });
			}
		}
	}

	private renderStat(container: HTMLElement, icon: string, value: string, label: string): void {
		const stat = container.createDiv({ cls: "ft-train-closure-stat" });
		const iconEl = stat.createSpan({ cls: "ft-train-closure-stat-icon" });
		setIcon(iconEl, icon);
		stat.createSpan({ text: `${value} ${label}` });
	}

	private computeElapsed(): string {
		if (!this.train.createdAt) return "\u2014";
		const start = new Date(this.train.createdAt).getTime();
		const end = this.train.completedAt
			? new Date(this.train.completedAt).getTime()
			: (this.train.pausedAt ? new Date(this.train.pausedAt).getTime() : Date.now());
		const diffMs = Math.max(0, end - start);
		const mins = Math.floor(diffMs / 60_000);
		return `${mins} min`;
	}

	/** Collect key thoughts: head node, branch origins, merge targets (max 5). */
	private getKeyThoughts(): string[] {
		const titles: string[] = [];
		const seen = new Set<string>();
		const thoughts = this.train.thoughts;

		// Head node (last in main chain via "next" relations)
		if (thoughts.length > 0) {
			// Walk from root following "next" to find head
			let head = thoughts[0];
			for (;;) {
				const next = this.train.relations.find(
					(r) => r.fromId === head.id && r.direction === "next",
				);
				if (!next) break;
				const nextNode = thoughts.find((t) => t.id === next.toId);
				if (!nextNode) break;
				head = nextNode;
			}
			titles.push(head.title);
			seen.add(head.id);
		}

		// Branch origins (from side of "branch" relations)
		for (const rel of this.train.relations) {
			if (titles.length >= MAX_KEY_THOUGHTS) break;
			if (rel.direction === "branch") {
				const node = thoughts.find((t) => t.id === rel.toId);
				if (node && !seen.has(node.id)) {
					titles.push(node.title);
					seen.add(node.id);
				}
			}
		}

		// Merge targets
		for (const rel of this.train.relations) {
			if (titles.length >= MAX_KEY_THOUGHTS) break;
			if (rel.direction === "merge") {
				const node = thoughts.find((t) => t.id === rel.toId);
				if (node && !seen.has(node.id)) {
					titles.push(node.title);
					seen.add(node.id);
				}
			}
		}

		return titles.slice(0, MAX_KEY_THOUGHTS);
	}
}
