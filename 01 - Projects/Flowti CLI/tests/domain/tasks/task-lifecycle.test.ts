import { describe, it, expect } from "vitest";
import { canTransition, transition, VALID_TRANSITIONS } from "../../../src/domain/tasks/task-lifecycle.js";
import type { TaskStatus } from "../../../src/domain/tasks/task-types.js";

describe("task-lifecycle", () => {
	describe("canTransition", () => {
		it("allows proposed -> pending", () => {
			expect(canTransition("proposed", "pending")).toBe(true);
		});

		it("allows pending -> assigned", () => {
			expect(canTransition("pending", "assigned")).toBe(true);
		});

		it("allows assigned -> in-progress", () => {
			expect(canTransition("assigned", "in-progress")).toBe(true);
		});

		it("allows in-progress -> review", () => {
			expect(canTransition("in-progress", "review")).toBe(true);
		});

		it("allows in-progress -> completed", () => {
			expect(canTransition("in-progress", "completed")).toBe(true);
		});

		it("allows in-progress -> failed", () => {
			expect(canTransition("in-progress", "failed")).toBe(true);
		});

		it("allows review -> completed", () => {
			expect(canTransition("review", "completed")).toBe(true);
		});

		it("allows review -> pending (rejection)", () => {
			expect(canTransition("review", "pending")).toBe(true);
		});

		it("rejects invalid transition proposed -> completed", () => {
			expect(canTransition("proposed", "completed")).toBe(false);
		});

		it("rejects invalid transition completed -> pending", () => {
			expect(canTransition("completed", "pending")).toBe(false);
		});

		it("rejects same-state transition", () => {
			expect(canTransition("pending", "pending")).toBe(false);
		});
	});

	describe("transition", () => {
		it("returns new status on valid transition", () => {
			expect(transition("proposed", "pending")).toBe("pending");
		});

		it("returns null on invalid transition", () => {
			expect(transition("proposed", "completed")).toBeNull();
		});

		it("allows failed -> pending (retry)", () => {
			expect(transition("failed", "pending")).toBe("pending");
		});
	});

	describe("VALID_TRANSITIONS", () => {
		it("exports transition map", () => {
			expect(VALID_TRANSITIONS).toBeDefined();
			expect(VALID_TRANSITIONS.proposed).toContain("pending");
		});
	});
});
