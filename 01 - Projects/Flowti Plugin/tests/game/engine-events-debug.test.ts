import { describe, it, expect } from "vitest";

describe("engine-events-debug", () => {
	it("module exports wireDebugEvents", async () => {
		const mod = await import("../../src/game/engine-events-debug.js");
		expect(mod.wireDebugEvents).toBeTypeOf("function");
	});
});
