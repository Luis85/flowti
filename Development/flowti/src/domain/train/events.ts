/**
 * Event map for the Train of Thoughts domain.
 *
 * Events follow the `train.` prefix convention.
 */

import type { BranchStatus, ThoughtDirection, ThoughtNode, TrainState } from "./types";

export interface TrainEventMap {
	/** Emitted when a new train is started. */
	"train.started": { train: TrainState };
	/** Emitted when a thought is added to the train. */
	"train.thought.added": { trainId: string; thought: ThoughtNode; previousTitle: string | null; direction: ThoughtDirection };
	/** Emitted when the train is paused (user closed modal). */
	"train.paused": { trainId: string };
	/** Emitted when a paused train is resumed. */
	"train.resumed": { trainId: string };
	/** Emitted when a train is completed (user is done capturing). */
	"train.completed": { trainId: string; thoughtCount: number };
	/** Emitted when a thought is activated (navigated to) in a view. */
	"train.thought.activated": { trainId: string; thoughtId: string };
	/** Emitted when a branch is merged into a target thought. */
	"train.branch.merged": { trainId: string; sourceId: string; targetId: string };
	/** Emitted when a branch merge is undone. */
	"train.branch.merge.undone": { trainId: string; sourceId: string; targetId: string };
	/** Emitted when a train canvas file is created for the first time. */
	"train.canvas.created": { trainId: string; canvasPath: string };
	/** Emitted when a train canvas is synced (regenerated from graph state). */
	"train.canvas.synced": { trainId: string; canvasPath: string; nodeCount: number };
	/** Emitted when a canvas sync corrected a node count mismatch (reconciliation). */
	"train.canvas.reconciled": { trainId: string; expected: number; found: number; corrected: boolean };
	/** Emitted when a train summary document was generated on completion. */
	"train.summary.created": { trainId: string; summaryPath: string };
	/** Emitted when a thought is renamed (title + vault note path). */
	"train.thought.renamed": { trainId: string; thoughtId: string; oldTitle: string; newTitle: string; oldPath: string; newPath: string };
	/** Emitted when a train is renamed. */
	"train.renamed": { trainId: string; oldTitle: string; newTitle: string; oldFolder?: string; newFolder?: string };
	/** Emitted when a train is deleted from history. */
	"train.deleted": { trainId: string; title: string };
	/** Emitted when a branch status label is changed. */
	"train.branch.status.changed": { trainId: string; thoughtId: string; status: BranchStatus | null };
}
