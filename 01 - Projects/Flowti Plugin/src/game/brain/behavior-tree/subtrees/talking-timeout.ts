/**
 * talking-timeout.ts — BT subtree for conversation timeout.
 *
 * Replaces brain-system's talking/waiting timeout (10s → idle).
 * When an agent has been in talking intent too long, resets to idle.
 */

export const TALKING_TIMEOUT_SUBTREE = `
root [TalkingTimeout] {
	sequence {
		condition [IsTalkingTooLong]
		action [StopTalking]
	}
}
`.trim();
