/**
 * permission-engine.ts — Pure permission logic for agent tool calls.
 *
 * No I/O. Receives all data as arguments, returns verdicts.
 */

import type { AgentPermissionPolicy, PermissionMode } from "./agent-types.js";

export interface PermissionGrant {
	readonly tool: string;
	readonly scope: "once" | "always";
	readonly grantedAt: string;
	readonly grantedBy: "user" | "policy";
}

export type PermissionVerdict = "allowed" | "denied" | "prompt-user" | "queued";

export const DEFAULT_SAFE_TOOLS: readonly string[] = ["Read", "Glob", "Grep", "LS", "WebSearch", "WebFetch"];

export function resolvePermissionPolicy(
	definition: AgentPermissionPolicy | undefined,
	stateOverride: PermissionMode | undefined,
): AgentPermissionPolicy {
	const base = definition ?? { mode: "ask" as const };
	if (stateOverride) return { ...base, mode: stateOverride };
	return base;
}

function safeTools(policy: AgentPermissionPolicy): readonly string[] {
	return policy.autoAllowTools ?? DEFAULT_SAFE_TOOLS;
}

export function resolveAllowedTools(
	policy: AgentPermissionPolicy,
	grants: readonly PermissionGrant[],
	availableTools: readonly string[],
): string[] {
	const available = new Set(availableTools);
	if (policy.mode === "trust") return [...available];
	const allowed = new Set<string>();
	const grantedTools = grants.map((g) => g.tool);
	if (policy.mode === "auto-allow") {
		for (const tool of safeTools(policy)) { if (available.has(tool)) allowed.add(tool); }
	}
	for (const tool of grantedTools) { if (available.has(tool)) allowed.add(tool); }
	return [...allowed];
}

export function checkPermission(
	policy: AgentPermissionPolicy,
	grants: readonly PermissionGrant[],
	tool: string,
	foreground: boolean,
): PermissionVerdict {
	if (policy.mode === "trust") return "allowed";
	if (grants.some((g) => g.tool === tool && g.scope === "always")) return "allowed";
	if (policy.mode === "auto-allow" && safeTools(policy).includes(tool)) return "allowed";
	return foreground ? "prompt-user" : "queued";
}
