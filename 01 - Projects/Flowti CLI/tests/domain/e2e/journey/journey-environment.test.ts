import { describe, it, expect, vi } from "vitest";
import {
	createEnvironmentRegistry,
} from "../../../../src/domain/e2e/journey/journey-environment.js";
import type {
	EnvironmentProvider,
	Capability,
} from "../../../../src/domain/e2e/journey/journey-environment.js";
import type { ToolDeps } from "../../../../src/domain/e2e/journey/journey-executor.js";
import { BASE_TOOLS } from "../../../../src/domain/e2e/journey/journey-tools.js";

function mockDeps(): ToolDeps {
	return {
		exec: vi.fn(() => ({ exitCode: 0, stdout: "", stderr: "" })),
		readFile: vi.fn(() => ""),
		writeFile: vi.fn(),
		exists: vi.fn(() => true),
		mkdir: vi.fn(),
		log: vi.fn(),
		sleep: vi.fn(async () => {}),
	};
}

// ── Registry basics ──────────────────────────────────────────────────

describe("createEnvironmentRegistry", () => {
	it("starts with no providers", () => {
		const reg = createEnvironmentRegistry();
		expect(reg.targets()).toEqual([]);
	});

	it("registers and retrieves a provider", () => {
		const reg = createEnvironmentRegistry();
		const provider: EnvironmentProvider = {
			target: "test",
			label: "Test",
			capabilities: ["a"],
			tools: {},
		};
		reg.registerProvider(provider);
		expect(reg.getProvider("test")).toBe(provider);
		expect(reg.targets()).toEqual(["test"]);
	});

	it("returns undefined for unknown target", () => {
		const reg = createEnvironmentRegistry();
		expect(reg.getProvider("unknown")).toBeUndefined();
	});
});

// ── Capability checks ────────────────────────────────────────────────

describe("checkCapabilities", () => {
	it("returns available for registered capability that passes check", () => {
		const reg = createEnvironmentRegistry();
		const cap: Capability = {
			id: "fs",
			name: "File System",
			description: "FS access",
			check: () => true,
		};
		reg.registerCapability(cap);

		const results = reg.checkCapabilities(["fs"], mockDeps());
		expect(results).toEqual([{ id: "fs", available: true }]);
	});

	it("returns unavailable with reason for failing check", () => {
		const reg = createEnvironmentRegistry();
		reg.registerCapability({
			id: "special",
			name: "Special",
			description: "",
			check: () => "not installed",
		});

		const results = reg.checkCapabilities(["special"], mockDeps());
		expect(results[0].available).toBe(false);
		expect(results[0].reason).toBe("not installed");
	});

	it("returns unavailable for unknown capability ID", () => {
		const reg = createEnvironmentRegistry();
		const results = reg.checkCapabilities(["unknown"], mockDeps());
		expect(results[0].available).toBe(false);
		expect(results[0].reason).toContain("Unknown capability");
	});

	it("handles boolean false from check", () => {
		const reg = createEnvironmentRegistry();
		reg.registerCapability({
			id: "nope",
			name: "Nope",
			description: "",
			check: () => false,
		});

		const results = reg.checkCapabilities(["nope"], mockDeps());
		expect(results[0].available).toBe(false);
	});

	it("checks multiple capabilities at once", () => {
		const reg = createEnvironmentRegistry();
		reg.registerCapability({ id: "a", name: "A", description: "", check: () => true });
		reg.registerCapability({ id: "b", name: "B", description: "", check: () => "missing" });

		const results = reg.checkCapabilities(["a", "b"], mockDeps());
		expect(results[0].available).toBe(true);
		expect(results[1].available).toBe(false);
	});
});

// ── Tool resolution ──────────────────────────────────────────────────

describe("resolveTools", () => {
	it("returns base tools when no provider registered", () => {
		const reg = createEnvironmentRegistry();
		const tools = reg.resolveTools("missing", BASE_TOOLS);
		expect(Object.keys(tools)).toEqual(Object.keys(BASE_TOOLS));
	});

	it("merges provider tools with base tools", () => {
		const reg = createEnvironmentRegistry();
		const customTool = vi.fn();
		reg.registerProvider({
			target: "custom",
			label: "Custom",
			capabilities: [],
			tools: { "custom-tool": customTool as never },
		});

		const tools = reg.resolveTools("custom", BASE_TOOLS);
		expect(tools["custom-tool"]).toBe(customTool);
		expect(tools["command"]).toBe(BASE_TOOLS["command"]);
	});

	it("provider tools can override base tools", () => {
		const reg = createEnvironmentRegistry();
		const customCommand = vi.fn();
		reg.registerProvider({
			target: "override",
			label: "Override",
			capabilities: [],
			tools: { command: customCommand as never },
		});

		const tools = reg.resolveTools("override", BASE_TOOLS);
		expect(tools["command"]).toBe(customCommand);
	});
});
