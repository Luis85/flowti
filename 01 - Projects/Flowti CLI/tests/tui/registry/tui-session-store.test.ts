import { describe, it, expect } from "vitest";
import { createSessionStore } from "../../../src/tui/registry/tui-session-store.js";

describe("createSessionStore", () => {
	it("creates store with empty pipeline", () => {
		const store = createSessionStore();
		expect(store.pipeline).toEqual({});
		expect(store.selectedProject).toBeUndefined();
	});

	it("allows mutation of pipeline state", () => {
		const store = createSessionStore();
		store.pipeline["buildPassed"] = true;
		expect(store.pipeline["buildPassed"]).toBe(true);
	});
});
