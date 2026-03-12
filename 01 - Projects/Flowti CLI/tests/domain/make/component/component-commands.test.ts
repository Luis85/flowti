import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));

import {
	buildVarsFromRecord,
	resolveBlueprint,
	parseJsonFile,
} from "../../../../src/domain/make/component/component-commands.js";

beforeEach(() => {
	vi.clearAllMocks();
});

// ── buildVarsFromRecord ──────────────────────────────────────────────

describe("buildVarsFromRecord", () => {
	it("derives pascal and camel from kebab", () => {
		const result = buildVarsFromRecord("UserProfile", "user-profile", {});
		expect(result.pascal).toBe("UserProfile");
		expect(result.camel).toBe("userProfile");
	});

	it("passes name and kebab through unchanged", () => {
		const result = buildVarsFromRecord("MyComp", "my-comp", {});
		expect(result.name).toBe("MyComp");
		expect(result.kebab).toBe("my-comp");
	});

	it("fills description from fields", () => {
		const result = buildVarsFromRecord("Button", "button", { description: "A clickable button" });
		expect(result.description).toBe("A clickable button");
	});

	it("fills technology from fields", () => {
		const result = buildVarsFromRecord("Api", "api", { technology: "Node.js" });
		expect(result.technology).toBe("Node.js");
	});

	it("fills owner from fields", () => {
		const result = buildVarsFromRecord("Widget", "widget", { owner: "platform-team" });
		expect(result.owner).toBe("platform-team");
	});

	it("fills containedBy from fields", () => {
		const result = buildVarsFromRecord("Service", "service", { containedBy: "api-gateway" });
		expect(result.containedBy).toBe("api-gateway");
	});

	it("fills domain from fields", () => {
		const result = buildVarsFromRecord("Card", "card", { domain: "payments" });
		expect(result.domain).toBe("payments");
	});

	it("fills storybookFramework from fields", () => {
		const result = buildVarsFromRecord("Modal", "modal", { storybookFramework: "react" });
		expect(result.storybookFramework).toBe("react");
	});

	it("defaults all optional fields to empty string when missing", () => {
		const result = buildVarsFromRecord("Plain", "plain", {});
		expect(result.description).toBe("");
		expect(result.technology).toBe("");
		expect(result.containedBy).toBe("");
		expect(result.owner).toBe("");
		expect(result.domain).toBe("");
		expect(result.storybookFramework).toBe("");
	});

	it("coerces non-string field values to string", () => {
		const result = buildVarsFromRecord("Num", "num", { description: 42, technology: true });
		expect(result.description).toBe("42");
		expect(result.technology).toBe("true");
	});

	it("handles multi-word kebab correctly for camel casing", () => {
		const result = buildVarsFromRecord("PaymentGateway", "payment-gateway", {});
		expect(result.pascal).toBe("PaymentGateway");
		expect(result.camel).toBe("paymentGateway");
	});
});

// ── resolveBlueprint ─────────────────────────────────────────────────

describe("resolveBlueprint", () => {
	it("returns a definition for the known kind 'component'", () => {
		const result = resolveBlueprint("component");
		expect(result).not.toBeNull();
		expect(result?.kind).toBe("component");
	});

	it("returns a definition for the known kind 'system'", () => {
		const result = resolveBlueprint("system");
		expect(result).not.toBeNull();
		expect(result?.kind).toBe("system");
	});

	it("returns a definition for the known kind 'person'", () => {
		const result = resolveBlueprint("person");
		expect(result).not.toBeNull();
		expect(result?.kind).toBe("person");
	});

	it("returns null for an unknown type", () => {
		const result = resolveBlueprint("does-not-exist");
		expect(result).toBeNull();
	});

	it("returns null for an empty string", () => {
		const result = resolveBlueprint("");
		expect(result).toBeNull();
	});
});

// ── parseJsonFile ────────────────────────────────────────────────────

describe("parseJsonFile", () => {
	it("parses valid JSON and returns the object", () => {
		const deps = {
			disk: {
				readFileSync: vi.fn().mockReturnValue('{"name":"Button","type":"component"}'),
			},
		};
		const result = parseJsonFile("/some/path/button.json", deps as never);
		expect(result).toEqual({ name: "Button", type: "component" });
	});

	it("returns null for invalid JSON", () => {
		const deps = {
			disk: {
				readFileSync: vi.fn().mockReturnValue("{ not valid json }"),
			},
		};
		const result = parseJsonFile("/some/path/broken.json", deps as never);
		expect(result).toBeNull();
	});

	it("returns null when readFileSync throws", () => {
		const deps = {
			disk: {
				readFileSync: vi.fn().mockImplementation(() => {
					throw new Error("File not found");
				}),
			},
		};
		const result = parseJsonFile("/nonexistent/file.json", deps as never);
		expect(result).toBeNull();
	});

	it("calls readFileSync with the provided filePath and utf-8 encoding", () => {
		const readFileSync = vi.fn().mockReturnValue("{}");
		const deps = { disk: { readFileSync } };
		parseJsonFile("/project/component.json", deps as never);
		expect(readFileSync).toHaveBeenCalledWith("/project/component.json", "utf-8");
	});

	it("returns null for an empty file (empty string is invalid JSON)", () => {
		const deps = {
			disk: {
				readFileSync: vi.fn().mockReturnValue(""),
			},
		};
		const result = parseJsonFile("/some/path/empty.json", deps as never);
		expect(result).toBeNull();
	});
});
