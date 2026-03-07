import { describe, it, expect } from "vitest";
import { parseArgs } from "../../src/infrastructure/args.js";

describe("parseArgs", () => {
	it("returns empty command and flags for no args", () => {
		const result = parseArgs([]);
		expect(result).toEqual({ command: null, flags: {} });
	});

	it("parses a single command", () => {
		const result = parseArgs(["build"]);
		expect(result.command).toBe("build");
		expect(result.flags).toEqual({});
	});

	it("parses a boolean flag", () => {
		const result = parseArgs(["--verbose"]);
		expect(result.command).toBeNull();
		expect(result.flags.verbose).toBe(true);
	});

	it("parses a key=value flag", () => {
		const result = parseArgs(["--name=hello"]);
		expect(result.command).toBeNull();
		expect(result.flags.name).toBe("hello");
	});

	it("parses command with flags", () => {
		const result = parseArgs(["build", "--watch", "--target=es2022"]);
		expect(result.command).toBe("build");
		expect(result.flags.watch).toBe(true);
		expect(result.flags.target).toBe("es2022");
	});

	it("takes only the first positional as command", () => {
		const result = parseArgs(["build", "extra"]);
		expect(result.command).toBe("build");
	});

	it("handles flag value with equals sign in it", () => {
		const result = parseArgs(["--formula=a=b"]);
		expect(result.flags.formula).toBe("a=b");
	});

	it("parses multiple boolean flags", () => {
		const result = parseArgs(["--dry-run", "--verbose"]);
		expect(result.flags["dry-run"]).toBe(true);
		expect(result.flags.verbose).toBe(true);
	});

	it("handles namespaced command", () => {
		const result = parseArgs(["dev:reload"]);
		expect(result.command).toBe("dev:reload");
	});
});
