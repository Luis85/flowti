/**
 * claude-sync.controller.ts — Controller for claude:sync command.
 *
 * Synchronizes agent and tool definitions to .claude/skills/ so Claude Code
 * can discover and reference them on demand.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { VAULT_ROOT, cliConfig } from "../infrastructure/config.js";
import { listAgents } from "../domain/agents/agent-store.js";
import { loadAiTools } from "../domain/ai-tools/ai-tool-loader.js";
import { syncAllToClaude } from "../domain/claude-sync/claude-sync.js";
import { renderSuccess, type SuccessModel } from "../ui/renderers/common-renderers.js";

function resolveAgentsDir(deps: Pick<import("../infrastructure/deps.js").CliDeps, "paths">): string {
	return deps.paths.join(VAULT_ROOT, cliConfig.agents?.dir ?? "docs/agents");
}

const actions: Record<string, ControllerAction> = {
	"claude:sync": (req) => {
		const agentsDir = resolveAgentsDir(req.deps);
		const agents = listAgents(req.deps, VAULT_ROOT, cliConfig.agents);
		const tools = loadAiTools(req.deps, VAULT_ROOT, req.deps.disk);
		const result = syncAllToClaude(req.deps, VAULT_ROOT, agentsDir, agents, tools, cliConfig.agents?.skillMap);
		return dataResponse<SuccessModel>(
			{ message: `Synced ${result.written.length} skill files to .claude/` },
			(d) => renderSuccess(req.deps.log, d),
		);
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
