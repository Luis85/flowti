import type { TaskStatus } from "./task-types.js";

export const VALID_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
	"proposed": ["pending"],
	"pending": ["assigned"],
	"assigned": ["in-progress"],
	"in-progress": ["review", "completed", "failed"],
	"review": ["completed", "pending"],
	"completed": [],
	"failed": ["pending"],
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
	return VALID_TRANSITIONS[from].includes(to);
}

export function transition(from: TaskStatus, to: TaskStatus): TaskStatus | null {
	return canTransition(from, to) ? to : null;
}
