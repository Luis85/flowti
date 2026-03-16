import { describe, it, expect, vi } from "vitest";
import { TuiChatRenderer } from "../../../src/tui/chat/tui-chat-renderer.js";
import type { ChatSessionState } from "../../../src/tui/hooks/use-chat-session.js";

function createMockSession(): ChatSessionState {
	return {
		state: {
			status: "idle",
			messages: [],
			summary: "",
			recentTurns: [],
			streamingText: "",
			streamingThinking: "",
			currentTool: "",
			toolsExpanded: false,
			taskTools: [],
			elapsed: 0,
			inputTokens: 0,
			outputTokens: 0,
			mode: "conversation",
		},
		submit: vi.fn(),
		command: vi.fn(),
		pushMessage: vi.fn(),
		pushStreamEvent: vi.fn(),
		updateStatus: vi.fn(),
		updateMode: vi.fn(),
		showHistory: vi.fn(),
		onUserInput: vi.fn(),
		onCommandHandler: vi.fn(),
	};
}

describe("TuiChatRenderer", () => {
	it("mount is a no-op", async () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		await expect(renderer.mount({ agentName: "Test", mode: "conversation" })).resolves.toBeUndefined();
	});

	it("unmount returns main", async () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const result = await renderer.unmount();
		expect(result).toBe("main");
	});

	it("pushMessage delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const msg = { role: "user" as const, content: "hello", timestamp: "2026-03-16T10:00:00Z" };
		renderer.pushMessage(msg);
		expect(session.pushMessage).toHaveBeenCalledWith(msg);
	});

	it("pushStreamEvent delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const event = { kind: "text" as const, text: "hi" };
		renderer.pushStreamEvent(event);
		expect(session.pushStreamEvent).toHaveBeenCalledWith(event);
	});

	it("updateStatus delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		renderer.updateStatus("thinking");
		expect(session.updateStatus).toHaveBeenCalledWith("thinking");
	});

	it("updateMode delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		renderer.updateMode("task");
		expect(session.updateMode).toHaveBeenCalledWith("task");
	});

	it("showHistory delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const turns = [{ role: "user" as const, content: "hi", timestamp: "2026-03-16T10:00:00Z" }];
		renderer.showHistory("summary", turns);
		expect(session.showHistory).toHaveBeenCalledWith("summary", turns);
	});

	it("onUserInput delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const cb = vi.fn();
		renderer.onUserInput(cb);
		expect(session.onUserInput).toHaveBeenCalledWith(cb);
	});

	it("onCommand delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const cb = vi.fn();
		renderer.onCommand(cb);
		expect(session.onCommandHandler).toHaveBeenCalledWith(cb);
	});
});
