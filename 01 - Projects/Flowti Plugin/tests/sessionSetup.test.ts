import { describe, it, expect } from "vitest";
import { shouldShowAddToSession } from "../src/bootstrap/sessionSetup";

describe("sessionSetup — shouldShowAddToSession()", () => {
	it("returns false when session is null", () => {
		expect(shouldShowAddToSession(null)).toBe(false);
	});

	it("returns true for running non-train session", () => {
		expect(shouldShowAddToSession({ type: "deep-work", status: "running" })).toBe(true);
	});

	it("returns true for running train session", () => {
		expect(shouldShowAddToSession({ type: "train-of-thought", status: "running" })).toBe(true);
	});

	it("returns true for paused train session", () => {
		expect(shouldShowAddToSession({ type: "train-of-thought", status: "paused" })).toBe(true);
	});

	it("returns false for completed train session", () => {
		expect(shouldShowAddToSession({ type: "train-of-thought", status: "completed" })).toBe(false);
	});

	it("returns false for reviewing train session", () => {
		expect(shouldShowAddToSession({ type: "train-of-thought", status: "reviewing" })).toBe(false);
	});

	it("returns false for archived train session", () => {
		expect(shouldShowAddToSession({ type: "train-of-thought", status: "archived" })).toBe(false);
	});

	it("returns true for completed non-train session", () => {
		expect(shouldShowAddToSession({ type: "deep-work", status: "completed" })).toBe(true);
	});

	it("returns true for prepared session", () => {
		expect(shouldShowAddToSession({ type: "deep-work", status: "prepared" })).toBe(true);
	});

	it("returns true for reviewing non-train session", () => {
		expect(shouldShowAddToSession({ type: "exploration", status: "reviewing" })).toBe(true);
	});
});
