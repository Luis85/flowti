import { describe, expect, it } from "vitest";
import { extractTextFromUnknownJson, rawTextFromCliEvent } from "../../../src/game/data/cli-event-text.js";
import type { CliEvent } from "../../../src/infrastructure/agents/cli-executor.js";

describe("rawTextFromCliEvent", () => {
	it("uses text then response", () => {
		expect(rawTextFromCliEvent({ ts: 1, type: "response", agent: "A", text: "hi" } as CliEvent)).toBe("hi");
		expect(rawTextFromCliEvent({ ts: 1, type: "response", agent: "A", response: "there" } as CliEvent)).toBe("there");
	});

	it("reads OpenAI-style choices[0].message.content", () => {
		const ev = {
			ts: 1,
			type: "response",
			agent: "A",
			choices: [{ message: { content: "Hello" } }],
		} as unknown as CliEvent;
		expect(rawTextFromCliEvent(ev)).toBe("Hello");
	});

	it("reads Anthropic-style content blocks", () => {
		const ev = {
			ts: 1,
			type: "response",
			agent: "A",
			content: [{ type: "text", text: "Yo" }],
		} as unknown as CliEvent;
		expect(rawTextFromCliEvent(ev)).toContain("Yo");
	});
});

describe("extractTextFromUnknownJson", () => {
	it("handles string", () => {
		expect(extractTextFromUnknownJson("x")).toBe("x");
	});
});
