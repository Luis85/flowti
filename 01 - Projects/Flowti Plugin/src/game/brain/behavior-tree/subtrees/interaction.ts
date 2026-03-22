/**
 * interaction.ts — MDSL subtree for interaction intent behavior.
 *
 * When no active interaction exists and a nearby entity is detected,
 * the agent evaluates and submits an interaction from the registry.
 * Exported as INTERACTION_SUBTREE for use by bt-factory.
 */

export const INTERACTION_SUBTREE = `
root [InteractionIntent] {
	sequence {
		condition [NotInInteraction]
		condition [HasNearbyEntity]
		action [EvaluateInteraction]
		action [SubmitInteraction]
	}
}
`.trim();
