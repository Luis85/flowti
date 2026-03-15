import { describe, it, expect } from "vitest";

describe("broken", () => {
	it("this test intentionally fails", () => {
		expect(1).toBe(2);
	});
});
