import { describe, it, expect } from "vitest";
import { SESSION_TYPE_CONFIGS, SESSION_TYPES } from "../../../src/domain/session/types";

describe("Session Types", () => {
	it("should have daily-tracking type config for backward compat", () => {
		const config = SESSION_TYPE_CONFIGS["daily-tracking"];
		expect(config).toBeDefined();
		expect(config.icon).toBe("calendar");
		expect(config.defaultDuration).toBe(0);
		expect(config.label).toBe("Daily Tracking");
	});

	it("should not include daily-tracking in SESSION_TYPES display array", () => {
		const entry = SESSION_TYPES.find((t) => t.type === "daily-tracking");
		expect(entry).toBeUndefined();
	});
});
