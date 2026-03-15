import { describe, it, expect } from "vitest";
import {
	isChatCommand,
	type ChatViewStatus,
	type ChatConfig,
	type ChatMessage,
	type ChatTurn,
	type ChatCommand,
	type ChatToolCall,
} from "../../../src/infrastructure/chat/chat-renderer-types.js";

describe("ChatViewStatus", () => {
	it("accepts valid statuses", () => {
		const valid: ChatViewStatus[] = ["idle", "thinking", "working", "waiting", "error"];
		expect(valid).toHaveLength(5);
	});
});

describe("ChatConfig", () => {
	it("accepts minimal config", () => {
		const config: ChatConfig = { agentName: "Atlas", mode: "conversation" };
		expect(config.agentName).toBe("Atlas");
		expect(config.mode).toBe("conversation");
	});

	it("accepts full config", () => {
		const config: ChatConfig = {
			agentName: "Atlas",
			persona: "Lead Architect",
			topicName: "feature-auth",
			mode: "task",
			taskBrief: "Write unit tests for auth module",
		};
		expect(config.taskBrief).toBe("Write unit tests for auth module");
	});
});

describe("ChatMessage", () => {
	it("accepts user message", () => {
		const msg: ChatMessage = { role: "user", content: "Hello", timestamp: "2026-03-15T12:00:00Z" };
		expect(msg.role).toBe("user");
	});

	it("accepts agent message with tools", () => {
		const tool: ChatToolCall = { name: "Read", target: "auth.ts", status: "done", durationMs: 120 };
		const msg: ChatMessage = {
			role: "agent", content: "Done.", timestamp: "2026-03-15T12:00:01Z", tools: [tool],
		};
		expect(msg.tools).toHaveLength(1);
	});
});

describe("ChatTurn", () => {
	it("accepts turn with thinking", () => {
		const turn: ChatTurn = { role: "agent", content: "I'll do it.", timestamp: "2026-03-15T12:00:00Z", thinking: "Let me think..." };
		expect(turn.thinking).toBe("Let me think...");
	});
});

describe("isChatCommand", () => {
	it("returns true for slash-prefixed input", () => {
		expect(isChatCommand("/done")).toBe(true);
		expect(isChatCommand("/new")).toBe(true);
	});

	it("returns false for regular text", () => {
		expect(isChatCommand("hello")).toBe(false);
		expect(isChatCommand("")).toBe(false);
	});
});
