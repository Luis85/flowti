// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import "../../../src/components/agents/flowti-document-mode.js";

describe("flowti-document-mode", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-document-mode") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	afterEach(() => { el.remove(); });

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-document-mode")).toBeDefined();
	});

	it("renders empty state when no turns", async () => {
		el.turns = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No messages");
	});

	it("renders user turns with highlighted style", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "Hello agent", timestamp: "12:00", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const turn = shadow.querySelector(".turn--user");
		expect(turn).not.toBeNull();
		expect(shadow.textContent).toContain("Hello agent");
	});

	it("renders agent turns without user styling", async () => {
		el.turns = [
			{ id: "1", role: "agent", content: "I can help", timestamp: "12:01", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const turn = shadow.querySelector(".turn--agent");
		expect(turn).not.toBeNull();
		expect(shadow.textContent).toContain("I can help");
	});

	it("displays 'You' label for user turns", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "msg", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const role = shadow.querySelector(".turn__role");
		expect(role?.textContent).toContain("You");
	});

	it("displays agent name label for agent turns", async () => {
		el.agentName = "Atlas";
		el.turns = [
			{ id: "1", role: "agent", content: "msg", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const role = shadow.querySelector(".turn__role");
		expect(role?.textContent).toContain("Atlas");
	});

	it("uses turn agentName over component agentName", async () => {
		el.agentName = "Atlas";
		el.turns = [
			{ id: "1", role: "agent", agentName: "Vex", content: "msg", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const role = shadow.querySelector(".turn__role");
		expect(role?.textContent).toContain("Vex");
	});

	it("renders thinking content behind a details toggle", async () => {
		el.turns = [
			{ id: "1", role: "agent", content: "answer", thinking: "Let me think about this", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const details = shadow.querySelector(".thinking-toggle") as HTMLDetailsElement;
		expect(details).not.toBeNull();
		expect(details.tagName.toLowerCase()).toBe("details");
		const summary = details.querySelector("summary");
		expect(summary?.textContent).toContain("Show thinking");
		const content = details.querySelector(".thinking-content");
		expect(content?.textContent).toContain("Let me think about this");
	});

	it("does not render thinking toggle when no thinking", async () => {
		el.turns = [
			{ id: "1", role: "agent", content: "answer", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const details = shadow.querySelector(".thinking-toggle");
		expect(details).toBeNull();
	});

	it("renders tool calls as collapsed details elements", async () => {
		el.turns = [
			{
				id: "1", role: "agent", content: "result",
				toolCalls: [
					{ id: "t1", name: "Bash", status: "completed" },
					{ id: "t2", name: "Read", status: "started" },
				],
				timestamp: "", mode: "document",
			},
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const toolCalls = shadow.querySelectorAll(".tool-call");
		expect(toolCalls.length).toBe(2);
		expect(toolCalls[0].tagName.toLowerCase()).toBe("details");
		expect(toolCalls[0].querySelector("summary")?.textContent).toContain("Bash");
		expect(toolCalls[1].querySelector("summary")?.textContent).toContain("Read");
	});

	it("shows tool call status badge", async () => {
		el.turns = [
			{
				id: "1", role: "agent", content: "result",
				toolCalls: [{ id: "t1", name: "Bash", status: "completed" }],
				timestamp: "", mode: "document",
			},
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const status = shadow.querySelector(".tool-call__status");
		expect(status).not.toBeNull();
		expect(status?.textContent).toContain("completed");
		expect(status?.classList.contains("tool-call__status--completed")).toBe(true);
	});

	it("does not render tool calls section when no tool calls", async () => {
		el.turns = [
			{ id: "1", role: "agent", content: "answer", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const toolCalls = shadow.querySelector(".tool-calls");
		expect(toolCalls).toBeNull();
	});

	it("renders multiple turns in document order", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "first", timestamp: "", mode: "document" },
			{ id: "2", role: "agent", content: "second", timestamp: "", mode: "document" },
			{ id: "3", role: "user", content: "third", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const turns = shadow.querySelectorAll(".turn");
		expect(turns.length).toBe(3);
		expect(turns[0].getAttribute("data-turn-id")).toBe("1");
		expect(turns[1].getAttribute("data-turn-id")).toBe("2");
		expect(turns[2].getAttribute("data-turn-id")).toBe("3");
	});

	it("renders timestamp when provided", async () => {
		el.turns = [
			{ id: "1", role: "user", content: "msg", timestamp: "2026-03-18 12:00", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const ts = shadow.querySelector(".turn__timestamp");
		expect(ts?.textContent).toContain("2026-03-18 12:00");
	});

	it("shows loading state", async () => {
		el.loading = true;
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Loading");
	});

	it("shows error state", async () => {
		el.error = "Connection failed";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("Connection failed");
	});

	it("applies data-turn-id attribute on each turn", async () => {
		el.turns = [
			{ id: "abc", role: "user", content: "hello", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const turn = shadow.querySelector("[data-turn-id='abc']");
		expect(turn).not.toBeNull();
	});

	it("applies data-tool-id attribute on tool call details", async () => {
		el.turns = [
			{
				id: "1", role: "agent", content: "result",
				toolCalls: [{ id: "tool-42", name: "Grep", status: "completed" }],
				timestamp: "", mode: "document",
			},
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const tc = shadow.querySelector("[data-tool-id='tool-42']");
		expect(tc).not.toBeNull();
	});

	it("falls back to 'Agent' when no agentName is set", async () => {
		el.turns = [
			{ id: "1", role: "agent", content: "msg", timestamp: "", mode: "document" },
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		const role = shadow.querySelector(".turn__role");
		expect(role?.textContent).toContain("Agent");
	});
});
