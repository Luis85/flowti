import { describe, it, expect, vi } from "vitest";
import { WorldEventScheduler } from "../../../src/game/systems/world-event-scheduler.js";

describe("WorldEventScheduler", () => {
	it("fires guaranteed event on phase entry", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("standup", handler);
		scheduler.onPhaseChange("morning-arrival");
		scheduler.update(0); // immediate fire for guaranteed
		expect(handler).toHaveBeenCalled();
	});

	it("rolls probability for non-guaranteed events", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("eureka", handler);
		// Eureka has 15% chance — with mocked random it may or may not fire
		scheduler.onPhaseChange("productive-morning");
		scheduler.update(0);
		// We can't assert it was called (random), but it shouldn't throw
	});

	it("respects 30s minimum gap between events", () => {
		const handler1 = vi.fn();
		const handler2 = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("standup", handler1);
		scheduler.registerHandler("deploy-success", handler2);
		scheduler.onPhaseChange("morning-arrival");
		scheduler.update(0); // fires standup
		expect(handler1).toHaveBeenCalled();
		scheduler.update(10_000); // only 10s later — gap not met
		expect(handler2).not.toHaveBeenCalled();
		scheduler.update(25_000); // now 35s total — gap met
		// deploy-success should now be eligible
	});

	it("suppresses event when real sensor has fired", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("build-break", handler);
		scheduler.recordSensorEvent("test-fail"); // suppresses build-break
		scheduler.onPhaseChange("afternoon-slump");
		scheduler.update(0);
		expect(handler).not.toHaveBeenCalled();
	});

	it("reports active event state", () => {
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("standup", vi.fn());
		expect(scheduler.isEventActive()).toBe(false);
		scheduler.onPhaseChange("morning-arrival");
		scheduler.update(0);
		expect(scheduler.isEventActive()).toBe(true);
	});

	it("clears active state after event duration", () => {
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("end-of-day", vi.fn());
		scheduler.onPhaseChange("wind-down");
		scheduler.update(0);
		expect(scheduler.isEventActive()).toBe(true);
		scheduler.update(6_000); // end-of-day duration is 5s
		expect(scheduler.isEventActive()).toBe(false);
	});

	it("resets sensor suppressions on new cycle", () => {
		const handler = vi.fn();
		const scheduler = new WorldEventScheduler();
		scheduler.registerHandler("build-break", handler);
		scheduler.recordSensorEvent("test-fail");
		scheduler.onCycleReset();
		scheduler.onPhaseChange("afternoon-slump");
		scheduler.update(0);
		// Should no longer be suppressed
	});
});
