import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/readline.js", () => ({}));

import { yamlStr } from "../../../src/domain/e2e/e2e-helpers.js";

describe("yamlStr", () => {
	it("returns plain strings unchanged", () => {
		expect(yamlStr("hello world")).toBe("hello world");
	});

	it("escapes strings containing colons", () => {
		expect(yamlStr("key: value")).toBe('"key: value"');
	});

	it("escapes strings containing newlines", () => {
		expect(yamlStr("line1\nline2")).toBe('"line1\\nline2"');
	});

	it("escapes strings containing quotes", () => {
		expect(yamlStr("it's a test")).toBe('"it\'s a test"');
	});

	it("escapes strings containing hash", () => {
		expect(yamlStr("before # comment")).toBe('"before # comment"');
	});

	it("escapes strings with leading whitespace", () => {
		expect(yamlStr(" leading")).toBe('" leading"');
	});

	it("escapes strings with trailing whitespace", () => {
		expect(yamlStr("trailing ")).toBe('"trailing "');
	});

	it("escapes strings containing curly braces", () => {
		expect(yamlStr("obj: {a: 1}")).toBe('"obj: {a: 1}"');
	});

	it("escapes strings containing square brackets", () => {
		expect(yamlStr("[list]")).toBe('"[list]"');
	});

	it("returns simple alphanumeric strings unchanged", () => {
		expect(yamlStr("simple-name")).toBe("simple-name");
	});

	it("returns numbers as strings unchanged", () => {
		expect(yamlStr("12345")).toBe("12345");
	});
});
