// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";
import "../../src/ui/ask-bob.js";

describe("ask-bob", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("ask-bob");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	afterEach(() => { el.remove(); });

	it("renders the Ask Bob button", async () => {
		const btn = el.shadowRoot!.querySelector(".bob-btn");
		expect(btn).not.toBeNull();
		expect(btn!.textContent).toContain("Ask Bob");
	});

	it("does not show chat overlay initially", async () => {
		const overlay = el.shadowRoot!.querySelector(".chat-overlay");
		expect(overlay).toBeNull();
	});

	it("opens chat overlay on button click", async () => {
		const btn = el.shadowRoot!.querySelector<HTMLButtonElement>(".bob-btn")!;
		btn.click();
		await (el as any).updateComplete;

		const overlay = el.shadowRoot!.querySelector(".chat-overlay");
		expect(overlay).not.toBeNull();

		const title = el.shadowRoot!.querySelector(".name");
		expect(title!.textContent).toBe("Bob");
	});

	it("closes chat overlay on close button click", async () => {
		const btn = el.shadowRoot!.querySelector<HTMLButtonElement>(".bob-btn")!;
		btn.click();
		await (el as any).updateComplete;

		const closeBtn = el.shadowRoot!.querySelector<HTMLButtonElement>(".close-btn")!;
		closeBtn.click();
		await (el as any).updateComplete;

		const overlay = el.shadowRoot!.querySelector(".chat-overlay");
		expect(overlay).toBeNull();
	});

	it("shows empty state when no messages", async () => {
		const btn = el.shadowRoot!.querySelector<HTMLButtonElement>(".bob-btn")!;
		btn.click();
		await (el as any).updateComplete;

		const empty = el.shadowRoot!.querySelector(".empty");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("Ask Bob anything");
	});

	it("sends message via store on send button click", async () => {
		const sendSpy = vi.spyOn(store, "sendMessage").mockResolvedValue({ ok: true });
		const pushSpy = vi.spyOn(store, "pushUserMessage");

		const btn = el.shadowRoot!.querySelector<HTMLButtonElement>(".bob-btn")!;
		btn.click();
		await (el as any).updateComplete;

		const input = el.shadowRoot!.querySelector<HTMLInputElement>(".chat-input")!;
		input.value = "What are the agents doing?";

		const sendBtn = el.shadowRoot!.querySelector<HTMLButtonElement>(".send-btn")!;
		sendBtn.click();

		expect(pushSpy).toHaveBeenCalledWith("Bob", "What are the agents doing?");
		expect(sendSpy).toHaveBeenCalledWith("Bob", "What are the agents doing?");

		sendSpy.mockRestore();
		pushSpy.mockRestore();
	});

	it("renders conversation turns from store", async () => {
		store.pushUserMessage("Bob", "Hello Bob!");
		store.pushAgentResponse("Bob", "Hey there! Everyone's doing great.");

		const btn = el.shadowRoot!.querySelector<HTMLButtonElement>(".bob-btn")!;
		btn.click();
		await (el as any).updateComplete;

		const turns = el.shadowRoot!.querySelectorAll(".turn");
		expect(turns.length).toBe(2);
		expect(turns[0].getAttribute("data-role")).toBe("user");
		expect(turns[1].getAttribute("data-role")).toBe("agent");
	});

	it("shows thinking indicator when Bob is processing", async () => {
		store.pushUserMessage("Bob", "What's happening?");

		const btn = el.shadowRoot!.querySelector<HTMLButtonElement>(".bob-btn")!;
		btn.click();
		await (el as any).updateComplete;

		const thinking = el.shadowRoot!.querySelector(".thinking");
		expect(thinking).not.toBeNull();
		expect(thinking!.textContent).toContain("Bob is thinking");
	});
});
