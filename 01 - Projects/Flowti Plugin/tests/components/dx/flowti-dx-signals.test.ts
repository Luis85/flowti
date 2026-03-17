// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/dx/flowti-dx-signals";

function makeSignal(overrides: Record<string, unknown> = {}) {
	return {
		id: "s1",
		name: "Test Signal",
		sourcePath: "data/source.csv",
		targetPath: "Notes/Target",
		syncStatus: "synced",
		lastSyncAt: "2026-03-16T10:00:00Z",
		...overrides,
	};
}

describe("flowti-dx-signals", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-dx-signals") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-dx-signals")).toBeDefined();
	});

	it("renders empty state when no signals", async () => {
		el.signals = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const empty = shadow.querySelector(".empty-state");
		expect(empty).not.toBeNull();
		expect(empty!.textContent).toContain("No signals configured");
	});

	it("renders signal cards", async () => {
		el.signals = [
			makeSignal({ id: "s1", name: "Signal A" }),
			makeSignal({ id: "s2", name: "Signal B" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".signal-card");
		expect(cards.length).toBe(2);
		expect(cards[0].textContent).toContain("Signal A");
		expect(cards[1].textContent).toContain("Signal B");
	});

	it("renders sync status badge", async () => {
		el.signals = [makeSignal({ syncStatus: "synced" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector(".status-badge--success");
		expect(badge).not.toBeNull();
		expect(badge!.textContent?.trim()).toBe("synced");
	});

	it("renders pending status badge", async () => {
		el.signals = [makeSignal({ syncStatus: "pending" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const badge = shadow.querySelector(".status-badge--warning");
		expect(badge).not.toBeNull();
	});

	it("renders source and target paths", async () => {
		el.signals = [
			makeSignal({ sourcePath: "data/in.csv", targetPath: "Notes/Out" }),
		];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const paths = shadow.querySelector(".signal-paths");
		expect(paths!.textContent).toContain("data/in.csv");
		expect(paths!.textContent).toContain("Notes/Out");
	});

	it("filters signals by searchText", async () => {
		el.signals = [
			makeSignal({ id: "s1", name: "Alpha Signal", sourcePath: "data/alpha.csv" }),
			makeSignal({ id: "s2", name: "Beta Signal", sourcePath: "data/beta.csv" }),
		];
		el.searchText = "alpha";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const cards = shadow.querySelectorAll(".signal-card");
		expect(cards.length).toBe(1);
		expect(cards[0].textContent).toContain("Alpha Signal");
	});

	it("renders 'Sync all' button when signals exist", async () => {
		el.signals = [makeSignal()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const toolbarBtn = shadow.querySelector(".toolbar button") as HTMLButtonElement;
		expect(toolbarBtn).not.toBeNull();
		expect(toolbarBtn.textContent?.trim()).toBe("Sync all");
	});

	it("dispatches sync-signal on individual sync button click", async () => {
		el.signals = [makeSignal({ id: "s1" })];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const syncBtn = shadow.querySelector(".signal-card button") as HTMLButtonElement;

		let detail: unknown = null;
		el.addEventListener("sync-signal", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		syncBtn.click();
		expect(detail).toEqual({ signalId: "s1" });
	});

	it("dispatches sync-all on sync all button click", async () => {
		el.signals = [makeSignal()];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;

		const shadow = el.shadowRoot!;
		const syncAllBtn = shadow.querySelector(".toolbar button") as HTMLButtonElement;

		let fired = false;
		el.addEventListener("sync-all", () => { fired = true; });
		syncAllBtn.click();
		expect(fired).toBe(true);
	});
});
