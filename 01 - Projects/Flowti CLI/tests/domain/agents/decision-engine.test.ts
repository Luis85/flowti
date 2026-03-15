import { describe, it, expect } from "vitest";
import { evaluateDecision, LLM_RULES, NPC_RULES } from "../../../src/domain/agents/decision-engine.js";
import type { DecisionRule } from "../../../src/domain/agents/worker-types.js";

describe("evaluateDecision", () => {
	it("matches task-assigned trigger to execute-task", () => {
		const result = evaluateDecision("task-assigned", LLM_RULES);
		expect(result).toBe("execute-task");
	});

	it("matches message-received to respond", () => {
		const result = evaluateDecision("message-received", LLM_RULES);
		expect(result).toBe("respond");
	});

	it("returns null when no rule matches", () => {
		const result = evaluateDecision("unknown-trigger", LLM_RULES);
		expect(result).toBeNull();
	});

	it("picks highest priority when multiple rules match", () => {
		const rules: DecisionRule[] = [
			{ trigger: "test", action: "low", priority: 1 },
			{ trigger: "test", action: "high", priority: 10 },
		];
		expect(evaluateDecision("test", rules)).toBe("high");
	});

	it("NPC rules return respond-from-state for messages", () => {
		const result = evaluateDecision("message-received", NPC_RULES);
		expect(result).toBe("respond-from-state");
	});

	it("NPC rules return acknowledge for tasks", () => {
		const result = evaluateDecision("task-assigned", NPC_RULES);
		expect(result).toBe("acknowledge");
	});
});
