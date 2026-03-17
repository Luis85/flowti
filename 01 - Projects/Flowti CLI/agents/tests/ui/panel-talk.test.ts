// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";
import "../../src/ui/panel-talk.js";

/** Flush RAF-deferred store notifications, then wait for Lit update. */
async function flushStore(el: HTMLElement): Promise<void> {
	await new Promise((r) => requestAnimationFrame(r));
	await (el as any).updateComplete;
}

describe("panel-talk", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("panel-talk");
		(el as any).store = store;
		(el as any).agentName = "TestBot";
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	afterEach(() => { el.remove(); });

	it("renders empty thread initially", async () => {
		const empty = el.shadowRoot!.querySelector(".empty");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No messages yet");
	});

	it("renders conversation turns from store", async () => {
		store.pushUserMessage("TestBot", "Hello agent!");
		store.pushAgentResponse("TestBot", "Hello human!");
		await flushStore(el);

		const turns = el.shadowRoot!.querySelectorAll(".turn");
		expect(turns.length).toBe(2);

		expect(turns[0].getAttribute("data-role")).toBe("user");
		expect(turns[0].textContent).toContain("Hello agent!");

		expect(turns[1].getAttribute("data-role")).toBe("agent");
		expect(turns[1].textContent).toContain("Hello human!");
	});

	it("shows thinking indicator when agent is thinking", async () => {
		store.pushUserMessage("TestBot", "What do you think?");
		await flushStore(el);

		const thinking = el.shadowRoot!.querySelector(".thinking");
		expect(thinking).not.toBeNull();
		expect(thinking!.textContent).toBe("Thinking...");
	});

	it("hides thinking indicator after agent responds", async () => {
		store.pushUserMessage("TestBot", "What do you think?");
		await flushStore(el);

		store.pushAgentResponse("TestBot", "I think this.");
		await flushStore(el);

		const thinking = el.shadowRoot!.querySelector(".thinking");
		expect(thinking).toBeNull();
	});

	it("sends message via store on button click", async () => {
		const sendSpy = vi.spyOn(store, "sendMessage").mockResolvedValue({ ok: true });
		const pushSpy = vi.spyOn(store, "pushUserMessage");

		const input = el.shadowRoot!.querySelector<HTMLInputElement>(".talk-input")!;
		input.value = "Test message";

		const sendBtn = el.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
		sendBtn.click();

		expect(pushSpy).toHaveBeenCalledWith("TestBot", "Test message");
		expect(sendSpy).toHaveBeenCalledWith("TestBot", "Test message");

		sendSpy.mockRestore();
		pushSpy.mockRestore();
	});

	it("clears input after sending", async () => {
		vi.spyOn(store, "sendMessage").mockResolvedValue({ ok: true });

		const input = el.shadowRoot!.querySelector<HTMLInputElement>(".talk-input")!;
		input.value = "Hello!";

		const sendBtn = el.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
		sendBtn.click();

		expect(input.value).toBe("");
	});

	it("does not send empty messages", async () => {
		const sendSpy = vi.spyOn(store, "sendMessage").mockResolvedValue({ ok: true });

		const sendBtn = el.shadowRoot!.querySelector<HTMLButtonElement>("button")!;
		sendBtn.click();

		expect(sendSpy).not.toHaveBeenCalled();

		sendSpy.mockRestore();
	});

	it("sends on Enter key press", async () => {
		const sendSpy = vi.spyOn(store, "sendMessage").mockResolvedValue({ ok: true });
		const pushSpy = vi.spyOn(store, "pushUserMessage");

		const input = el.shadowRoot!.querySelector<HTMLInputElement>(".talk-input")!;
		input.value = "Enter test";
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

		expect(pushSpy).toHaveBeenCalledWith("TestBot", "Enter test");
		expect(sendSpy).toHaveBeenCalledWith("TestBot", "Enter test");

		sendSpy.mockRestore();
		pushSpy.mockRestore();
	});

	it("renders input with correct placeholder", async () => {
		const input = el.shadowRoot!.querySelector<HTMLInputElement>(".talk-input")!;
		expect(input.placeholder).toBe("Message TestBot...");
	});

	it("renders at most 50 conversation turns", async () => {
		for (let i = 0; i < 60; i++) {
			if (i % 2 === 0) {
				store.pushUserMessage("TestBot", `Message ${i}`);
			} else {
				store.pushAgentResponse("TestBot", `Response ${i}`);
			}
		}
		await flushStore(el);

		const turns = el.shadowRoot!.querySelectorAll(".turn");
		expect(turns.length).toBe(50);
	});

	it("shows most recent turns when capped", async () => {
		for (let i = 0; i < 60; i++) {
			if (i % 2 === 0) {
				store.pushUserMessage("TestBot", `Msg-${i}`);
			} else {
				store.pushAgentResponse("TestBot", `Rsp-${i}`);
			}
		}
		await flushStore(el);

		const turns = el.shadowRoot!.querySelectorAll(".turn");
		const lastTurn = turns[turns.length - 1];
		expect(lastTurn.textContent).toContain("Rsp-59");
	});
});
