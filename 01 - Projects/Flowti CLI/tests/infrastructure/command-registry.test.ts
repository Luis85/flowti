import { describe, it, expect, vi } from "vitest";
import { CommandRegistry } from "../../src/infrastructure/command-registry.js";
import type { CommandHandler } from "../../src/infrastructure/types.js";

const noop: CommandHandler = vi.fn();

describe("CommandRegistry", () => {
	it("registers domain commands", () => {
		const reg = new CommandRegistry();
		reg.registerDomain({ domain: "build", commands: { build: noop, test: noop } });
		expect(reg.size).toBe(2);
		expect(reg.has("build")).toBe(true);
		expect(reg.has("test")).toBe(true);
		expect(reg.has("unknown")).toBe(false);
	});

	it("detects collisions across domains", () => {
		const reg = new CommandRegistry();
		reg.registerDomain({ domain: "build", commands: { build: noop } });
		expect(() => {
			reg.registerDomain({ domain: "devtools", commands: { build: noop } });
		}).toThrow('Command "build" collision: registered by "build" and "devtools"');
	});

	it("returns handlers map", () => {
		const reg = new CommandRegistry();
		const handler: CommandHandler = vi.fn();
		reg.registerDomain({ domain: "info", commands: { info: handler } });
		const handlers = reg.handlers;
		expect(handlers.info).toBe(handler);
	});

	it("derives projectFreeSet from registration metadata", () => {
		const reg = new CommandRegistry();
		reg.registerDomain({ domain: "help", commands: { help: noop }, projectFree: ["help"] });
		reg.registerDomain({ domain: "build", commands: { build: noop } });
		reg.registerDomain({ domain: "capture", commands: { "capture:idea": noop, "capture:note": noop }, projectFree: ["capture:idea", "capture:note"] });

		const pf = reg.projectFreeSet;
		expect(pf.has("help")).toBe(true);
		expect(pf.has("capture:idea")).toBe(true);
		expect(pf.has("capture:note")).toBe(true);
		expect(pf.has("build")).toBe(false);
		expect(pf.size).toBe(3);
	});

	it("returns command metadata via get()", () => {
		const reg = new CommandRegistry();
		const handler: CommandHandler = vi.fn();
		reg.registerDomain({ domain: "make", commands: { "make:component": handler } });
		const meta = reg.get("make:component");
		expect(meta).toEqual({ handler, domain: "make", projectFree: false });
	});

	it("returns undefined for unknown commands", () => {
		const reg = new CommandRegistry();
		expect(reg.get("unknown")).toBeUndefined();
	});

	it("lists all command keys", () => {
		const reg = new CommandRegistry();
		reg.registerDomain({ domain: "a", commands: { x: noop, y: noop } });
		reg.registerDomain({ domain: "b", commands: { z: noop } });
		expect(reg.keys()).toEqual(["x", "y", "z"]);
	});

	it("lists unique domains in registration order", () => {
		const reg = new CommandRegistry();
		reg.registerDomain({ domain: "help", commands: { help: noop } });
		reg.registerDomain({ domain: "build", commands: { build: noop } });
		expect(reg.domains()).toEqual(["help", "build"]);
	});

	it("includes wildcard domain in domains()", () => {
		const reg = new CommandRegistry();
		reg.registerDomain({ domain: "help", commands: { help: noop } });
		reg.setWildcard("reports", noop);
		expect(reg.domains()).toContain("reports");
	});

	it("stores and returns wildcard handler", () => {
		const reg = new CommandRegistry();
		const handler: CommandHandler = vi.fn();
		reg.setWildcard("reports", handler);
		expect(reg.wildcard).toBe(handler);
	});

	it("returns undefined wildcard when not set", () => {
		const reg = new CommandRegistry();
		expect(reg.wildcard).toBeUndefined();
	});

	it("handles empty registration", () => {
		const reg = new CommandRegistry();
		reg.registerDomain({ domain: "empty", commands: {} });
		expect(reg.size).toBe(0);
		expect(reg.domains()).toEqual([]);
	});
});
