import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", GREEN: "", CYAN: "", BOLD: "" }));

import { respondFromState, buildTaskPrompt, buildResponsePrompt } from "../../../src/domain/agents/action-handlers.js";

describe("respondFromState", () => {
	it("returns agent status and task info", () => {
		const components = { status: { state: "idle" }, tasks: { items: [] }, identity: { persona: "Bobby" } };
		const result = respondFromState("Bob", components);
		expect(result).toContain("Bobby");
		expect(result).toContain("idle");
	});

	it("includes pending tasks", () => {
		const components = { status: { state: "busy" }, tasks: { items: [{ name: "Fix bug", status: "pending" }] } };
		const result = respondFromState("Bob", components);
		expect(result).toContain("Fix bug");
	});

	it("falls back to agent name when no persona", () => {
		const components = { status: { state: "idle" }, tasks: { items: [] } };
		const result = respondFromState("Bob", components);
		expect(result).toContain("Bob");
	});

	it("reports no pending tasks when all done", () => {
		const components = { status: { state: "idle" }, tasks: { items: [{ name: "Old task", status: "done" }] } };
		const result = respondFromState("Bob", components);
		expect(result).toContain("no pending tasks");
	});

	it("pluralizes tasks correctly", () => {
		const components = {
			status: { state: "busy" },
			tasks: { items: [{ name: "A", status: "pending" }, { name: "B", status: "in-progress" }] },
		};
		const result = respondFromState("Bob", components);
		expect(result).toContain("2 tasks");
	});
});

describe("buildTaskPrompt", () => {
	it("includes task name in prompt", () => {
		const prompt = buildTaskPrompt("Bob", "Fix the login bug", null, undefined);
		expect(prompt).toContain("Fix the login bug");
	});

	it("includes system prompt when provided", () => {
		const prompt = buildTaskPrompt("Bob", "Fix bug", "You are a developer.", undefined);
		expect(prompt).toContain("You are a developer.");
	});

	it("includes agent name in prompt", () => {
		const prompt = buildTaskPrompt("Bob", "Do something", null, undefined);
		expect(prompt).toContain("Bob");
	});
});

describe("buildResponsePrompt", () => {
	it("includes message in prompt", () => {
		const prompt = buildResponsePrompt("Bob", "What is TypeScript?", null, undefined, []);
		expect(prompt).toContain("What is TypeScript?");
	});

	it("includes conversation history", () => {
		const history = [{ role: "user" as const, content: "Hi" }, { role: "agent" as const, content: "Hello!" }];
		const prompt = buildResponsePrompt("Bob", "How are you?", null, undefined, history);
		expect(prompt).toContain("Hi");
		expect(prompt).toContain("Hello!");
	});

	it("includes system prompt when provided", () => {
		const prompt = buildResponsePrompt("Bob", "Hello", "Be concise.", undefined, []);
		expect(prompt).toContain("Be concise.");
	});
});
