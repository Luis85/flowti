import { TaskKind, TaskSource } from "src/eventsystem/tasks/TaskFinishedEvent";
import { MessageAction } from "src/messages/types";

export type TaskOutcome = "success" | "partial" | "fail" | "crit_success" | "crit_fail";

export type TaskContext = {
	taskId: string;
	source: TaskSource;
	kind: TaskKind;
	action?: MessageAction;
	message?: {
		id: string;
		templateId?: string;
		subject?: string;
		type?: string;
		priority?: string;
		tags?: string[];
	};
	difficulty: number;
	baseXp: number;
	baseEnergyCost: number;
	baseTimeCostMin: number;
	skillKey: string;
};

export type ResolutionRecord = {
	id: string;
	taskId: string;
	createdAtIso: string;
	context: TaskContext;
	roll: {
		outcome: TaskOutcome;
		score: number;
		threshold: number;
		modifiers?: Array<{ key: string; value: number; note?: string }>;
	};
	rewards: { xp: number; energyCost: number; timeCostMin: number };
};

