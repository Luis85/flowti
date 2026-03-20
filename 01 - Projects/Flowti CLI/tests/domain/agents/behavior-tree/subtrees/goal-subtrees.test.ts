import { describe, it, expect } from "vitest";
import { REVIEW_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-review.js";
import { SUMMARIZE_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-summarize.js";
import { PLAN_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-plan.js";
import { IMPLEMENT_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-implement.js";
import { MONITOR_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-monitor.js";
import { REPORT_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-report.js";

describe("goal subtrees", () => {
	describe("REVIEW_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof REVIEW_SUBTREE).toBe("string");
			expect(REVIEW_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named ReviewGoal", () => {
			expect(REVIEW_SUBTREE).toContain("root [ReviewGoal]");
		});

		it("contains expected actions", () => {
			expect(REVIEW_SUBTREE).toContain("action [PickGoalFile]");
			expect(REVIEW_SUBTREE).toContain("action [ReadFile]");
			expect(REVIEW_SUBTREE).toContain("condition [HasLLMProvider]");
			expect(REVIEW_SUBTREE).toContain("action [QueryLLM]");
			expect(REVIEW_SUBTREE).toContain("action [GenerateFromTemplate]");
			expect(REVIEW_SUBTREE).toContain("action [WriteFile]");
			expect(REVIEW_SUBTREE).toContain("action [DropArtifact]");
			expect(REVIEW_SUBTREE).toContain("action [SpeakBubble]");
		});
	});

	describe("SUMMARIZE_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof SUMMARIZE_SUBTREE).toBe("string");
			expect(SUMMARIZE_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named SummarizeGoal", () => {
			expect(SUMMARIZE_SUBTREE).toContain("root [SummarizeGoal]");
		});

		it("contains expected actions", () => {
			expect(SUMMARIZE_SUBTREE).toContain("action [PickGoalFile]");
			expect(SUMMARIZE_SUBTREE).toContain("action [ReadFile]");
			expect(SUMMARIZE_SUBTREE).toContain("condition [HasLLMProvider]");
			expect(SUMMARIZE_SUBTREE).toContain("action [QueryLLM]");
			expect(SUMMARIZE_SUBTREE).toContain("action [GenerateFromTemplate]");
			expect(SUMMARIZE_SUBTREE).toContain("action [WriteFile]");
			expect(SUMMARIZE_SUBTREE).toContain("action [DropArtifact]");
			expect(SUMMARIZE_SUBTREE).toContain("action [SpeakBubble]");
		});
	});

	describe("PLAN_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof PLAN_SUBTREE).toBe("string");
			expect(PLAN_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named PlanGoal", () => {
			expect(PLAN_SUBTREE).toContain("root [PlanGoal]");
		});

		it("contains expected actions", () => {
			expect(PLAN_SUBTREE).toContain("action [PickGoalFile]");
			expect(PLAN_SUBTREE).toContain("action [ReadFile]");
			expect(PLAN_SUBTREE).toContain("condition [HasLLMProvider]");
			expect(PLAN_SUBTREE).toContain("action [QueryLLM]");
			expect(PLAN_SUBTREE).toContain("action [GenerateFromTemplate]");
			expect(PLAN_SUBTREE).toContain("action [WriteFile]");
			expect(PLAN_SUBTREE).toContain("action [DropArtifact]");
			expect(PLAN_SUBTREE).toContain("action [SpeakBubble]");
		});
	});

	describe("IMPLEMENT_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof IMPLEMENT_SUBTREE).toBe("string");
			expect(IMPLEMENT_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named ImplementGoal", () => {
			expect(IMPLEMENT_SUBTREE).toContain("root [ImplementGoal]");
		});

		it("contains expected actions", () => {
			expect(IMPLEMENT_SUBTREE).toContain("action [PickGoalFile]");
			expect(IMPLEMENT_SUBTREE).toContain("action [ReadFile]");
			expect(IMPLEMENT_SUBTREE).toContain("condition [HasLLMProvider]");
			expect(IMPLEMENT_SUBTREE).toContain("action [QueryLLM]");
			expect(IMPLEMENT_SUBTREE).toContain("action [GenerateFromTemplate]");
			expect(IMPLEMENT_SUBTREE).toContain("action [WriteFile]");
			expect(IMPLEMENT_SUBTREE).toContain("action [DropArtifact]");
			expect(IMPLEMENT_SUBTREE).toContain("action [SpeakBubble]");
		});
	});

	describe("MONITOR_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof MONITOR_SUBTREE).toBe("string");
			expect(MONITOR_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named MonitorGoal", () => {
			expect(MONITOR_SUBTREE).toContain("root [MonitorGoal]");
		});

		it("contains expected actions", () => {
			expect(MONITOR_SUBTREE).toContain("action [PickGoalFile]");
			expect(MONITOR_SUBTREE).toContain("action [ReadFile]");
			expect(MONITOR_SUBTREE).toContain("condition [HasLLMProvider]");
			expect(MONITOR_SUBTREE).toContain("action [QueryLLM]");
			expect(MONITOR_SUBTREE).toContain("action [GenerateFromTemplate]");
			expect(MONITOR_SUBTREE).toContain("action [SpeakBubble]");
		});

		it("does NOT contain WriteFile", () => {
			expect(MONITOR_SUBTREE).not.toContain("action [WriteFile]");
		});

		it("does NOT contain DropArtifact", () => {
			expect(MONITOR_SUBTREE).not.toContain("action [DropArtifact]");
		});
	});

	describe("REPORT_SUBTREE", () => {
		it("is a non-empty string", () => {
			expect(typeof REPORT_SUBTREE).toBe("string");
			expect(REPORT_SUBTREE.length).toBeGreaterThan(0);
		});

		it("has root node named ReportGoal", () => {
			expect(REPORT_SUBTREE).toContain("root [ReportGoal]");
		});

		it("contains expected actions", () => {
			expect(REPORT_SUBTREE).toContain("action [PickGoalFile]");
			expect(REPORT_SUBTREE).toContain("action [ReadFile]");
			expect(REPORT_SUBTREE).toContain("condition [HasLLMProvider]");
			expect(REPORT_SUBTREE).toContain("action [QueryLLM]");
			expect(REPORT_SUBTREE).toContain("action [GenerateFromTemplate]");
			expect(REPORT_SUBTREE).toContain("action [WriteFile]");
			expect(REPORT_SUBTREE).toContain("action [DropArtifact]");
			expect(REPORT_SUBTREE).toContain("action [SpeakBubble]");
		});
	});
});
