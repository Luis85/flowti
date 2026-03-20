/**
 * idle.ts — MDSL subtree for idle behavior.
 *
 * Agents with no active goal wander, emote, or chatter (randomly weighted).
 * Exported as IDLE_SUBTREE for use by bt-factory.
 */

export const IDLE_SUBTREE = `
root [IdleBehavior] {
	lotto [1,1,1] {
		action [Wander]
		action [Emote]
		action [Chatter]
	}
}
`.trim();
