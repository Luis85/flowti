import type { IEventBus } from "../../infrastructure/events/types";
import type { TrainService } from "../../domain/train/TrainService";

/** View type constants for Train of Thoughts views. */
export const VIEW_TYPE_TRAIN_MAIN = "flowti-train-main";
export const VIEW_TYPE_TRAIN_TIMELINE = "flowti-train-timeline";

/** Shared dependencies for Train panel components. */
export interface TrainPanelDeps {
	trainService: TrainService;
	eventBus: IEventBus;
	scheduleRender: () => void;
	/** Currently active thought ID — used to thread "Add Thought" from the right point. */
	getActiveThoughtId?: () => string | null;
}
