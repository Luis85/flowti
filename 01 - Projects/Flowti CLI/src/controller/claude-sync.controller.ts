/**
 * claude-sync.controller.ts — Controller for claude:sync command.
 *
 * Synchronizes agent and tool definitions to .claude/skills/ so Claude Code
 * can discover and reference them on demand.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { VAULT_ROOT, cliConfig } from "../infrastructure/config.js";
import { listAgents } from "../domain/agents/agent-store.js";
import { loadAiTools } from "../domain/ai-tools/ai-tool-loader.js";
import { syncAllToClaude } from "../domain/claude-sync/claude-sync.js";
import { renderSuccess, type SuccessModel } from "../ui/renderers/common-renderers.js";

function resolveAgentsDir(deps: Pick<import("../infrastructure/deps.js").CliDeps, "paths">): string {
	return deps.paths.join(VAULT_ROOT, cliConfig.agents?.dir ?? "docs/agents");
}

export const commands: Record<string, CommandHandler> = {
	"claude:sync": adaptDescriptor<Record<string, unknown>, SuccessModel>({
		handler: (ctx) => {
			const agentsDir = resolveAgentsDir(ctx.deps);
			const agents = listAgents(ctx.deps, VAULT_ROOT, cliConfig.agents);
			const tools = loadAiTools(ctx.deps, VAULT_ROOT, ctx.deps.disk);
			const result = syncAllToClaude(ctx.deps, VAULT_ROOT, agentsDir, agents, tools, cliConfig.agents?.skillMap);
			return { message: `Synced ${result.written.length} skill files to .claude/` };
		},
		renderer: renderSuccess,
	}),
};
