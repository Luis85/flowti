import { describe, it, expect } from "vitest";
import { SESSION_TYPE_CONFIGS, SESSION_TYPES, DAILY_ACTIVITY_DEDUP_WINDOW_MS } from "../../../src/domain/session/types";

describe("Session Types", () => {
	it("should have daily-tracking type config with correct defaults", () => {
		const config = SESSION_TYPE_CONFIGS["daily-tracking"];
		expect(config).toBeDefined();
		expect(config.icon).toBe("calendar");
		expect(config.defaultDuration).toBe(0);
		expect(config.guidingQuestions).toEqual([]);
		expect(config.defaultGoals).toEqual([]);
		expect(config.label).toBe("Daily Tracking");
	});

	it("should include daily-tracking in SESSION_TYPES array", () => {
		const entry = SESSION_TYPES.find((t) => t.type === "daily-tracking");
		expect(entry).toBeDefined();
		expect(entry!.label).toBe("Daily Tracking");
		expect(entry!.description).toBe("Passive all-day activity tracking");
	});

	it("should have DAILY_ACTIVITY_DEDUP_WINDOW_MS at 30 seconds", () => {
		expect(DAILY_ACTIVITY_DEDUP_WINDOW_MS).toBe(30_000);
	});
});
