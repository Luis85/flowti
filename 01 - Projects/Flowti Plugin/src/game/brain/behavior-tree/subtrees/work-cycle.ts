/**
 * work-cycle.ts — MDSL subtree for goal-driven work cycle.
 *
 * When agent has work goals and sufficient energy/focus, picks a goal,
 * goes to a workstation, works, then leaves.
 */

export const WORK_CYCLE_SUBTREE = `
root [WorkCycle] {
	sequence {
		condition [HasWorkGoal]
		action [PickGoal]
		action [GoToWorkstation]
		action [DoWork]
		action [LeaveWorkstation]
		action [SpeakBubble]
	}
}
`.trim();
