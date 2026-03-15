import { describe, it, expect } from "vitest";
import {
	DEFAULT_SAFE_TOOLS,
	resolvePermissionPolicy,
	resolveAllowedTools,
	checkPermission,
} from "../../../src/domain/agents/permission-engine.js";
import type { AgentPermissionPolicy, PermissionMode } from "../../../src/domain/agents/agent-types.js";
import type { PermissionGrant } from "../../../src/domain/agents/permission-engine.js";

describe("DEFAULT_SAFE_TOOLS", () => {
	it("includes read-only tools", () => {
		expect(DEFAULT_SAFE_TOOLS).toContain("Read");
		expect(DEFAULT_SAFE_TOOLS).toContain("Glob");
		expect(DEFAULT_SAFE_TOOLS).toContain("Grep");
	});
	it("does not include write tools", () => {
		expect(DEFAULT_SAFE_TOOLS).not.toContain("Edit");
		expect(DEFAULT_SAFE_TOOLS).not.toContain("Write");
		expect(DEFAULT_SAFE_TOOLS).not.toContain("Bash");
	});
});

describe("resolvePermissionPolicy", () => {
	it("uses state override when present", () => {
		const definition: AgentPermissionPolicy = { mode: "ask" };
		const result = resolvePermissionPolicy(definition, "trust");
		expect(result.mode).toBe("trust");
	});
	it("falls back to definition when no override", () => {
		const definition: AgentPermissionPolicy = { mode: "auto-allow", autoAllowTools: ["Read"] };
		const result = resolvePermissionPolicy(definition, undefined);
		expect(result.mode).toBe("auto-allow");
		expect(result.autoAllowTools).toEqual(["Read"]);
	});
	it("falls back to ask when no definition", () => {
		const result = resolvePermissionPolicy(undefined, undefined);
		expect(result.mode).toBe("ask");
	});
	it("preserves autoAllowTools from definition when override only changes mode", () => {
		const definition: AgentPermissionPolicy = { mode: "ask", autoAllowTools: ["Read", "Edit"] };
		const result = resolvePermissionPolicy(definition, "auto-allow");
		expect(result.mode).toBe("auto-allow");
		expect(result.autoAllowTools).toEqual(["Read", "Edit"]);
	});
});

describe("resolveAllowedTools", () => {
	const policy = (mode: PermissionMode, tools?: string[]): AgentPermissionPolicy => ({ mode, autoAllowTools: tools });

	it("trust mode passes all available tools", () => {
		const result = resolveAllowedTools(policy("trust"), [], ["Read", "Edit", "Bash"]);
		expect(result).toEqual(["Read", "Edit", "Bash"]);
	});
	it("auto-allow passes safe tools + always grants", () => {
		const grants: PermissionGrant[] = [{ tool: "Edit", scope: "always", grantedAt: "", grantedBy: "user" }];
		const result = resolveAllowedTools(policy("auto-allow", ["Read", "Glob"]), grants, ["Read", "Glob", "Edit", "Bash"]);
		expect(result).toContain("Read");
		expect(result).toContain("Glob");
		expect(result).toContain("Edit");
		expect(result).not.toContain("Bash");
	});
	it("auto-allow uses DEFAULT_SAFE_TOOLS when autoAllowTools absent", () => {
		const result = resolveAllowedTools(policy("auto-allow"), [], ["Read", "Glob", "Edit"]);
		expect(result).toContain("Read");
		expect(result).toContain("Glob");
		expect(result).not.toContain("Edit");
	});
	it("ask mode passes only always grants", () => {
		const grants: PermissionGrant[] = [{ tool: "Read", scope: "always", grantedAt: "", grantedBy: "user" }];
		const result = resolveAllowedTools(policy("ask"), grants, ["Read", "Edit"]);
		expect(result).toEqual(["Read"]);
	});
	it("ask mode with no grants returns empty", () => {
		const result = resolveAllowedTools(policy("ask"), [], ["Read", "Edit"]);
		expect(result).toEqual([]);
	});
	it("intersects with available tools", () => {
		const grants: PermissionGrant[] = [{ tool: "Bash", scope: "always", grantedAt: "", grantedBy: "user" }];
		const result = resolveAllowedTools(policy("auto-allow", ["Read"]), grants, ["Read"]);
		expect(result).toEqual(["Read"]);
		expect(result).not.toContain("Bash");
	});
	it("once-scoped grants are included", () => {
		const grants: PermissionGrant[] = [{ tool: "Edit", scope: "once", grantedAt: "", grantedBy: "user" }];
		const result = resolveAllowedTools(policy("ask"), grants, ["Edit"]);
		expect(result).toEqual(["Edit"]);
	});
});

describe("checkPermission", () => {
	const policy = (mode: PermissionMode, tools?: string[]): AgentPermissionPolicy => ({ mode, autoAllowTools: tools });

	it("trust mode always allows", () => {
		expect(checkPermission(policy("trust"), [], "Bash", true)).toBe("allowed");
		expect(checkPermission(policy("trust"), [], "Bash", false)).toBe("allowed");
	});
	it("always grant allows regardless of mode", () => {
		const grants: PermissionGrant[] = [{ tool: "Edit", scope: "always", grantedAt: "", grantedBy: "user" }];
		expect(checkPermission(policy("ask"), grants, "Edit", true)).toBe("allowed");
	});
	it("auto-allow allows safe tools", () => {
		expect(checkPermission(policy("auto-allow", ["Read", "Glob"]), [], "Read", true)).toBe("allowed");
	});
	it("auto-allow prompts for non-safe tools in foreground", () => {
		expect(checkPermission(policy("auto-allow", ["Read"]), [], "Bash", true)).toBe("prompt-user");
	});
	it("auto-allow queues non-safe tools in background", () => {
		expect(checkPermission(policy("auto-allow", ["Read"]), [], "Bash", false)).toBe("queued");
	});
	it("ask mode prompts in foreground", () => {
		expect(checkPermission(policy("ask"), [], "Read", true)).toBe("prompt-user");
	});
	it("ask mode queues in background", () => {
		expect(checkPermission(policy("ask"), [], "Read", false)).toBe("queued");
	});
	it("uses DEFAULT_SAFE_TOOLS when autoAllowTools absent in auto-allow", () => {
		expect(checkPermission(policy("auto-allow"), [], "Read", true)).toBe("allowed");
		expect(checkPermission(policy("auto-allow"), [], "Edit", true)).toBe("prompt-user");
	});
});
