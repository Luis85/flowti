/**
 * goal-plan.ts — MDSL subtree for the "plan" goal type.
 *
 * Exported as PLAN_SUBTREE for use by bt-factory when assembling the
 * full agent behavior tree.
 */

export const PLAN_SUBTREE = `
root [PlanGoal] {
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
