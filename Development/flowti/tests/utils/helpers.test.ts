import { describe, it, expect } from "vitest";
import { generateUUID } from "../../src/utils/helpers";

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
