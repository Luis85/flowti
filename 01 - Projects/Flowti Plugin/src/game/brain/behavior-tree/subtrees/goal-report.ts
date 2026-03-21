/**
 * goal-report.ts — MDSL subtree for the "report" goal type.
 *
 * Exported as REPORT_SUBTREE for use by bt-factory when assembling the
 * full agent behavior tree.
 */

export const REPORT_SUBTREE = `
root [ReportGoal] {
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
