import { describe, it, expect } from "vitest";
import { validateProjectConfig } from "../../../src/domain/project/config-schema.js";

// ── Helpers ──────────────────────────────────────────────────────────

function valid(overrides: Record<string, unknown> = {}) {
	return { name: "ReviewValidatorTest", ...overrides };
}

function agentsCfg(agents: Record<string, unknown>) {
	return valid({ management: { agents } });
}

// ── management.agents.skillMap ────────────────────────────────────────

describe("validateProjectConfig — management.agents.skillMap", () => {
	it("produces no warnings when skillMap is absent", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ roster: ["Agent A"] }));
		expect(warnings).toEqual([]);
	});

	it("produces no warnings when skillMap is a valid object", () => {
		const { warnings } = validateProjectConfig(agentsCfg({
			skillMap: {
				backend: ["read-code", "write-code"],
				frontend: ["css", "html"],
			},
		}));
		expect(warnings).toEqual([]);
	});

	it("produces no warnings when skillMap is an empty object", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: {} }));
		expect(warnings).toEqual([]);
	});

	it("produces no warnings when skillMap domain maps to an empty array", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: { backend: [] } }));
		expect(warnings).toEqual([]);
	});

	it("warns when skillMap is a string (not an object)", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: "bad" }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when skillMap is a number", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: 42 }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when skillMap is null", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: null }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when skillMap is an array", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: ["backend"] }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when a domain value is not an array", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: { backend: "read-code" } }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when a domain value is a number instead of an array", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: { backend: 99 } }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when a skill entry is an empty string", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: { backend: ["read-code", ""] } }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when a skill entry is not a string", () => {
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: { backend: [42] } }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("warns when a domain key is an empty string", () => {
		// Object.entries preserves the empty-string key
		const map: Record<string, unknown> = {};
		map[""] = ["read-code"];
		const { warnings } = validateProjectConfig(agentsCfg({ skillMap: map }));
		expect(warnings).toContainEqual(expect.stringContaining("skillMap"));
	});

	it("accumulates multiple warnings when multiple domains have invalid values", () => {
		const { warnings } = validateProjectConfig(agentsCfg({
			skillMap: {
				backend: "bad",
				frontend: [42, ""],
			},
		}));
		expect(warnings.filter((w) => w.includes("skillMap")).length).toBeGreaterThanOrEqual(3);
	});

	// ── regression: roster validation still works when skillMap also present ──

	it("still validates roster when skillMap is also present", () => {
		const { warnings } = validateProjectConfig(agentsCfg({
			roster: ["valid", ""],
			skillMap: { backend: ["read-code"] },
		}));
		expect(warnings).toContainEqual(expect.stringContaining("roster[1]"));
	});

	it("does not warn on valid roster when skillMap is also present", () => {
		const { warnings } = validateProjectConfig(agentsCfg({
			roster: ["Agent A", "Agent B"],
			skillMap: { backend: ["read-code"] },
		}));
		expect(warnings).toEqual([]);
	});

	it("produces no errors (only warnings possible)", () => {
		const { errors } = validateProjectConfig(agentsCfg({ skillMap: "bad" }));
		expect(errors).toEqual([]);
	});
});
