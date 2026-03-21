import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createDequeuePipeline } from "../../src/infrastructure/task-dequeue.js";
import type { IDequeuePipeline } from "../../src/infrastructure/task-dequeue.js";

describe("createDequeuePipeline", () => {
	let pipeline: IDequeuePipeline;

	beforeEach(() => {
		vi.useFakeTimers();
		pipeline = createDequeuePipeline({ cooldownMs: 1000, maxConsecutiveFailures: 3 });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("onTaskCompleted()", () => {
		it("schedules a dequeue after cooldown has elapsed", () => {
			pipeline.onTaskCompleted("Alice", "task-1");

			// Before cooldown — not ready
			vi.advanceTimersByTime(999);
			expect(pipeline.getPendingDequeue("Alice")).toBeNull();

			// After cooldown — ready
			vi.advanceTimersByTime(1);
			expect(pipeline.getPendingDequeue("Alice")).toBe("Alice");
		});

		it("does not dequeue before cooldown elapsed", () => {
			pipeline.onTaskCompleted("Alice", "task-1");
			vi.advanceTimersByTime(500);
			expect(pipeline.getPendingDequeue("Alice")).toBeNull();
		});

		it("resets failure count on successful completion", () => {
			pipeline.recordFailure("Alice");
			pipeline.recordFailure("Alice");
			expect(pipeline.isBlocked("Alice")).toBe(false);

			pipeline.onTaskCompleted("Alice", "task-1");
			vi.advanceTimersByTime(1000);

			// Failure counter should be cleared — one more failure should not block
			pipeline.recordFailure("Alice");
			expect(pipeline.isBlocked("Alice")).toBe(false);
		});

		it("unblocks a previously blocked agent on successful completion", () => {
			pipeline.recordFailure("Alice");
			pipeline.recordFailure("Alice");
			pipeline.recordFailure("Alice");
			expect(pipeline.isBlocked("Alice")).toBe(true);

			pipeline.onTaskCompleted("Alice", "task-recover");
			expect(pipeline.isBlocked("Alice")).toBe(false);
		});
	});

	describe("recordFailure()", () => {
		it("blocks after maxConsecutiveFailures", () => {
			pipeline.recordFailure("Bob");
			pipeline.recordFailure("Bob");
			expect(pipeline.isBlocked("Bob")).toBe(false);

			pipeline.recordFailure("Bob");
			expect(pipeline.isBlocked("Bob")).toBe(true);
		});

		it("does not block after fewer than maxConsecutiveFailures", () => {
			pipeline.recordFailure("Bob");
			pipeline.recordFailure("Bob");
			expect(pipeline.isBlocked("Bob")).toBe(false);
		});

		it("blocked agent returns null from getPendingDequeue even after cooldown", () => {
			pipeline.onTaskCompleted("Bob", "task-1");
			vi.advanceTimersByTime(1000);

			pipeline.recordFailure("Bob");
			pipeline.recordFailure("Bob");
			pipeline.recordFailure("Bob");

			expect(pipeline.getPendingDequeue("Bob")).toBeNull();
		});
	});

	describe("isBlocked()", () => {
		it("returns false for an unknown agent", () => {
			expect(pipeline.isBlocked("nobody")).toBe(false);
		});

		it("returns true only after reaching maxConsecutiveFailures", () => {
			expect(pipeline.isBlocked("Charlie")).toBe(false);
			pipeline.recordFailure("Charlie");
			pipeline.recordFailure("Charlie");
			expect(pipeline.isBlocked("Charlie")).toBe(false);
			pipeline.recordFailure("Charlie");
			expect(pipeline.isBlocked("Charlie")).toBe(true);
		});
	});

	describe("getPendingDequeue()", () => {
		it("returns null for an unknown agent", () => {
			expect(pipeline.getPendingDequeue("nobody")).toBeNull();
		});

		it("returns null when agent has no completion recorded yet", () => {
			// Register via recordFailure but never completed
			pipeline.recordFailure("Dave");
			expect(pipeline.getPendingDequeue("Dave")).toBeNull();
		});

		it("returns agent name when cooldown has passed and not blocked", () => {
			pipeline.onTaskCompleted("Eve", "task-1");
			vi.advanceTimersByTime(1000);
			expect(pipeline.getPendingDequeue("Eve")).toBe("Eve");
		});

		it("returns null when blocked regardless of cooldown", () => {
			pipeline.onTaskCompleted("Eve", "task-1");
			vi.advanceTimersByTime(1000);
			pipeline.recordFailure("Eve");
			pipeline.recordFailure("Eve");
			pipeline.recordFailure("Eve");
			expect(pipeline.getPendingDequeue("Eve")).toBeNull();
		});
	});

	describe("reset()", () => {
		it("clears a block so getPendingDequeue returns agent name", () => {
			pipeline.onTaskCompleted("Frank", "task-1");
			vi.advanceTimersByTime(1000);

			pipeline.recordFailure("Frank");
			pipeline.recordFailure("Frank");
			pipeline.recordFailure("Frank");
			expect(pipeline.isBlocked("Frank")).toBe(true);

			pipeline.reset("Frank");
			expect(pipeline.isBlocked("Frank")).toBe(false);
			expect(pipeline.getPendingDequeue("Frank")).toBe("Frank");
		});

		it("resets failure count on manual reset", () => {
			pipeline.recordFailure("Frank");
			pipeline.recordFailure("Frank");
			pipeline.recordFailure("Frank");
			expect(pipeline.isBlocked("Frank")).toBe(true);

			pipeline.reset("Frank");
			// Two more failures should not re-block immediately
			pipeline.recordFailure("Frank");
			pipeline.recordFailure("Frank");
			expect(pipeline.isBlocked("Frank")).toBe(false);
		});

		it("does nothing for an unknown agent (no throw)", () => {
			expect(() => pipeline.reset("nobody")).not.toThrow();
		});
	});

	describe("default config", () => {
		it("uses 10000ms cooldown by default", () => {
			const defaultPipeline = createDequeuePipeline();
			defaultPipeline.onTaskCompleted("Agent", "task-1");
			vi.advanceTimersByTime(9999);
			expect(defaultPipeline.getPendingDequeue("Agent")).toBeNull();
			vi.advanceTimersByTime(1);
			expect(defaultPipeline.getPendingDequeue("Agent")).toBe("Agent");
		});

		it("blocks after 3 failures by default", () => {
			const defaultPipeline = createDequeuePipeline();
			defaultPipeline.recordFailure("Agent");
			defaultPipeline.recordFailure("Agent");
			expect(defaultPipeline.isBlocked("Agent")).toBe(false);
			defaultPipeline.recordFailure("Agent");
			expect(defaultPipeline.isBlocked("Agent")).toBe(true);
		});
	});
});
