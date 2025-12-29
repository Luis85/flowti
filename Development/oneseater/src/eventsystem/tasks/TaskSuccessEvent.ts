import { TaskOutcome } from "src/models/Task";

export class TaskSuccessEvent {
	type: "task:success";
	taskId: string;
	resolutionId: string;
	finishedAtIso: string;
	outcome: TaskOutcome;
	xpGranted: number;
	energyCost: number;
	timeCostMin: number;
}
