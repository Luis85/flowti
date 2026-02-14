import { describe, it, expect } from "vitest";
import {
	generateUUID,
	extractStringField,
	extractSettingsBoolean,
} from "../../src/utils/helpers";

describe("extractStringField", () => {
	it("should extract a string field from an object", () => {
		expect(extractStringField({ path: "/foo/bar" }, "path")).toBe("/foo/bar");
	});

	it("should return undefined for non-string field", () => {
		expect(extractStringField({ path: 42 }, "path")).toBeUndefined();
	});

	it("should return undefined for missing field", () => {
		expect(extractStringField({ name: "test" }, "path")).toBeUndefined();
	});

	it("should return undefined for null input", () => {
		expect(extractStringField(null, "path")).toBeUndefined();
	});

	it("should return undefined for undefined input", () => {
		expect(extractStringField(undefined, "path")).toBeUndefined();
	});

	it("should return undefined for non-object input", () => {
		expect(extractStringField("string", "path")).toBeUndefined();
	});
});

describe("extractSettingsBoolean", () => {
	it("should extract a boolean flag from nested settings", () => {
		const payload = { settings: { eventSystemEnabled: true } };
		expect(extractSettingsBoolean(payload, "eventSystemEnabled")).toBe(true);
	});

	it("should return false for false flags", () => {
		const payload = { settings: { eventSystemEnabled: false } };
		expect(extractSettingsBoolean(payload, "eventSystemEnabled")).toBe(false);
	});

	it("should return undefined for missing flag", () => {
		const payload = { settings: { other: true } };
		expect(extractSettingsBoolean(payload, "eventSystemEnabled")).toBeUndefined();
	});

	it("should return undefined for non-boolean flag", () => {
		const payload = { settings: { eventSystemEnabled: "yes" } };
		expect(extractSettingsBoolean(payload, "eventSystemEnabled")).toBeUndefined();
	});

	it("should return undefined for missing settings", () => {
		expect(extractSettingsBoolean({ other: 1 }, "eventSystemEnabled")).toBeUndefined();
	});

	it("should return undefined for null input", () => {
		expect(extractSettingsBoolean(null, "eventSystemEnabled")).toBeUndefined();
	});
});

describe("generateUUID", () => {
	const UUID_V4_REGEX =
		/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

	it("should generate a valid UUID v4 string", () => {
		expect(generateUUID()).toMatch(UUID_V4_REGEX);
	});

	it("should generate unique UUIDs", () => {
		const uuids = new Set(Array.from({ length: 10 }, () => generateUUID()));
		expect(uuids.size).toBe(10);
	});
});
