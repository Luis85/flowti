/**
 * obsidian-vault-provider.ts — Environment provider for Obsidian vault projects.
 *
 * Adds vault-specific tools: vault note operations, frontmatter assertions,
 * and vault structure verification. Does NOT require the Obsidian CLI.
 */

import type { EnvironmentProvider } from "../journey-environment.js";
import type { ToolExecutor } from "../journey-tools.js";
import { resolveString } from "../journey-tools.js";

/**
 * Tool: vault-note — create or verify a vault note.
 * Action: { tool: "vault-note", op: "create", path: "notes/test.md", content: "# Test" }
 * Action: { tool: "vault-note", op: "exists", path: "notes/test.md" }
 */
const toolVaultNote: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const op = action.op as string;
	const variables = opts.variables ?? {};
	const path = resolveString(action, "path", variables);

	if (!path) return { tool: "vault-note", success: false, error: "No path specified", durationMs: deps.clock.ms() - start };

	switch (op) {
		case "create": {
			const content = resolveString(action, "content", variables) || `# ${path.split("/").pop()?.replace(".md", "") ?? "Note"}\n`;
			try {
				deps.writeFile(path, content);
				return { tool: "vault-note", success: true, output: `Created: ${path}`, durationMs: deps.clock.ms() - start };
			} catch (e) {
				return { tool: "vault-note", success: false, error: String(e), durationMs: deps.clock.ms() - start };
			}
		}
		case "exists": {
			const exists = deps.exists(path);
			return { tool: "vault-note", success: exists, error: exists ? undefined : `Note not found: ${path}`, durationMs: deps.clock.ms() - start };
		}
		default:
			return { tool: "vault-note", success: false, error: `Unknown vault-note op: ${op}`, durationMs: deps.clock.ms() - start };
	}
};

/**
 * Tool: vault-structure — verify vault directory structure.
 * Action: { tool: "vault-structure", paths: [".obsidian", "notes/"] }
 */
const toolVaultStructure: ToolExecutor = (action, deps, opts) => {
	const start = deps.clock.ms();
	const expectedPaths = action.paths as string[] ?? [];
	const variables = opts.variables ?? {};
	const missing: string[] = [];

	for (const p of expectedPaths) {
		const resolved = resolveString({ tool: "vault-structure", path: p }, "path", variables);
		if (!deps.exists(resolved)) missing.push(resolved);
	}

	const success = missing.length === 0;
	return {
		tool: "vault-structure",
		success,
		output: success ? `All ${expectedPaths.length} paths exist` : `Missing: ${missing.join(", ")}`,
		error: success ? undefined : `${missing.length} path(s) missing`,
		durationMs: deps.clock.ms() - start,
	};
};

export function createObsidianVaultProvider(): EnvironmentProvider {
	return {
		target: "obsidian-vault",
		label: "Obsidian Vault",
		capabilities: ["command", "filesystem", "frontmatter", "vault-note", "vault-structure"],
		tools: {
			"vault-note": toolVaultNote,
			"vault-structure": toolVaultStructure,
		},
		setup(deps, opts) {
			const vaultRoot = opts.cwd ?? ".";
			const obsidianDir = `${vaultRoot}/.obsidian`;
			if (!deps.exists(obsidianDir)) {
				deps.mkdir(obsidianDir);
				deps.log(`[vault] Created .obsidian directory at ${obsidianDir}`);
			}
		},
	};
}
