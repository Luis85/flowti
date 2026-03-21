/**
 * urgent.ts — MDSL subtree for urgent event reaction (Phase 1 stub).
 *
 * When a pending sensor event is present, the agent handles it and speaks.
 * Full sensor integration is a Phase 2 prerequisite.
 * Exported as URGENT_SUBTREE for use by bt-factory.
 */

export const URGENT_SUBTREE = `
root [UrgentReaction] {
	sequence {
		condition [HasPendingEvent]
		action [HandleEvent]
		action [SpeakBubble]
	}
}
`.trim();
