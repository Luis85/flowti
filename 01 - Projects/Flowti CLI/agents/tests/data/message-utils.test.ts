import { describe, it, expect } from "vitest";
import { extractAgentMessage } from "../../src/data/message-utils.js";

describe("extractAgentMessage", () => {
	it("extracts message from JSON object", () => {
		const raw = '{"message": "Hello!", "status": "message"}';
		expect(extractAgentMessage(raw)).toBe("Hello!");
	});

	it("strips markdown code fences", () => {
		const raw = '```json\n{"message": "Hi", "status": "message"}\n```';
		expect(extractAgentMessage(raw)).toBe("Hi");
	});

	it("returns raw text if not JSON", () => {
		expect(extractAgentMessage("Just plain text")).toBe("Just plain text");
	});

	it("returns cleaned text if fences but invalid JSON", () => {
		const raw = "```\nnot json\n```";
		expect(extractAgentMessage(raw)).toBe("not json");
	});
});
