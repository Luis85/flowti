/**
 * Train Breadcrumb Panel — shows the path from root to the active thought.
 *
 * Each segment is clickable and navigates to that thought via train.thought.activated.
 */

import type { ThoughtNode, TrainState } from "../../domain/train/types";
import type { TrainPanelDeps } from "./types";

export class TrainBreadcrumbPanel {
	constructor(
		private el: HTMLElement,
		private deps: TrainPanelDeps,
	) {}

	render(train: TrainState, activeThought: ThoughtNode | null): void {
		this.el.empty();

		if (!activeThought) return;

		this.el.createEl("h4", { cls: "ft-heading-sm ft-text-muted", text: "Path" });
		const breadcrumb = this.el.createDiv({ cls: "ft-train-breadcrumb" });
		const path = this.buildPathToRoot(train, activeThought);

		for (let i = 0; i < path.length; i++) {
			const thought = path[i];
			const isFirst = i === 0;
			const isLast = i === path.length - 1;

			const row = breadcrumb.createDiv({
				cls: isLast
					? "ft-train-breadcrumb-row ft-train-breadcrumb-active"
					: "ft-train-breadcrumb-row",
			});

			// Step number or start indicator
			const marker = row.createSpan({ cls: "ft-train-breadcrumb-marker ft-text-muted" });
			marker.setText(isFirst ? "Start" : `${i + 1}`);

			const segment = row.createSpan({
				cls: "ft-train-breadcrumb-segment",
				text: thought.title,
			});

			if (!isLast) {
				segment.addEventListener("click", () => {
					void this.deps.eventBus.emit("train.thought.activated", {
						trainId: train.id,
						thoughtId: thought.id,
					});
				});
			}
		}
	}

	/** Walk from the active thought back to the root via relations. */
	private buildPathToRoot(train: TrainState, target: ThoughtNode): ThoughtNode[] {
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));

		// Build reverse lookup: toId → fromId for all relations
		const parentMap = new Map<string, string>();
		for (const rel of train.relations) {
			parentMap.set(rel.toId, rel.fromId);
		}

		// Walk backwards from target to root
		const path: ThoughtNode[] = [target];
		let currentId = target.id;
		const visited = new Set<string>([currentId]);

		while (parentMap.has(currentId)) {
			const parentId = parentMap.get(currentId)!;
			if (visited.has(parentId)) break; // Cycle protection
			visited.add(parentId);
			const parent = thoughtById.get(parentId);
			if (parent) {
				path.unshift(parent);
			}
			currentId = parentId;
		}

		return path;
	}
}
