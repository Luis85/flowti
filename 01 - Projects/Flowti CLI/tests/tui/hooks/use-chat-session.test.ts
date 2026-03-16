import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useChatSession } from "../../../src/tui/hooks/use-chat-session.js";
import type { ChatSessionState } from "../../../src/tui/hooks/use-chat-session.js";

function ChatHarness({ resultRef }: { resultRef: React.MutableRefObject<ChatSessionState | null> }): React.JSX.Element {
	const session = useChatSession();
	resultRef.current = session;
	return React.createElement(Text, null, session.state.status);
}

function renderHook() {
	const resultRef: React.MutableRefObject<ChatSessionState | null> = { current: null };
	const instance = render(React.createElement(ChatHarness, { resultRef }));
	return { ...instance, session: () => resultRef.current! };
}

describe("useChatSession", () => {
	it("starts in idle status", () => {
		const { unmount, session } = renderHook();
		expect(session().state.status).toBe("idle");
		unmount();
	});

	it("provides submit and command callbacks", () => {
		const { unmount, session } = renderHook();
		expect(typeof session().submit).toBe("function");
		expect(typeof session().command).toBe("function");
		unmount();
	});

	it("has empty messages initially", () => {
		const { unmount, session } = renderHook();
		expect(session().state.messages).toEqual([]);
		expect(session().state.streamingText).toBe("");
		unmount();
	});

	it("onUserInput registers a submit handler", () => {
		const { unmount, session } = renderHook();
		const handler = vi.fn();
		session().onUserInput(handler);
		session().submit("hello");
		expect(handler).toHaveBeenCalledWith("hello");
		unmount();
	});

	it("onCommandHandler registers a command handler", () => {
		const { unmount, session } = renderHook();
		const handler = vi.fn();
		session().onCommandHandler(handler);
		session().command({ type: "done" });
		expect(handler).toHaveBeenCalledWith({ type: "done" });
		unmount();
	});
});
