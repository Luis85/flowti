/**
 * goal-review.ts — MDSL subtree for the "review" goal type.
 *
 * Exported as REVIEW_SUBTREE for use by bt-factory when assembling the
 * full agent behavior tree.
 */

export const REVIEW_SUBTREE = `
root [ReviewGoal] {
	sequence {
		action [PickGoalFile]
		action [ReadFile]
		selector {
			sequence {
				condition [HasLLMProvider]
				action [QueryLLM]
			}
			action [GenerateFromTemplate]
		}
		action [WriteFile]
		action [DropArtifact]
		action [SpeakBubble]
	}
}
`.trim();
