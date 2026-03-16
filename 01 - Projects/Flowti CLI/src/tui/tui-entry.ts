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
import { VAULT_ROOT, CLI_PROJECT, cliConfig, loadJson } from "../infrastructure/config.js";
import type { ProjectConfig } from "../infrastructure/types-config.js";

// Import page modules to trigger self-registration
import "./pages/start-page.js";
import "./pages/ai-tools-page.js";
import "./pages/agent-detail-page.js";
import "./pages/project-detail-page.js";
import "./pages/health-page.js";
import "./pages/iterations-page.js";
import "./pages/resources-page.js";
import "./pages/timelog-page.js";
import "./pages/deliverables-page.js";
import "./pages/raid-page.js";
import "./pages/requirements-page.js";
import "./pages/capa-page.js";
import "./pages/lifecycle-page.js";

export async function runTui(): Promise<void> {
	const projectConfig = loadJson<ProjectConfig>(paths.join(CLI_PROJECT, "configs", "flowti.config.json"));

	const tuiContext: TuiContextValue = {
		deps: { disk, paths, clock, shell, log },
		vaultRoot: VAULT_ROOT,
		projectPath: CLI_PROJECT,
		agentsConfig: cliConfig.agents,
		iterationsConfig: projectConfig?.management?.iterations,
		projectConfig: projectConfig ?? undefined,
	};

	const instance = render(
		React.createElement(TuiProvider, { value: tuiContext },
			React.createElement(App),
		),
	);
	await instance.waitUntilExit();
}
