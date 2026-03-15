import { describe, it, expect } from "vitest";
import { buildConversationPrompt, buildClarificationPrompt, parseAgentResponse } from "../../../src/domain/agents/agent-conversation.js";

describe("buildConversationPrompt", () => {
	it("includes system prompt when provided", () => {
		const result = buildConversationPrompt("Bob", "Be helpful.", [], "Hello");
		expect(result).toContain("# System Instructions");
		expect(result).toContain("Be helpful.");
		expect(result).toContain("**User:** Hello");
		expect(result).toContain("Respond as Bob");
	});

	it("omits system instructions section when no prompt", () => {
		const result = buildConversationPrompt("Bob", null, [], "Hello");
		expect(result).not.toContain("# System Instructions");
		expect(result).toContain("You are **Bob**.");
		expect(result).toContain("**User:** Hello");
	});

	it("includes conversation history", () => {
		const history = [
			{ role: "user" as const, content: "Hi there" },
			{ role: "agent" as const, content: "Hello! How can I help?" },
		];
		const result = buildConversationPrompt("Bob", null, history, "What next?");
		expect(result).toContain("# Conversation So Far");
		expect(result).toContain("**User:** Hi there");
		expect(result).toContain("**Bob:** Hello! How can I help?");
		expect(result).toContain("**User:** What next?");
	});

	it("omits history section when empty", () => {
		const result = buildConversationPrompt("Bob", null, [], "First message");
		expect(result).not.toContain("# Conversation So Far");
	});

	it("uses agent name in role labels", () => {
		const history = [{ role: "agent" as const, content: "I'm here" }];
		const result = buildConversationPrompt("Alice", null, history, "Test");
		expect(result).toContain("**Alice:** I'm here");
		expect(result).toContain("Respond as Alice");
	});

	it("includes JSON response format instructions", () => {
		const result = buildConversationPrompt("Bob", null, [], "Hello");
		expect(result).toContain("# Response Format");
		expect(result).toContain('"status"');
		expect(result).toContain("question");
		expect(result).toContain("JSON");
	});
});

describe("buildClarificationPrompt", () => {
	it("includes task details and response format", () => {
		const result = buildClarificationPrompt("Bob", null, "Fix bug", "Fix the login flow", "Sprint 5", []);
		expect(result).toContain("**Task:** Fix bug");
		expect(result).toContain("**Description:** Fix the login flow");
		expect(result).toContain("**Context:** Sprint 5");
		expect(result).toContain("Ask clarification questions");
		expect(result).toContain("# Response Format");
	});

	it("includes system prompt when provided", () => {
		const result = buildClarificationPrompt("Bob", "You are a dev.", "Task", "Desc", "", []);
		expect(result).toContain("# System Instructions");
		expect(result).toContain("You are a dev.");
	});

	it("includes conversation history on follow-up", () => {
		const history = [
			{ role: "agent" as const, content: "What framework?" },
			{ role: "user" as const, content: "React" },
		];
		const result = buildClarificationPrompt("Bob", null, "Task", "Desc", "", history, "Also uses Redux");
		expect(result).toContain("# Discussion");
		expect(result).toContain("**Bob:** What framework?");
		expect(result).toContain("**User:** React");
		expect(result).toContain("**User:** Also uses Redux");
	});

	it("omits context when empty", () => {
		const result = buildClarificationPrompt("Bob", null, "Task", "Desc", "", []);
		expect(result).not.toContain("**Context:**");
	});
});


describe("parseAgentResponse", () => {
	it("parses valid JSON response", () => {
		const result = parseAgentResponse('{"message":"Hello!","status":"message"}');
		expect(result).toEqual({ message: "Hello!", status: "message" });
	});

	it("parses question status", () => {
		const result = parseAgentResponse('{"message":"What framework?","status":"question"}');
		expect(result).toEqual({ message: "What framework?", status: "question" });
	});

	it("parses ready status", () => {
		const result = parseAgentResponse('{"message":"I understand.","status":"ready"}');
		expect(result).toEqual({ message: "I understand.", status: "ready" });
	});

	it("parses error status", () => {
		const result = parseAgentResponse('{"message":"Missing info.","status":"error"}');
		expect(result).toEqual({ message: "Missing info.", status: "error" });
	});

	it("extracts JSON from markdown code block", () => {
		const raw = '```json\n{"message":"Hi","status":"message"}\n```';
		const result = parseAgentResponse(raw);
		expect(result).toEqual({ message: "Hi", status: "message" });
	});

	it("falls back to raw text on invalid JSON", () => {
		const result = parseAgentResponse("Just a plain text response");
		expect(result).toEqual({ message: "Just a plain text response", status: "message" });
	});

	it("falls back with question detection for plain text ending in ?", () => {
		const result = parseAgentResponse("What do you think?");
		expect(result).toEqual({ message: "What do you think?", status: "question" });
	});

	it("falls back when JSON missing required fields", () => {
		const result = parseAgentResponse('{"text":"no message field"}');
		expect(result).toEqual({ message: '{"text":"no message field"}', status: "message" });
	});

	it("falls back when status value is invalid", () => {
		const result = parseAgentResponse('{"message":"hi","status":"unknown"}');
		expect(result).toEqual({ message: '{"message":"hi","status":"unknown"}', status: "message" });
	});

	it("trims whitespace from raw input", () => {
		const result = parseAgentResponse('  \n{"message":"Trimmed","status":"message"}\n  ');
		expect(result).toEqual({ message: "Trimmed", status: "message" });
	});

	it("detects question from last non-empty line in multi-line text", () => {
		const result = parseAgentResponse("Some context here.\nWhat do you think?\n\n");
		expect(result.status).toBe("question");
	});

	it("detects message when last non-empty line is not a question", () => {
		const result = parseAgentResponse("What do you think?\nI will proceed now.\n");
		expect(result.status).toBe("message");
	});
});
