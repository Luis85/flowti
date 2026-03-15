import { describe, it, expect } from "vitest";

import {
	resolveTemplate,
	processStep,
	advanceProgress,
	parseStepFrontmatter,
} from "../../../src/domain/onboarding/tour-engine.js";

import type { Tour, TourProgress, NarrateStep, PromptStep, DelegateStep, AutoStep, CheckpointStep } from "../../../src/domain/onboarding/onboarding-types.js";

const makeTour = (steps: Tour["steps"]): Tour => ({
	id: "test-tour",
	name: "Test Tour",
	role: "tester",
	description: "A test tour",
	steps,
});

const makeProgress = (overrides?: Partial<TourProgress>): TourProgress => ({
	tourId: "test-tour",
	currentStepIndex: 0,
	completedSteps: [],
	context: {},
	startedAt: "2026-03-15T10:00:00.000Z",
	...overrides,
});

describe("resolveTemplate", () => {
	it("replaces {{token}} placeholders with context values", () => {
		const result = resolveTemplate(
			"Hello, **{{projectName}}**!",
			{ projectName: "Acme" },
		);
		expect(result).toBe("Hello, **Acme**!");
	});

	it("replaces multiple tokens", () => {
		const result = resolveTemplate(
			"{{projectName}} runs for {{durationDays}} days",
			{ projectName: "Acme", durationDays: "14" },
		);
		expect(result).toBe("Acme runs for 14 days");
	});

	it("leaves unknown tokens as-is", () => {
		const result = resolveTemplate("Hello, {{unknown}}!", {});
		expect(result).toBe("Hello, {{unknown}}!");
	});

	it("handles content with no tokens", () => {
		const result = resolveTemplate("No tokens here.", { foo: "bar" });
		expect(result).toBe("No tokens here.");
	});
});

describe("parseStepFrontmatter", () => {
	it("parses speaker and disposition from frontmatter", () => {
		const content = "---\nspeaker: Alice\ndisposition: strategic\n---\n\nHello!";
		const result = parseStepFrontmatter(content);
		expect(result.frontmatter).toEqual({ speaker: "Alice", disposition: "strategic" });
		expect(result.body).toBe("Hello!");
	});

	it("returns defaults when no frontmatter", () => {
		const content = "Just a body.";
		const result = parseStepFrontmatter(content);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("Just a body.");
	});
});

describe("processStep", () => {
	it("returns NarrateResult for narrate steps", () => {
		const step: NarrateStep = { id: "welcome", type: "narrate", content: "steps/01.md" };
		const progress = makeProgress();
		const rawContent = "---\nspeaker: Alice\ndisposition: strategic\n---\n\nWelcome!";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("narrate");
		if (result.kind === "narrate") {
			expect(result.content).toBe("Welcome!");
			expect(result.speaker).toBe("Alice");
			expect(result.disposition).toBe("strategic");
		}
	});

	it("returns PromptResult for prompt steps", () => {
		const step: PromptStep = {
			id: "name", type: "prompt", content: "steps/02.md",
			field: "projectName", validation: "non-empty",
		};
		const progress = makeProgress();
		const rawContent = "What is your project name?";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("prompt");
		if (result.kind === "prompt") {
			expect(result.field).toBe("projectName");
			expect(result.validation).toBe("non-empty");
		}
	});

	it("returns DelegateResult for delegate steps", () => {
		const step: DelegateStep = {
			id: "scope", type: "delegate", content: "steps/10.md",
			target: "iteration-planning", hints: "hints/ip.md",
		};
		const progress = makeProgress({ tourId: "pm" });
		const rawContent = "Add your scope items.";
		const hintsContent = "Tip: keep items small.";
		const result = processStep(step, progress, rawContent, hintsContent);
		expect(result.kind).toBe("delegate");
		if (result.kind === "delegate") {
			expect(result.target).toBe("iteration-planning");
			expect(result.tourId).toBe("pm");
			expect(result.stepId).toBe("scope");
			expect(result.hintsContent).toBe("Tip: keep items small.");
		}
	});

	it("returns AutoResult for auto steps", () => {
		const step: AutoStep = {
			id: "scaffold", type: "auto", content: "steps/05.md",
			action: "project:scaffold",
		};
		const progress = makeProgress({ context: { projectName: "Acme" } });
		const rawContent = "Creating **{{projectName}}**...";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("auto");
		if (result.kind === "auto") {
			expect(result.action).toBe("project:scaffold");
			expect(result.content).toBe("Creating **Acme**...");
		}
	});

	it("returns CheckpointResult for checkpoint steps", () => {
		const step: CheckpointStep = {
			id: "done", type: "checkpoint", content: "steps/06.md",
			label: "Project created",
		};
		const progress = makeProgress({ completedSteps: ["welcome"] });
		const rawContent = "Project created!";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("checkpoint");
		if (result.kind === "checkpoint") {
			expect(result.label).toBe("Project created");
			expect(result.completedSteps).toContain("welcome");
			expect(result.completedSteps).toContain("done");
		}
	});
});

describe("advanceProgress", () => {
	it("increments step index", () => {
		const progress = makeProgress({ currentStepIndex: 0 });
		const result = advanceProgress(progress, "welcome");
		expect(result.currentStepIndex).toBe(1);
		expect(result.completedSteps).toContain("welcome");
	});

	it("adds context values from prompt", () => {
		const progress = makeProgress({ currentStepIndex: 1 });
		const result = advanceProgress(progress, "name", { projectName: "Acme" });
		expect(result.context.projectName).toBe("Acme");
	});

	it("preserves existing context", () => {
		const progress = makeProgress({
			currentStepIndex: 2,
			context: { projectName: "Acme" },
		});
		const result = advanceProgress(progress, "goal", { iterationGoal: "Ship MVP" });
		expect(result.context.projectName).toBe("Acme");
		expect(result.context.iterationGoal).toBe("Ship MVP");
	});

	it("returns progress past last step when advancing from final step", () => {
		const progress = makeProgress({ currentStepIndex: 0 });
		const advanced = advanceProgress(progress, "only");
		expect(advanced.currentStepIndex).toBe(1);
	});
});
