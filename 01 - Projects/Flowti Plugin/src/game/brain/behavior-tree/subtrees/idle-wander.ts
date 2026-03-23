/**
 * idle-wander.ts — BT subtree for idle wandering behavior.
 *
 * When the agent has been idle long enough (personality-driven threshold),
 * commands a wander. The LocomotionSystem handles the actual movement.
 */

export const IDLE_WANDER_SUBTREE = `
root [IdleWander] {
	sequence {
		condition [IsIdleLongEnough]
		action [CommandWander]
	}
}
`.trim();
