/**
 * goal-monitor.ts — MDSL subtree for the "monitor" goal type.
 *
 * Monitor does not write files or drop artifacts — it observes and speaks.
 * Exported as MONITOR_SUBTREE for use by bt-factory when assembling the
 * full agent behavior tree.
 */

export const MONITOR_SUBTREE = `
root [MonitorGoal] {
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
		action [SpeakBubble]
	}
}
`.trim();
