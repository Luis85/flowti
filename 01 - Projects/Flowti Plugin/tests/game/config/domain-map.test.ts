import { describe, it, expect } from "vitest";
import { resolveSettingForDomain } from "../../../src/game/config/domain-map.js";

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
	it("returns hub for unknown domain", () => {
		expect(resolveSettingForDomain("unknown")).toBe("hub");
	});
});
