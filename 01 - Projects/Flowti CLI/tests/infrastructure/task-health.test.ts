import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTaskHealthMonitor } from "../../src/infrastructure/task-health.js";
import type { ITaskHealthMonitor } from "../../src/infrastructure/task-health.js";

describe("createTaskHealthMonitor", () => {
	let monitor: ITaskHealthMonitor;

	beforeEach(() => {
		vi.useFakeTimers();
		monitor = createTaskHealthMonitor({ staleThresholdMs: 5000 });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("recordTaskStart() / recordTaskEnd()", () => {
		it("a started task appears as stale after threshold", () => {
			monitor.recordTaskStart("Alice", "task-1");
			vi.advanceTimersByTime(6000);
			const stale = monitor.checkStale(Date.now());
			expect(stale).toHaveLength(1);
			expect(stale[0].agentName).toBe("Alice");
			expect(stale[0].taskId).toBe("task-1");
		});

		it("a ended task does not appear in checkStale", () => {
			monitor.recordTaskStart("Alice", "task-1");
			monitor.recordTaskEnd("Alice", "task-1");
			vi.advanceTimersByTime(6000);
			expect(monitor.checkStale(Date.now())).toHaveLength(0);
		});

		it("multiple tasks for same agent are tracked independently", () => {
			monitor.recordTaskStart("Alice", "task-1");
			monitor.recordTaskStart("Alice", "task-2");
			vi.advanceTimersByTime(6000);
			const stale = monitor.checkStale(Date.now());
			expect(stale).toHaveLength(2);
			const ids = stale.map((s) => s.taskId).sort();
			expect(ids).toEqual(["task-1", "task-2"]);
		});

		it("ending one task does not affect other in-progress tasks", () => {
			monitor.recordTaskStart("Alice", "task-1");
			monitor.recordTaskStart("Alice", "task-2");
			monitor.recordTaskEnd("Alice", "task-1");
			vi.advanceTimersByTime(6000);
			const stale = monitor.checkStale(Date.now());
			expect(stale).toHaveLength(1);
			expect(stale[0].taskId).toBe("task-2");
		});

		it("tasks for different agents are tracked independently", () => {
			monitor.recordTaskStart("Alice", "task-1");
			monitor.recordTaskStart("Bob", "task-2");
			vi.advanceTimersByTime(6000);
			const stale = monitor.checkStale(Date.now());
			expect(stale).toHaveLength(2);
			const agents = stale.map((s) => s.agentName).sort();
			expect(agents).toEqual(["Alice", "Bob"]);
		});
	});

	describe("checkStale()", () => {
		it("returns empty array when no tasks in progress", () => {
			expect(monitor.checkStale(Date.now())).toHaveLength(0);
		});

		it("ignores tasks within the stale threshold", () => {
			monitor.recordTaskStart("Alice", "task-1");
			vi.advanceTimersByTime(4999);
			expect(monitor.checkStale(Date.now())).toHaveLength(0);
		});

		it("detects tasks that exactly hit the stale threshold", () => {
			monitor.recordTaskStart("Alice", "task-1");
			vi.advanceTimersByTime(5000);
			const stale = monitor.checkStale(Date.now());
			expect(stale).toHaveLength(1);
		});

		it("reports staleSinceMs as time elapsed beyond threshold", () => {
			monitor.recordTaskStart("Alice", "task-1");
			vi.advanceTimersByTime(7000);
			const stale = monitor.checkStale(Date.now());
			expect(stale[0].staleSinceMs).toBeGreaterThanOrEqual(2000);
		});

		it("staleSinceMs is 0 when task just hit the threshold", () => {
			monitor.recordTaskStart("Alice", "task-1");
			vi.advanceTimersByTime(5000);
			const stale = monitor.checkStale(Date.now());
			expect(stale[0].staleSinceMs).toBe(0);
		});

		it("accepts an explicit nowMs parameter for deterministic testing", () => {
			const baseMs = 1_000_000;
			const localMonitor = createTaskHealthMonitor({ staleThresholdMs: 5000 });
			// Inject start time via fake timer offset
			vi.setSystemTime(baseMs);
			localMonitor.recordTaskStart("Alice", "task-1");

			// Check before threshold
			expect(localMonitor.checkStale(baseMs + 4999)).toHaveLength(0);
			// Check at threshold
			const stale = localMonitor.checkStale(baseMs + 5000);
			expect(stale).toHaveLength(1);
			expect(stale[0].staleSinceMs).toBe(0);
		});
	});

	describe("getFailureCount()", () => {
		it("returns 0 for an unknown agent", () => {
			expect(monitor.getFailureCount("nobody")).toBe(0);
		});

		it("returns 0 for a known agent with no failures recorded", () => {
			monitor.recordTaskStart("Alice", "task-1");
			expect(monitor.getFailureCount("Alice")).toBe(0);
		});
	});

	describe("default config", () => {
		it("uses 5-minute stale threshold by default", () => {
			const defaultMonitor = createTaskHealthMonitor();
			vi.setSystemTime(0);
			defaultMonitor.recordTaskStart("Alice", "task-1");

			// Under 5 minutes
			expect(defaultMonitor.checkStale(299_999)).toHaveLength(0);
			// At 5 minutes
			expect(defaultMonitor.checkStale(300_000)).toHaveLength(1);
		});
	});
});
