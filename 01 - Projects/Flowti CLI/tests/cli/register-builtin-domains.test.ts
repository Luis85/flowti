import { describe, it, expect } from "vitest";
import { CommandRegistry } from "../../src/infrastructure/command-registry.js";
import { registerBuiltinDomains } from "../../src/cli/register-builtin-domains.js";

describe("registerBuiltinDomains", () => {
	it("registers reports, docs, report wildcard, and docs:cli-surface", () => {
		const r = new CommandRegistry();
		registerBuiltinDomains(r);
		const keys = new Set(r.keys());
		expect(keys.has("reports")).toBe(true);
		expect(keys.has("docs")).toBe(true);
		expect(keys.has("report:*")).toBe(true);
		expect(keys.has("docs:cli-surface")).toBe(true);
		expect(r.wildcardPrefix).toBe("report:");
	});
});
