/**
 * Write Flowti-managed Cursor IDE rules (`.cursor/rules/*.mdc`) next to a configurable workspace root.
 */

import { mkdirSync, writeFileSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { agentNoteBasename } from "../../domain/projects/team-roster.js";

const FLOWTI_MDC_MARKER = "<!-- flowti-agent-rule -->";

export interface CursorRuleExportInput {
	readonly displayName: string;
	readonly persona?: string;
	readonly systemPrompt?: string;
	readonly vaultAgentMdPath: string;
	readonly globs?: readonly string[];
}

function escapeYamlString(s: string): string {
	if (/[#:[\]{},&*!|>'"%@`]/.test(s) || s.includes("\n")) return JSON.stringify(s);
	return s;
}

/** Build `.mdc` body: marker + prompt + vault pointer. */
export function buildCursorMdcContent(input: CursorRuleExportInput): string {
	const desc = input.persona?.trim() || input.displayName.trim() || "Flowti agent";
	const lines: string[] = [
		"---",
		`description: ${escapeYamlString(desc)}`,
	];
	if (input.globs && input.globs.length > 0) {
		lines.push("globs:");
		for (const g of input.globs) {
			const t = g.trim();
			if (t) lines.push(`  - ${escapeYamlString(t)}`);
		}
	}
	lines.push("---", "", FLOWTI_MDC_MARKER, "");
	const prompt = input.systemPrompt?.trim() ?? "";
	if (prompt) lines.push(prompt, "");
	lines.push(`_Vault agent note: \`${input.vaultAgentMdPath}\`_`, "");
	return lines.join("\n");
}

function slugFromDisplayName(displayName: string): string {
	return agentNoteBasename(displayName);
}

/**
 * Write `<slug>.mdc` under `<workspaceRoot>/.cursor/rules/`. Creates directories as needed.
 */
export function writeCursorAgentRuleFile(workspaceRoot: string, input: CursorRuleExportInput): void {
	const rulesDir = join(workspaceRoot, ".cursor", "rules");
	mkdirSync(rulesDir, { recursive: true });
	const slug = slugFromDisplayName(input.displayName);
	const filePath = join(rulesDir, `${slug}.mdc`);
	writeFileSync(filePath, buildCursorMdcContent(input), "utf-8");
}

/** Remove Flowti-generated `.mdc` when the marker is present (avoids deleting user-authored rules). */
export function removeCursorAgentRuleFileIfFlowti(workspaceRoot: string, displayName: string): void {
	const slug = slugFromDisplayName(displayName);
	const filePath = join(workspaceRoot, ".cursor", "rules", `${slug}.mdc`);
	if (!existsSync(filePath)) return;
	try {
		const text = readFileSync(filePath, "utf-8");
		if (text.includes(FLOWTI_MDC_MARKER)) unlinkSync(filePath);
	} catch { /* ignore */ }
}
