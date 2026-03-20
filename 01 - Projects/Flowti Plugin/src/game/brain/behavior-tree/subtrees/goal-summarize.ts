/**
 * goal-summarize.ts — MDSL subtree for the "summarize" goal type.
 *
 * Exported as SUMMARIZE_SUBTREE for use by bt-factory when assembling the
 * full agent behavior tree.
 */

export const SUMMARIZE_SUBTREE = `
root [SummarizeGoal] {
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
