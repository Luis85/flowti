/**
 * chat-handlers.ts — Sitemap view handler for the agents-chat page.
 *
 * Lazy-loads ink and the ChatShell to avoid pulling React into non-chat paths.
 * Resolves the agent from params, builds ChatShellDeps, and starts the session.
 */

import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import type { IChatRenderer } from "../../infrastructure/chat/chat-renderer-types.js";
import { VAULT_ROOT, cliConfig } from "../../infrastructure/config.js";

/** Load InkChatRenderer via dynamic import (bundled in the single ESM bundle). */
async function defaultLoadRenderer(): Promise<{ InkChatRenderer: new () => IChatRenderer }> {
	return await import("../../infrastructure/chat/ink-chat-renderer.js") as { InkChatRenderer: new () => IChatRenderer };
}

export type ChatRendererLoader = () => Promise<{ InkChatRenderer: new () => IChatRenderer }>;

export function registerChatHandlers(registry: HandlerRegistry, loadRenderer: ChatRendererLoader = defaultLoadRenderer): void {
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

		// Lazy-load ChatShell (bundled in main.js)
		const { ChatShell } = await import("../menus/chat-shell.js");

		// Load InkChatRenderer from the separate ESM chat bundle.
		// CJS can't require() ink (ESM + top-level await), but import() works.
		const { InkChatRenderer } = await loadRenderer();

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
