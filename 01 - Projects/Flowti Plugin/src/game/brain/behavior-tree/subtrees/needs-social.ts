/**
 * needs-social.ts — MDSL subtree for social need satisfaction.
 *
 * When social is low, agent seeks a nearby agent to talk to.
 */

export const NEEDS_SOCIAL_SUBTREE = `
root [NeedsSocial] {
	sequence {
		condition [IsSocialLow]
		action [SeekNearbyAgent]
	}
}
`.trim();
