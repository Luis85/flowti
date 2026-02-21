/**
 * Event map for the Train of Thoughts domain.
 *
 * Events follow the `train.` prefix convention.
 */

import type { ThoughtNode, TrainState } from "./types";

export interface TrainEventMap {
	/** Emitted when a new train is started. */
	"train.started": { train: TrainState };
	/** Emitted when a thought is added to the train. */
	"train.thought.added": { trainId: string; thought: ThoughtNode; previousTitle: string | null };
	/** Emitted when the train is paused (user closed modal). */
	"train.paused": { trainId: string };
	/** Emitted when a paused train is resumed. */
	"train.resumed": { trainId: string };
}
