// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { renderTalkTab, appendAgentResponse } from "../../src/ui/talk-tab.js";

function makeOptions() {
	return {
		sendMessage: vi.fn().mockResolvedValue({ ok: true }),
		baseUrl: "http://localhost:3000",
	};
}

describe("renderTalkTab", () => {
	it("creates input field and send button", () => {
		const container = document.createElement("div");
		renderTalkTab(container, "Alice", makeOptions());

		const input = container.querySelector<HTMLInputElement>("[data-testid='talk-input']");
		expect(input).not.toBeNull();
		expect(input!.placeholder).toBe("Message Alice...");

		const sendBtn = container.querySelector("[data-testid='talk-send']");
		expect(sendBtn).not.toBeNull();
		expect(sendBtn!.textContent).toBe("Send");
	});

	it("creates a talk thread container", () => {
		const container = document.createElement("div");
		renderTalkTab(container, "Alice", makeOptions());

		const thread = container.querySelector("[data-testid='talk-thread']");
		expect(thread).not.toBeNull();
	});

	it("calling send appends a user turn", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderTalkTab(container, "Alice", options);

		const input = container.querySelector<HTMLInputElement>("[data-testid='talk-input']");
		const sendBtn = container.querySelector<HTMLButtonElement>("[data-testid='talk-send']");

		input!.value = "Hello Alice!";
		sendBtn!.click();

		const turns = container.querySelectorAll(".agent-panel-talk-turn");
		expect(turns.length).toBe(1);
		expect(turns[0].textContent).toBe("You: Hello Alice!");
		expect(turns[0].getAttribute("data-sender")).toBe("user");
	});

	it("clears input after sending", () => {
		const container = document.createElement("div");
		renderTalkTab(container, "Alice", makeOptions());

		const input = container.querySelector<HTMLInputElement>("[data-testid='talk-input']");
		const sendBtn = container.querySelector<HTMLButtonElement>("[data-testid='talk-send']");

		input!.value = "Hello!";
		sendBtn!.click();

		expect(input!.value).toBe("");
	});

	it("calls sendMessage API on send", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderTalkTab(container, "Alice", options);

		const input = container.querySelector<HTMLInputElement>("[data-testid='talk-input']");
		const sendBtn = container.querySelector<HTMLButtonElement>("[data-testid='talk-send']");

		input!.value = "Test message";
		sendBtn!.click();

		expect(options.sendMessage).toHaveBeenCalledWith(
			"http://localhost:3000",
			"Alice",
			"Test message",
		);
	});

	it("does not send empty messages", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderTalkTab(container, "Alice", options);

		const sendBtn = container.querySelector<HTMLButtonElement>("[data-testid='talk-send']");
		sendBtn!.click();

		expect(options.sendMessage).not.toHaveBeenCalled();
		const turns = container.querySelectorAll(".agent-panel-talk-turn");
		expect(turns.length).toBe(0);
	});

	it("sends on Enter key press", () => {
		const container = document.createElement("div");
		const options = makeOptions();
		renderTalkTab(container, "Alice", options);

		const input = container.querySelector<HTMLInputElement>("[data-testid='talk-input']");
		input!.value = "Enter test";
		input!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		const turns = container.querySelectorAll(".agent-panel-talk-turn");
		expect(turns.length).toBe(1);
		expect(turns[0].textContent).toBe("You: Enter test");
	});
});

describe("appendAgentResponse", () => {
	it("adds the agent response to the thread", () => {
		const container = document.createElement("div");
		renderTalkTab(container, "Alice", makeOptions());

		appendAgentResponse(container, "Hello human!");

		const turns = container.querySelectorAll(".agent-panel-talk-turn");
		expect(turns.length).toBe(1);
		expect(turns[0].textContent).toBe("Hello human!");
		expect(turns[0].getAttribute("data-sender")).toBe("agent");
	});

	it("appends multiple responses in order", () => {
		const container = document.createElement("div");
		renderTalkTab(container, "Alice", makeOptions());

		appendAgentResponse(container, "First response");
		appendAgentResponse(container, "Second response");

		const turns = container.querySelectorAll(".agent-panel-talk-turn");
		expect(turns.length).toBe(2);
		expect(turns[0].textContent).toBe("First response");
		expect(turns[1].textContent).toBe("Second response");
	});

	it("does nothing if no thread container exists", () => {
		const container = document.createElement("div");
		// No renderTalkTab call — no thread
		appendAgentResponse(container, "Orphan message");

		const turns = container.querySelectorAll(".agent-panel-talk-turn");
		expect(turns.length).toBe(0);
	});
});
