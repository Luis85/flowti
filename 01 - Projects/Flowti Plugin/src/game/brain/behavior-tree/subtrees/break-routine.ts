/**
 * break-routine.ts — BT subtree for break management.
 *
 * Replaces brain-system's updateOnBreak() autonomous transition.
 * When an agent has been working too long and energy is dropping,
 * commands a break: walk to rest spot, rest, then resume.
 */

export const BREAK_ROUTINE_SUBTREE = `
root [BreakRoutine] {
	sequence {
		condition [NeedsBreak]
		action [StartBreak]
	}
}
`.trim();
