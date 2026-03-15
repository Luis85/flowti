/**
 * chat-handlers.ts — Sitemap view handler for the agents-chat page.
 *
 * Lazy-loads ink and the ChatShell to avoid pulling React into non-chat paths.
 * Resolves the agent from params, builds ChatShellDeps, and starts the session.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { VAULT_ROOT, cliConfig } from "../../infrastructure/config.js";

export function registerChatHandlers(registry: HandlerRegistry): void {
	registry.registerView("agents-chat", async (ctx) => {
		const agentName = ctx.params?.agentName as string | undefined;
		if (!agentName) return "main" as MenuResult;

		// Resolve agent from roster
		const { findAgent } = await import("../../domain/agents/agent-store.js");
		const agent = findAgent(ctx.deps, VAULT_ROOT, agentName, cliConfig.agents);
		if (!agent) {
			ctx.deps.log(`\n  Agent "${agentName}" not found.\n`);
			return "main" as MenuResult;
		}

		// Lazy-load ink renderer and ChatShell to keep React out of non-chat paths
		const { InkChatRenderer } = await import("../../infrastructure/chat/ink-chat-renderer.js");
		const { ChatShell } = await import("../menus/chat-shell.js");

		const projectPath = ctx.project?.path ?? VAULT_ROOT;

		const chatDeps = {
			disk: ctx.deps.disk,
			paths: ctx.deps.paths,
			clock: ctx.deps.clock,
			shell: ctx.deps.shell,
			log: ctx.deps.log,
			processRunner: ctx.deps.processRunner,
		};

		const renderer = new InkChatRenderer();
		const shell = new ChatShell(renderer, agent, chatDeps, VAULT_ROOT, projectPath);
		return shell.start();
	});
}
