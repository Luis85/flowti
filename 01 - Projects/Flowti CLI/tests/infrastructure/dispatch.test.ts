import { describe, it, expect } from "vitest";
import { resolveCommand } from "../../src/infrastructure/dispatch.js";
import type { CommandHandler, ProjectContext } from "../../src/infrastructure/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

const noop: CommandHandler = () => {};
const project: ProjectContext = { name: "test-project", path: "/projects/test" };

function makeHandlers(entries: Record<string, CommandHandler> = {}): Record<string, CommandHandler> {
	return entries;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("resolveCommand", () => {
	describe("no command", () => {
		it("returns 'none' when command is null", () => {
			const result = resolveCommand(null, {}, [], makeHandlers(), new Set(), undefined, null);
			expect(result).toEqual({ action: "none" });
		});
	});

	describe("help command", () => {
		it("returns help action with 'main' section by default", () => {
			const result = resolveCommand("help", {}, ["help"], makeHandlers(), new Set(), undefined, null);
			expect(result).toEqual({ action: "help", section: "main" });
		});

		it("returns help action with section from first flag key", () => {
			const result = resolveCommand("help", { build: true }, ["help", "build"], makeHandlers(), new Set(), undefined, null);
			expect(result).toEqual({ action: "help", section: "build" });
		});

		it("returns help action with section from rawArgs when no flags", () => {
			const result = resolveCommand("help", {}, ["help", "reports"], makeHandlers(), new Set(), undefined, null);
			expect(result).toEqual({ action: "help", section: "reports" });
		});
	});

	describe("known command", () => {
		it("returns run action for known command with project", () => {
			const handler = noop;
			const result = resolveCommand("build", {}, ["build"], makeHandlers({ build: handler }), new Set(), undefined, project);
			expect(result).toEqual({ action: "run", handler, command: "build", project });
		});

		it("returns no-project when command requires project but none given", () => {
			const result = resolveCommand("build", {}, ["build"], makeHandlers({ build: noop }), new Set(), undefined, null);
			expect(result).toEqual({ action: "no-project", command: "build" });
		});

		it("returns run for project-free command without project", () => {
			const handler = noop;
			const result = resolveCommand("help-cmd", {}, ["help-cmd"], makeHandlers({ "help-cmd": handler }), new Set(["help-cmd"]), undefined, null);
			expect(result).toEqual({ action: "run", handler, command: "help-cmd", project: undefined });
		});
	});

	describe("unknown command", () => {
		it("returns unknown for unregistered command", () => {
			const result = resolveCommand("foo", {}, ["foo"], makeHandlers(), new Set(), undefined, project);
			expect(result).toEqual({ action: "unknown", command: "foo" });
		});
	});

	describe("wildcard (report:*)", () => {
		it("matches report:* commands with wildcard handler", () => {
			const wildcard = noop;
			const result = resolveCommand("report:custom", {}, ["report:custom"], makeHandlers(), new Set(), wildcard, project);
			expect(result).toEqual({ action: "run", handler: wildcard, command: "report:custom", project });
		});

		it("returns no-project for report:* without project", () => {
			const result = resolveCommand("report:custom", {}, ["report:custom"], makeHandlers(), new Set(), noop, null);
			expect(result).toEqual({ action: "no-project", command: "report:custom" });
		});

		it("does not match non-report:* commands with wildcard", () => {
			const result = resolveCommand("foo:bar", {}, ["foo:bar"], makeHandlers(), new Set(), noop, project);
			expect(result).toEqual({ action: "unknown", command: "foo:bar" });
		});

		it("returns unknown when no wildcard handler", () => {
			const result = resolveCommand("report:custom", {}, ["report:custom"], makeHandlers(), new Set(), undefined, project);
			expect(result).toEqual({ action: "unknown", command: "report:custom" });
		});
	});

	describe("priority", () => {
		it("known handler takes priority over wildcard", () => {
			const knownHandler: CommandHandler = () => {};
			const wildcardHandler: CommandHandler = () => {};
			const result = resolveCommand(
				"report:test", {}, ["report:test"],
				makeHandlers({ "report:test": knownHandler }),
				new Set(), wildcardHandler, project,
			);
			expect(result.action).toBe("run");
			expect((result as { handler: CommandHandler }).handler).toBe(knownHandler);
		});
	});
});
