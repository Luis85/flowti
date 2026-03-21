/**
 * goal-implement.ts — MDSL subtree for the "implement" goal type.
 *
 * Exported as IMPLEMENT_SUBTREE for use by bt-factory when assembling the
 * full agent behavior tree.
 */

export const IMPLEMENT_SUBTREE = `
root [ImplementGoal] {
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
