import { describe, it, expect } from "vitest";
import { parsePayloadFlag } from "../../../src/domain/events/event-payload.js";

describe("parsePayloadFlag", () => {
	it("parses a single field", () => {
		const result = parsePayloadFlag("userId:string:required:The user ID");
		expect(result).toEqual([
			{ name: "userId", type: "string", required: true, description: "The user ID" },
		]);
	});

	it("parses multiple comma-separated fields", () => {
		const result = parsePayloadFlag("name:string:required:Name,age:number:optional:Age");
		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("name");
		expect(result[1].name).toBe("age");
	});

	it("handles optional (non-required) fields", () => {
		const result = parsePayloadFlag("email:string:optional:Email address");
		expect(result[0].required).toBe(false);
	});

	it("defaults type to string for invalid types", () => {
		const result = parsePayloadFlag("field:invalid:required:desc");
		expect(result[0].type).toBe("string");
	});

	it("accepts all valid types", () => {
		const types = ["string", "number", "boolean", "object", "array"];
		for (const type of types) {
			const result = parsePayloadFlag(`field:${type}:required:desc`);
			expect(result[0].type).toBe(type);
		}
	});

	it("handles missing description", () => {
		const result = parsePayloadFlag("field:string:required");
		expect(result[0].description).toBe("");
	});

	it("handles minimal input (name only)", () => {
		const result = parsePayloadFlag("field");
		expect(result[0]).toEqual({
			name: "field",
			type: "string",
			required: false,
			description: "",
		});
	});

	it("filters out entries with empty names", () => {
		const result = parsePayloadFlag(":string:required:desc");
		expect(result).toEqual([]);
	});

	it("trims whitespace from parts", () => {
		const result = parsePayloadFlag(" userId : string : required : The user ID ");
		expect(result[0].name).toBe("userId");
		expect(result[0].type).toBe("string");
		expect(result[0].required).toBe(true);
		expect(result[0].description).toBe("The user ID");
	});
});
