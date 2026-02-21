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

		const breadcrumb = this.el.createDiv({ cls: "ft-train-breadcrumb" });
		const path = this.buildPathToRoot(train, activeThought);

		for (let i = 0; i < path.length; i++) {
			const thought = path[i];
			const isLast = i === path.length - 1;

			const segment = breadcrumb.createSpan({
				cls: isLast ? "ft-train-breadcrumb-segment ft-train-breadcrumb-active" : "ft-train-breadcrumb-segment",
				text: thought.title,
			});

			if (!isLast) {
				segment.addEventListener("click", () => {
					void this.deps.eventBus.emit("train.thought.activated", {
						trainId: train.id,
						thoughtId: thought.id,
					});
				});
				breadcrumb.createSpan({ cls: "ft-train-breadcrumb-sep", text: " › " });
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
