// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { DashboardStore } from "../../src/store/dashboard-store.js";

describe("DashboardStore RAF batching", () => {
	it("coalesces multiple notify calls into one state-changed event per frame", async () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);

		store.setConnectionStatus("connected");
		store.setConnectionStatus("disconnected");
		store.setConnectionStatus("connected");

		// In jsdom, RAF is available — events should be deferred
		expect(handler).not.toHaveBeenCalled();

		await new Promise((r) => requestAnimationFrame(r));

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("batched notify via beginBatch/endBatch still fires synchronously", () => {
		const store = new DashboardStore();
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);

		store.beginBatch();
		store.setConnectionStatus("connected");
		store.setConnectionStatus("disconnected");
		store.endBatch();

		// endBatch fires immediately (no RAF)
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
