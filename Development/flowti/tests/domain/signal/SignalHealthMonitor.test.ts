import { describe, it, expect, beforeEach } from "vitest";
import { SignalHealthMonitor } from "../../../src/domain/signal/SignalHealthMonitor";

describe("SignalHealthMonitor", () => {
	let monitor: SignalHealthMonitor;

	beforeEach(() => {
		monitor = new SignalHealthMonitor();
	});

	describe("getHealth()", () => {
		it("returns unknown status for untracked signal", () => {
			const health = monitor.getHealth("sig-1");
			expect(health.status).toBe("unknown");
			expect(health.lastChecked).toBeNull();
			expect(health.consecutiveFailures).toBe(0);
		});
	});

	describe("recordSuccess()", () => {
		it("sets status to healthy", () => {
			const state = monitor.recordSuccess("sig-1");
			expect(state.status).toBe("healthy");
			expect(state.lastChecked).toBeTruthy();
			expect(state.lastSuccessful).toBeTruthy();
			expect(state.consecutiveFailures).toBe(0);
		});

		it("resets consecutive failures after success", () => {
			monitor.recordFailure("sig-1", "fail 1");
			monitor.recordFailure("sig-1", "fail 2");
			const state = monitor.recordSuccess("sig-1");
			expect(state.consecutiveFailures).toBe(0);
			expect(state.status).toBe("healthy");
		});
	});

	describe("recordFailure()", () => {
		it("sets status to degraded on first failure", () => {
			const state = monitor.recordFailure("sig-1", "timeout");
			expect(state.status).toBe("degraded");
			expect(state.consecutiveFailures).toBe(1);
		});

		it("sets status to unreachable after 3 consecutive failures", () => {
			monitor.recordFailure("sig-1", "fail 1");
			monitor.recordFailure("sig-1", "fail 2");
			const state = monitor.recordFailure("sig-1", "fail 3");
			expect(state.status).toBe("unreachable");
			expect(state.consecutiveFailures).toBe(3);
		});

		it("adds errors to history (newest first)", () => {
			monitor.recordFailure("sig-1", "error A");
			monitor.recordFailure("sig-1", "error B");
			const health = monitor.getHealth("sig-1");
			expect(health.errorHistory).toHaveLength(2);
			expect(health.errorHistory[0].message).toBe("error B");
			expect(health.errorHistory[1].message).toBe("error A");
		});

		it("trims error history to 10 entries", () => {
			for (let i = 0; i < 15; i++) {
				monitor.recordFailure("sig-1", `error ${i}`);
			}
			const health = monitor.getHealth("sig-1");
			expect(health.errorHistory).toHaveLength(10);
		});

		it("does not update lastSuccessful on failure", () => {
			const state = monitor.recordFailure("sig-1", "oops");
			expect(state.lastSuccessful).toBeNull();
		});
	});

	describe("getAllHealth()", () => {
		it("returns all tracked signals", () => {
			monitor.recordSuccess("sig-1");
			monitor.recordFailure("sig-2", "error");
			const all = monitor.getAllHealth();
			expect(all).toHaveLength(2);
		});

		it("returns empty array when nothing is tracked", () => {
			expect(monitor.getAllHealth()).toHaveLength(0);
		});
	});

	describe("remove()", () => {
		it("removes a tracked signal", () => {
			monitor.recordSuccess("sig-1");
			monitor.remove("sig-1");
			expect(monitor.getHealth("sig-1").status).toBe("unknown");
		});
	});

	describe("dispose()", () => {
		it("clears all tracked signals", () => {
			monitor.recordSuccess("sig-1");
			monitor.recordFailure("sig-2", "error");
			monitor.dispose();
			expect(monitor.getAllHealth()).toHaveLength(0);
		});
	});

	describe("state isolation", () => {
		it("returns snapshot copies, not references", () => {
			monitor.recordSuccess("sig-1");
			const state1 = monitor.getHealth("sig-1");
			const state2 = monitor.getHealth("sig-1");
			expect(state1).not.toBe(state2);
		});
	});
});
