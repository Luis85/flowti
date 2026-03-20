/**
 * needs-morale.ts — MDSL subtree for morale recovery.
 *
 * When morale is critically low, agent emotes and wanders sadly.
 */

export const NEEDS_MORALE_SUBTREE = `
root [NeedsMorale] {
	sequence {
		condition [IsMoraleLow]
		action [Emote]
		action [WanderSad]
	}
}
`.trim();
