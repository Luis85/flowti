import { describe, it, expect } from "vitest";
import { CliError, InternalError, formatError, isCliError } from "../../src/infrastructure/errors.js";

describe("CliError", () => {
	it("stores message and guidance", () => {
		const err = new CliError("Config not found", "Run flowti init to create one.");
		expect(err.message).toBe("Config not found");
		expect(err.guidance).toBe("Run flowti init to create one.");
		expect(err.name).toBe("CliError");
	});

	it("is an instance of Error", () => {
		const err = new CliError("msg", "guidance");
		expect(err).toBeInstanceOf(Error);
	});
});

describe("InternalError", () => {
	it("stores message", () => {
		const err = new InternalError("Broken invariant");
		expect(err.message).toBe("Broken invariant");
		expect(err.name).toBe("InternalError");
	});

	it("is an instance of Error", () => {
		const err = new InternalError("msg");
		expect(err).toBeInstanceOf(Error);
	});
});

describe("formatError", () => {
	it("formats CliError with message and guidance (no stack)", () => {
		const err = new CliError("Cannot locate vault root.", "Set FLOWTI_VAULT_ROOT.");
		const output = formatError(err);
		expect(output).toBe("Cannot locate vault root.\n  Set FLOWTI_VAULT_ROOT.");
		expect(output).not.toContain("at ");
	});

	it("formats InternalError with stack trace", () => {
		const err = new InternalError("Broken invariant");
		const output = formatError(err);
		expect(output).toContain("Internal error: Broken invariant");
		expect(output).toContain("at ");
	});

	it("formats unknown Error with stack trace", () => {
		const err = new Error("something broke");
		const output = formatError(err);
		expect(output).toContain("Unexpected error: something broke");
		expect(output).toContain("at ");
	});

	it("formats non-Error values", () => {
		expect(formatError("string error")).toBe("Unexpected error: string error");
		expect(formatError(42)).toBe("Unexpected error: 42");
		expect(formatError(null)).toBe("Unexpected error: null");
	});
});

describe("isCliError", () => {
	it("returns true for CliError instances", () => {
		expect(isCliError(new CliError("msg", "guidance"))).toBe(true);
	});

	it("returns false for InternalError", () => {
		expect(isCliError(new InternalError("msg"))).toBe(false);
	});

	it("returns false for plain Error", () => {
		expect(isCliError(new Error("msg"))).toBe(false);
	});

	it("returns false for non-errors", () => {
		expect(isCliError("string")).toBe(false);
		expect(isCliError(null)).toBe(false);
		expect(isCliError(undefined)).toBe(false);
	});
});
