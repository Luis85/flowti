/**
 * serve.controller.ts — Controller for the agent dashboard server.
 *
 * Non-blocking: starts the server in the background and returns.
 * The server is managed via start/stop actions from the main menu.
 *
 * The agent dashboard is opt-in via `agents.dashboard: true` in flowti.config.json.
 *
 * Usage:
 *   flowti serve [--port=3000] [--dir=.flowti/agents]
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { startDashboardServer, isDashboardRunning, stopDashboard, getDashboardState } from "../domain/serve/dashboard-service.js";

// ── Data models ──────────────────────────────────────────────────────

export interface ServeStartModel {
	readonly url: string;
	readonly port: number;
	readonly dir: string;
}

export interface ServeStopModel {
	readonly stopped: boolean;
}

function renderStart(model: ServeStartModel, log: (msg: string) => void): void {
	log(`\n  Dashboard running at: ${model.url}`);
	log(`  Serving from: ${model.dir}\n`);
}

// ── Controller actions ───────────────────────────────────────────────

const DEFAULT_PORT = 3000;
const DEFAULT_DIR = ".flowti/agents";

const actions: Record<string, ControllerAction> = {
	"serve": async (req) => {
		const { log, paths } = req.deps;
		const port = typeof req.flags.port === "string" ? parseInt(req.flags.port, 10) || DEFAULT_PORT : DEFAULT_PORT;
		const dirFlag = typeof req.flags.dir === "string" ? req.flags.dir : DEFAULT_DIR;
		const rootDir = paths.isAbsolute(dirFlag) ? dirFlag : paths.resolve(dirFlag);

		const { VAULT_ROOT, PROJECTS_DIR, CLI_PROJECT, cliConfig } = await import("../infrastructure/config.js");

		const state = await startDashboardServer({
			port,
			rootDir,
			cliProjectPath: CLI_PROJECT,
			projectsDir: PROJECTS_DIR,
			vaultRoot: VAULT_ROOT,
			projectConfig: req.project?.config,
			vaultAgentsConfig: cliConfig.agents,
		}, req.deps);

		if (state) {
			return dataResponse<ServeStartModel>(state, (d) => renderStart(d, log));
		}
		return dataResponse<ServeStopModel>({ stopped: false }, () => {});
	},

	"serve:stop": (req) => {
		stopDashboard(req.deps.log);
		return dataResponse<ServeStopModel>({ stopped: true }, () => {});
	},

	"serve:status": (req) => {
		const state = getDashboardState();
		if (state) {
			req.deps.log(`\n  Dashboard running at: ${state.url}\n`);
		} else {
			req.deps.log(`\n  Dashboard is not running.\n`);
		}
		return dataResponse({ running: isDashboardRunning(), state }, () => {});
	},
};

// ── Adapted commands ─────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
