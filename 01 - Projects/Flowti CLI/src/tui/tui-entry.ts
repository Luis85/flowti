/**
 * tui-entry.ts — Boots the Ink TUI application.
 *
 * Imports infrastructure singletons and wraps App in TuiProvider.
 * Page modules are imported here to trigger self-registration.
 */

import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { TuiProvider } from "./context.js";
import type { TuiContextValue } from "./context.js";
import { disk } from "../infrastructure/filesystem.js";
import { shell } from "../infrastructure/shell.js";
import { paths } from "../infrastructure/paths.js";
import { clock } from "../infrastructure/clock.js";
import { log } from "../infrastructure/logger.js";
import { VAULT_ROOT, CLI_PROJECT, PROJECTS_DIR, cliConfig, loadJson } from "../infrastructure/config.js";
import type { ProjectConfig } from "../infrastructure/types-config.js";
import { createProcessRunner } from "../infrastructure/agent-process-runner.js";
import { createProviderRegistry } from "../infrastructure/llm/provider-registry.js";
import { createClaudeProvider } from "../infrastructure/llm/claude-provider.js";
import { createCursorProvider } from "../infrastructure/llm/cursor-provider.js";
import { createOllamaProvider } from "../infrastructure/llm/ollama-provider.js";
import { loadSitemap } from "../infrastructure/sitemap-loader.js";
import { TuiHandlerRegistry } from "./registry/tui-handler-registry.js";
import { createSessionStore } from "./registry/tui-session-store.js";
import { registerTuiHandlers } from "./registry/register-tui-handlers.js";

// Import custom override pages to trigger self-registration
// (all other pages are now rendered by SitemapPage via sitemap.json)
import "./pages/onboarding-page.js";
import "./pages/onboarding-tour-page.js";
import "./pages/agents-chat-page.js";

export async function runTui(): Promise<void> {
	const projectConfig = loadJson<ProjectConfig>(paths.join(CLI_PROJECT, "configs", "flowti.config.json"));

	const baseDeps = { disk, paths, clock, shell, log };
	const providerRegistry = createProviderRegistry();
	providerRegistry.register(createClaudeProvider(baseDeps));
	if (shell.check?.("cursor --version")) providerRegistry.register(createCursorProvider(baseDeps));
	providerRegistry.register(createOllamaProvider());
	const processRunner = createProcessRunner(baseDeps, cliConfig.agents, providerRegistry);

	// Load sitemap
	const sitemapResult = loadSitemap(
		paths.join(CLI_PROJECT, "configs", "sitemap.json"),
		disk,
	);
	const sitemap = sitemapResult.sitemap ?? { version: 2 as const, pages: {} };

	// Create TUI infrastructure
	const tuiRegistry = new TuiHandlerRegistry();
	const session = createSessionStore();
	const actionDeps = { disk, paths, clock, shell };

	// Register all TUI handlers
	registerTuiHandlers(tuiRegistry);

	const tuiContext: TuiContextValue = {
		deps: { disk, paths, clock, shell, log },
		vaultRoot: VAULT_ROOT,
		projectPath: CLI_PROJECT,
		projectsDir: PROJECTS_DIR,
		agentsConfig: cliConfig.agents,
		iterationsConfig: projectConfig?.management?.iterations,
		projectConfig: projectConfig ?? undefined,
		processRunner,
		providerRegistry,
		sitemap,
		tuiRegistry,
		session,
		actionDeps,
	};

	const instance = render(
		React.createElement(TuiProvider, { value: tuiContext },
			React.createElement(App),
		),
	);
	await instance.waitUntilExit();
}
