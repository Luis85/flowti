/**
 * Build Agent markdown + optional companion JSON for vault `03 - Resources/Agents`.
 * Shape matches {@link parseFrontmatter} in game/agent-markdown-roster.
 */

import type { AgentBlueprint, TeamRoleSlot } from "./types.js";
import { agentNoteBasename } from "./team-roster.js";

function yamlEscape(s: string): string {
	if (/[#:[\]{},&*!|>'"%@`]/.test(s) || s.includes("\n")) return JSON.stringify(s);
	return s;
}

function emitAttributes(attrs: Record<string, number>): string[] {
	const lines = ["attributes:"];
	for (const k of ["str", "int", "wis", "cha", "dex", "con"] as const) {
		if (attrs[k] != null) lines.push(`  ${k}: ${attrs[k]}`);
	}
	return lines;
}

/** Serialize blueprint + name into markdown body + frontmatter block. */
/** Markdown body after the closing `---` of agent frontmatter (description / freeform content). */
export function bodyAfterAgentFrontmatter(md: string): string {
	const m = md.match(/^---\r?\n[\s\S]*?\r?\n---\s*\r?\n([\s\S]*)$/);
	return (m ? m[1] : md).trim();
}

export function buildAgentMarkdownFile(name: string, blueprint: AgentBlueprint | undefined): string {
	const bp = blueprint ?? {};
	const lines: string[] = ["---", "type: Agent", `name: ${yamlEscape(name)}`];
	const agentType = typeof bp.agentType === "string" && bp.agentType ? bp.agentType : "ai";
	lines.push(`agentType: ${yamlEscape(agentType)}`);
	if (typeof bp.domain === "string" && bp.domain) lines.push(`domain: ${yamlEscape(bp.domain)}`);
	if (typeof bp.persona === "string" && bp.persona) lines.push(`persona: ${yamlEscape(bp.persona)}`);
	if (typeof bp.mood === "string" && bp.mood) lines.push(`mood: ${yamlEscape(bp.mood)}`);
	if (Array.isArray(bp.personality) && bp.personality.length > 0) {
		lines.push("personality:");
		for (const p of bp.personality) lines.push(`  - ${yamlEscape(String(p))}`);
	}
	if (bp.attributes && typeof bp.attributes === "object") {
		const a = bp.attributes as Record<string, number>;
		const nums: Record<string, number> = {};
		for (const k of ["str", "int", "wis", "cha", "dex", "con"] as const) {
			if (typeof a[k] === "number") nums[k] = a[k];
		}
		if (Object.keys(nums).length > 0) lines.push(...emitAttributes(nums));
	}
	if (Array.isArray(bp.skills) && bp.skills.length > 0) {
		lines.push("skills:");
		for (const s of bp.skills) lines.push(`  - ${yamlEscape(String(s))}`);
	}
	if (Array.isArray(bp.behaviors) && bp.behaviors.length > 0) {
		lines.push("behaviors:");
		for (const b of bp.behaviors) lines.push(`  - ${yamlEscape(String(b))}`);
	}
	if (Array.isArray(bp.suggestedTasks) && bp.suggestedTasks.length > 0) {
		lines.push("suggestedTasks:");
		for (const t of bp.suggestedTasks) lines.push(`  - ${yamlEscape(String(t))}`);
	}
	lines.push("---", "", typeof bp.description === "string" && bp.description ? bp.description : `Agent **${name}** — created from project team role.`, "");
	return lines.join("\n");
}

const DEFAULT_TRUST_PERMISSIONS = { mode: "trust" as const };

/** Goals, ai config, and other companion fields not stored in frontmatter. */
export function buildAgentCompanionJson(blueprint: AgentBlueprint | undefined): string | null {
	const goals =
		blueprint?.goals && Array.isArray(blueprint.goals)
			? blueprint.goals
				.filter((g): g is { name: string; priority?: number } => g && typeof (g as { name?: string }).name === "string")
				.map((g) => ({ name: g.name, priority: typeof g.priority === "number" ? g.priority : 0 }))
			: [];
	const ai = blueprint?.ai;
	let aiOut: Record<string, unknown> | undefined;
	if (ai && typeof ai === "object") {
		const permissions =
			ai.permissions?.mode === "ask" || ai.permissions?.mode === "auto-allow" || ai.permissions?.mode === "trust"
				? { mode: ai.permissions.mode }
				: DEFAULT_TRUST_PERMISSIONS;
		aiOut = {
			permissions,
			...(typeof ai.provider === "string" && ai.provider.trim() ? { provider: ai.provider.trim() } : {}),
			...(typeof ai.systemPrompt === "string" && ai.systemPrompt.trim() ? { systemPrompt: ai.systemPrompt } : {}),
			...(Array.isArray(ai.allowedTools) && ai.allowedTools.length > 0 ? { allowedTools: [...ai.allowedTools] } : {}),
		};
	}
	const globs =
		blueprint?.cursorRuleGlobs?.filter((g) => typeof g === "string" && g.trim()) ?? [];
	const hasGoals = goals.length > 0;
	const hasAi = aiOut && Object.keys(aiOut).length > 0;
	const hasGlobs = globs.length > 0;
	if (!hasGoals && !hasAi && !hasGlobs) return null;
	const payload: Record<string, unknown> = {};
	if (hasGoals) payload.goals = goals;
	if (hasAi) payload.ai = aiOut;
	if (hasGlobs) payload.cursorRuleGlobs = globs;
	return JSON.stringify(payload, null, "\t");
}

export function agentVaultPaths(displayName: string): { md: string; json: string } {
	const base = agentNoteBasename(displayName);
	return {
		md: `03 - Resources/Agents/${base}.md`,
		json: `03 - Resources/Agents/${base}.json`,
	};
}

/**
 * Combine optional JSON blueprint with requirements from the ProjectRole note (skills + description).
 * Explicit blueprint fields win when set; skills/description fall back to role note data.
 */
export function mergeAgentBlueprintFromRoleSlot(slot: TeamRoleSlot): AgentBlueprint {
	const fromRoleSkills = slot.roleSkills?.length ? [...slot.roleSkills] : undefined;
	const parts: string[] = [];
	if (slot.roleSummary?.trim()) parts.push(slot.roleSummary.trim());
	if (slot.roleBody?.trim()) parts.push(slot.roleBody.trim());
	const fromRoleDesc = parts.length ? parts.join("\n\n") : undefined;
	const fromRole: AgentBlueprint = {
		...(fromRoleSkills ? { skills: fromRoleSkills } : {}),
		...(fromRoleDesc ? { description: fromRoleDesc } : {}),
	};
	const bp = slot.blueprint;
	if (!bp || Object.keys(bp).length === 0) return fromRole;
	const mergedSkills = bp.skills?.length ? bp.skills : fromRole.skills;
	const mergedDescription =
		typeof bp.description === "string" && bp.description.trim() ? bp.description : fromRole.description;
	return {
		...fromRole,
		...bp,
		...(mergedSkills ? { skills: mergedSkills } : {}),
		...(mergedDescription ? { description: mergedDescription } : {}),
	};
}
