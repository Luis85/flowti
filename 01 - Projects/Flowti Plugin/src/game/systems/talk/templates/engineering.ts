/**
 * engineering.ts — Engineering, quality, and operations domain templates.
 *
 * Rich, contextual phrases that sound like real engineers, QA leads,
 * and ops people thinking aloud. Includes waiting-state phrases for
 * when the agent is actively processing a request.
 */

import type { TemplateSet } from "../talk-types.js";

export const engineeringTemplates: TemplateSet = {
	domain: "engineering",
	categories: {
		thinking: [
			{ template: "This could use some refactoring... the abstraction isn't quite right", weight: 2, category: "thinking" },
			{ template: "Let me trace this logic path, there's something subtle here", weight: 2, category: "thinking" },
			{ template: "That edge case is going to bite someone eventually", weight: 2, category: "thinking" },
			{ template: "Clean architecture matters — this coupling needs to go", weight: 1, category: "thinking" },
			{ template: "Interesting pattern here, I've seen this work well before", weight: 2, category: "thinking" },
			{ template: "The type system is telling us something about this design", weight: 1, category: "thinking" },
			{ template: "Simplify, simplify... YAGNI", weight: 1, category: "thinking" },
			{ template: "I wonder if we could use composition instead of inheritance here", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Tests are green! Time to push", weight: 2, category: "personality" },
			{ template: "The build looks clean, no warnings", weight: 2, category: "personality" },
			{ template: "Ship it! Well, after code review obviously", weight: 1, category: "personality" },
			{ template: "That PR needs a review, let me take a look", weight: 2, category: "personality" },
			{ template: "Docs need updating — the API changed", weight: 1, category: "personality" },
			{ template: "Performance numbers are looking solid", weight: 1, category: "personality" },
			{ template: "Finally cracked that bug. It was a race condition, naturally", weight: 1, category: "personality" },
		],
		waiting: [
			{ template: "Analyzing the codebase for the best approach...", weight: 2, category: "waiting" },
			{ template: "Checking for side effects before I suggest anything...", weight: 2, category: "waiting" },
			{ template: "Let me review the test coverage implications...", weight: 2, category: "waiting" },
			{ template: "Tracing the dependency graph... almost there", weight: 2, category: "waiting" },
			{ template: "Running through the edge cases in my head", weight: 1, category: "waiting" },
			{ template: "Considering backward compatibility...", weight: 1, category: "waiting" },
			{ template: "This is a satisfying problem, give me a sec", weight: 1, category: "waiting" },
		],
	},
};

export const qualityTemplates: TemplateSet = {
	domain: "quality",
	categories: {
		thinking: [
			{ template: "Found an edge case that nobody tested for...", weight: 2, category: "thinking" },
			{ template: "This definitely needs a regression test", weight: 2, category: "thinking" },
			{ template: "Coverage is improving, but that branch is still uncovered", weight: 1, category: "thinking" },
			{ template: "The happy path works, but what about errors?", weight: 2, category: "thinking" },
			{ template: "Boundary conditions are where bugs hide", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Full regression suite passed, confidence is high", weight: 2, category: "personality" },
			{ template: "Load test results are in — we're within threshold", weight: 2, category: "personality" },
			{ template: "Bug triage complete, three high-priority items flagged", weight: 1, category: "personality" },
			{ template: "Smoke tests look good across all environments", weight: 2, category: "personality" },
			{ template: "Quality gates are green. Ship when ready", weight: 2, category: "personality" },
		],
		waiting: [
			{ template: "Running the validation checks now...", weight: 2, category: "waiting" },
			{ template: "Cross-referencing with our test matrix...", weight: 2, category: "waiting" },
			{ template: "Checking compliance requirements... almost done", weight: 1, category: "waiting" },
			{ template: "Reviewing the acceptance criteria carefully", weight: 2, category: "waiting" },
		],
	},
};

export const operationsTemplates: TemplateSet = {
	domain: "operations",
	categories: {
		thinking: [
			{ template: "Alert thresholds might need adjusting after that deploy", weight: 2, category: "thinking" },
			{ template: "There's a cost optimization opportunity in the scaling config", weight: 1, category: "thinking" },
			{ template: "Infrastructure as code keeps us honest", weight: 1, category: "thinking" },
			{ template: "That latency spike was interesting... investigating", weight: 2, category: "thinking" },
		],
		progress: [
			{ template: "All systems running smoothly, green across the board", weight: 2, category: "personality" },
			{ template: "Deployment pipeline is green, zero rollbacks this sprint", weight: 2, category: "personality" },
			{ template: "Monitoring dashboard updated with the new metrics", weight: 1, category: "personality" },
			{ template: "Backups verified and tested. Sleep well tonight", weight: 2, category: "personality" },
			{ template: "P99 latency looking excellent", weight: 2, category: "personality" },
		],
		waiting: [
			{ template: "Checking the infrastructure state...", weight: 2, category: "waiting" },
			{ template: "Pulling the latest metrics for context...", weight: 2, category: "waiting" },
			{ template: "Cross-checking with the runbook...", weight: 1, category: "waiting" },
			{ template: "Reviewing deployment history for patterns", weight: 1, category: "waiting" },
		],
	},
};
