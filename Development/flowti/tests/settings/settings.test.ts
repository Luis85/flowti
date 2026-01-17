import { describe, it, expect } from "vitest";
import {
	FlowtiSettingsSchema,
	safeParseSettings,
} from "../../src/settings/settings";

describe("FlowtiSettings", () => {
	describe("FlowtiSettingsSchema", () => {
		it("should parse valid settings", () => {
			const result = FlowtiSettingsSchema.parse({ debugMode: true });
			expect(result.debugMode).toBe(true);
		});

		it("should reject invalid debugMode type", () => {
			expect(() => FlowtiSettingsSchema.parse({ debugMode: "yes" })).toThrow();
		});
	});

	describe("safeParseSettings", () => {
		it("should return parsed settings for valid data", () => {
			const result = safeParseSettings({ debugMode: true });
			expect(result).not.toBeNull();
			expect(result?.debugMode).toBe(true);
		});

		it("should return null for invalid data", () => {
			const result = safeParseSettings({ debugMode: "invalid" });
			expect(result).toBeNull();
		});
	});
});
