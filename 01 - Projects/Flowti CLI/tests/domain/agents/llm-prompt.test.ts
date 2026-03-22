import { describe, it, expect } from "vitest";
import { formatPrompt, shouldRequestJson, isPreFormatted } from "../../../src/domain/agents/llm-prompt.js";
import type { PromptEnvelope, ProviderCapabilities } from "../../../src/domain/agents/llm-types.js";

const FULL_CAPS: ProviderCapabilities = { streaming: true, thinking: true, toolUse: true, structuredOutput: true, persistentSession: false };
const NO_STRUCTURED: ProviderCapabilities = { streaming: true, thinking: false, toolUse: false, structuredOutput: false, persistentSession: false };

describe("isPreFormatted", () => {
	it("returns true when only message is set", () => {
		expect(isPreFormatted({ message: "hello" })).toBe(true);
	});

	it("returns false when system is set", () => {
		expect(isPreFormatted({ message: "hello", system: "be helpful" })).toBe(false);
	});

	it("returns false when identity is set", () => {
		expect(isPreFormatted({ message: "hello", identity: { name: "Bob" } })).toBe(false);
	});

	it("returns false when history is set", () => {
		expect(isPreFormatted({ message: "hello", history: [{ role: "user", content: "hi" }] })).toBe(false);
	});
});

describe("shouldRequestJson", () => {
	it("returns true for json hint with structuredOutput", () => {
		expect(shouldRequestJson("json", FULL_CAPS)).toBe(true);
	});

	it("returns false for json hint without structuredOutput", () => {
		expect(shouldRequestJson("json", NO_STRUCTURED)).toBe(false);
	});

	it("returns false for text hint regardless", () => {
		expect(shouldRequestJson("text", FULL_CAPS)).toBe(false);
	});

	it("returns true for auto hint with structuredOutput", () => {
		expect(shouldRequestJson("auto", FULL_CAPS)).toBe(true);
	});

	it("returns true for undefined hint with structuredOutput", () => {
		expect(shouldRequestJson(undefined, FULL_CAPS)).toBe(true);
	});

	it("returns false for undefined hint without structuredOutput", () => {
		expect(shouldRequestJson(undefined, NO_STRUCTURED)).toBe(false);
	});
});

describe("formatPrompt", () => {
	it("includes system instructions when present", () => {
		const envelope: PromptEnvelope = { message: "hello", system: "Be a pirate" };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("# System Instructions");
		expect(result).toContain("Be a pirate");
	});

	it("includes identity block", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Atlas", persona: "Alice" } };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("Alice (Atlas)");
	});

	it("includes JSON response format when structuredOutput is true", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("You MUST respond with a single JSON object");
	});

	it("omits JSON response format when structuredOutput is false", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, NO_STRUCTURED);
		expect(result).not.toContain("You MUST respond with a single JSON object");
	});

	it("includes conversation history", () => {
		const envelope: PromptEnvelope = {
			message: "what next?",
			identity: { name: "Bot" },
			history: [
				{ role: "user", content: "start" },
				{ role: "agent", content: "ok" },
			],
		};
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("# Conversation So Far");
		expect(result).toContain("**User:** start");
		expect(result).toContain("**Bot:** ok");
	});

	it("includes task context for clarification flows", () => {
		const envelope: PromptEnvelope = {
			message: "clarify",
			taskContext: { taskName: "Fix bug", taskDescription: "Broken login", context: "Sprint 5" },
		};
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("Fix bug");
		expect(result).toContain("Broken login");
		expect(result).toContain("Sprint 5");
	});

	it("includes user message at the end", () => {
		const envelope: PromptEnvelope = { message: "do the thing", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, FULL_CAPS);
		expect(result).toContain("**User:** do the thing");
	});

	it("uses text closing when no structuredOutput", () => {
		const envelope: PromptEnvelope = { message: "hello", identity: { name: "Bot" } };
		const result = formatPrompt(envelope, NO_STRUCTURED);
		expect(result).toContain("Respond as Bot:");
		expect(result).not.toContain("JSON format above");
	});
});
