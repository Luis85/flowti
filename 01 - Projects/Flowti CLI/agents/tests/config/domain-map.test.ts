import { describe, it, expect } from "vitest";
import { resolveSettingForDomain } from "../../src/config/domain-map.js";

describe("resolveSettingForDomain", () => {
	it("maps engineering to office", () => {
		expect(resolveSettingForDomain("engineering")).toBe("office");
	});
	it("maps design to village", () => {
		expect(resolveSettingForDomain("design")).toBe("village");
	});
	it("maps management to station", () => {
		expect(resolveSettingForDomain("management")).toBe("station");
	});
	it("returns hub for undefined domain", () => {
		expect(resolveSettingForDomain(undefined)).toBe("hub");
	});
	it("returns hub for unknown domain", () => {
		expect(resolveSettingForDomain("marketing")).toBe("hub");
	});
	it("custom mapping overrides default", () => {
		expect(resolveSettingForDomain("marketing", { marketing: "village" })).toBe("village");
	});
	it("is case-insensitive", () => {
		expect(resolveSettingForDomain("Engineering")).toBe("office");
	});
});
