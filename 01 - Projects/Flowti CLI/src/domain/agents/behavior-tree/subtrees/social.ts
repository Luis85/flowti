/**
 * social.ts — MDSL subtree for social interaction behavior.
 *
 * When a nearby agent is detected, the agent socializes and speaks.
 * Exported as SOCIAL_SUBTREE for use by bt-factory.
 */

export const SOCIAL_SUBTREE = `
root [SocialBehavior] {
	sequence {
		condition [HasNearbyAgent]
		action [Socialize]
		action [SpeakBubble]
	}
}
`.trim();
