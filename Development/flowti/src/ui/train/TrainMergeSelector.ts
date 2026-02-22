/**
 * TrainMergeSelector — inline panel for selecting a merge target.
 *
 * Shows all thoughts in the train as candidate targets.
 * Invalid targets (self, descendants) are visually dimmed.
 * Clicking a valid target calls `onSelect(targetId)`.
 */

import { setIcon } from "obsidian";
import type { ThoughtNode, TrainState } from "../../domain/train/types";
import type { TrainService } from "../../domain/train/TrainService";

export interface TrainMergeSelectorDeps {
	trainService: TrainService;
	onSelect: (targetId: string) => void;
	onCancel: () => void;
}

export class TrainMergeSelector {
	constructor(
		private el: HTMLElement,
		private deps: TrainMergeSelectorDeps,
	) {}

	render(train: TrainState, sourceId: string): void {
		this.el.empty();

		const wrapper = this.el.createDiv({ cls: "ft-merge-selector" });

		// Header with cancel button
		const header = wrapper.createDiv({ cls: "ft-flex ft-items-center ft-justify-between ft-merge-selector-header" });
		header.createSpan({ cls: "ft-heading-sm", text: "Select merge target" });
		const cancelBtn = header.createEl("button", { cls: "ft-btn ft-btn-ghost ft-btn-sm" });
		cancelBtn.setText("Cancel");
		cancelBtn.addEventListener("click", () => this.deps.onCancel());

		// Build set of invalid targets (self + descendants reachable via next/branch)
		const invalidIds = this.computeInvalidTargets(train, sourceId);

		// Already merged targets
		const mergedTargetIds = new Set(
			train.relations
				.filter((r) => r.fromId === sourceId && r.direction === "merge")
				.map((r) => r.toId),
		);

		// List all thoughts as candidates
		const list = wrapper.createDiv({ cls: "ft-merge-selector-list" });
		for (const thought of train.thoughts) {
			const isInvalid = invalidIds.has(thought.id);
			const isAlreadyMerged = mergedTargetIds.has(thought.id);
			const isSelf = thought.id === sourceId;

			this.renderTarget(list, thought, {
				isSelf,
				isInvalid,
				isAlreadyMerged,
			});
		}
	}

	private renderTarget(
		list: HTMLElement,
		thought: ThoughtNode,
		flags: { isSelf: boolean; isInvalid: boolean; isAlreadyMerged: boolean },
	): void {
		const isDisabled = flags.isSelf || flags.isInvalid || flags.isAlreadyMerged;
		const cls = [
			"ft-merge-target",
			isDisabled ? "ft-merge-target-disabled" : "ft-merge-target-valid",
		].join(" ");

		const row = list.createDiv({ cls });

		const icon = row.createSpan();
		setIcon(icon, flags.isAlreadyMerged ? "check" : "git-merge");

		row.createSpan({
			cls: "ft-merge-target-title",
			text: thought.title,
		});

		if (flags.isSelf) {
			row.createSpan({ cls: "ft-text-sm ft-text-faint", text: "(source)" });
		} else if (flags.isAlreadyMerged) {
			row.createSpan({ cls: "ft-text-sm ft-text-faint", text: "(already merged)" });
		} else if (flags.isInvalid) {
			row.createSpan({ cls: "ft-text-sm ft-text-faint", text: "(descendant)" });
		}

		if (!isDisabled) {
			row.addEventListener("click", () => this.deps.onSelect(thought.id));
		}
	}

	/**
	 * Compute the set of thought IDs that are invalid merge targets.
	 * Invalid = self + all descendants reachable from source via next/branch.
	 */
	private computeInvalidTargets(train: TrainState, sourceId: string): Set<string> {
		const invalid = new Set<string>([sourceId]);

		// Build adjacency for forward edges only
		const adj = new Map<string, string[]>();
		for (const r of train.relations) {
			if (r.direction === "next" || r.direction === "branch") {
				const list = adj.get(r.fromId) ?? [];
				list.push(r.toId);
				adj.set(r.fromId, list);
			}
		}

		// DFS from source
		const stack = [sourceId];
		while (stack.length > 0) {
			const current = stack.pop()!;
			for (const neighbor of adj.get(current) ?? []) {
				if (!invalid.has(neighbor)) {
					invalid.add(neighbor);
					stack.push(neighbor);
				}
			}
		}

		return invalid;
	}
}
