/**
 * bt-prompt.ts — LLM prompt assembly for BT agents.
 *
 * Scales prompt richness with INT attribute.
 * Domain-layer pure.
 */

import type { BTAgentContext } from "./bt-types.js";

function goalTypeInstruction(goalType: string): string {
	switch (goalType) {
		case "review": return "Assess the document and provide recommendations. Note strengths, weaknesses, and action items.";
		case "summarize": return "Provide a concise summary. Extract key points and organize clearly.";
		case "plan": return "Generate actionable steps. Create a prioritized checklist with clear owners and deadlines.";
		case "implement": return "Propose code or content changes. Be specific about what to add, modify, or remove.";
		case "monitor": return "Check current status. Report any changes, anomalies, or items needing attention.";
		case "report": return "Aggregate information into a structured report. Include metadata, findings, and recommendations.";
		default: return "Analyze and respond appropriately.";
	}
}

export function assemblePrompt(ctx: BTAgentContext, goalType: string, int_: number): string {
	let prompt = `You are ${ctx.persona ?? ctx.name}, a ${ctx.domain ?? "general"} specialist.\n`;
	prompt += `Goal: ${goalType} — ${ctx.activeGoal?.name ?? "general task"}\n`;
	prompt += `File: ${ctx.activeGoalFile ?? "none"}\n\n`;

	if (ctx.lastFileContent) {
		prompt += ctx.lastFileContent + "\n\n";
	}

	prompt += goalTypeInstruction(goalType);

	if (int_ >= 14) {
		prompt += "\n\nAdditional context: Include related files and project health summary in your analysis.";
	}
	if (int_ >= 18) {
		prompt += "\nCross-reference other agents' recent artifacts and historical goal outcomes.";
	}

	return prompt;
}
