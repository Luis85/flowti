import { describe, it, expect, vi } from "vitest";

import { resolveCommand } from "../src/infrastructure/dispatch.js";
import type { CommandHandler } from "../src/infrastructure/types.js";

const noop: CommandHandler = vi.fn();

describe("resolveCommand", () => {
	const handlers: Record<string, CommandHandler> = {
		build: noop,
		info: noop,
		project: noop,
	};
	const projectFree = new Set(["help", "project"]);
	const mockProject = { root: "/mock", config: { name: "test" } } as any;

	it("returns help action for help command", () => {
		const result = resolveCommand("help", {}, ["help"], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "help", section: "main" });
	});

	it("returns help with section from flags", () => {
		const result = resolveCommand("help", { build: true }, ["help", "build"], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "help", section: "build" });
	});

	it("returns help with section from rawArgs", () => {
		const result = resolveCommand("help", {}, ["help", "reports"], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "help", section: "reports" });
	});

	it("returns run for known command with project", () => {
		const result = resolveCommand("build", {}, ["build"], handlers, projectFree, undefined, mockProject);
		expect(result.action).toBe("run");
		if (result.action === "run") {
			expect(result.command).toBe("build");
			expect(result.project).toBe(mockProject);
		}
	});

	it("returns no-project when command needs project but none provided", () => {
		const result = resolveCommand("build", {}, ["build"], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "no-project", command: "build" });
	});

	it("allows project-free commands without project", () => {
		const result = resolveCommand("project", {}, ["project"], handlers, projectFree, undefined, null);
		expect(result.action).toBe("run");
	});

	it("returns run for wildcard report commands with project", () => {
		const wildcard: CommandHandler = vi.fn();
		const result = resolveCommand("report:test", {}, ["report:test"], handlers, projectFree, wildcard, mockProject);
		expect(result.action).toBe("run");
		if (result.action === "run") {
			expect(result.handler).toBe(wildcard);
			expect(result.command).toBe("report:test");
		}
	});

	it("returns no-project for wildcard report without project", () => {
		const wildcard: CommandHandler = vi.fn();
		const result = resolveCommand("report:test", {}, ["report:test"], handlers, projectFree, wildcard, null);
		expect(result).toEqual({ action: "no-project", command: "report:test" });
	});

	it("returns unknown for unrecognized command", () => {
		const result = resolveCommand("foobar", {}, ["foobar"], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "unknown", command: "foobar" });
	});

	it("returns none when no command", () => {
		const result = resolveCommand(null, {}, [], handlers, projectFree, undefined, null);
		expect(result).toEqual({ action: "none" });
	});
});
