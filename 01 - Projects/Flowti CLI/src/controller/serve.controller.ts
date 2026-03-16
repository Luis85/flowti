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

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import type { LogFn } from "../infrastructure/command-engine.js";
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

export interface ServeStatusModel {
	readonly running: boolean;
	readonly state: ServeStartModel | null;
}

function renderStart(model: ServeStartModel | ServeStopModel, log: LogFn): void {
	if ("url" in model) {
		log(`\n  Dashboard running at: ${model.url}`);
		log(`  Serving from: ${model.dir}\n`);
	}
}

function renderStatus(model: ServeStatusModel, log: LogFn): void {
	if (model.state) {
		log(`\n  Dashboard running at: ${model.state.url}\n`);
	} else {
		log(`\n  Dashboard is not running.\n`);
	}
}

// ── Controller commands ─────────────────────────────────────────────

const DEFAULT_PORT = 3000;
const DEFAULT_DIR = ".flowti/agents";

export const commands: Record<string, CommandHandler> = {
	"serve": adaptDescriptor<Record<string, unknown>, ServeStartModel | ServeStopModel>({
		flags: {
			port: { type: "number", default: DEFAULT_PORT, coerce: "int" },
			dir: { type: "string", default: DEFAULT_DIR },
		},
		handler: async (ctx) => {
			const { paths } = ctx.deps;
			const port = ctx.flags.port as number;
			const dirFlag = ctx.flags.dir as string;
			const rootDir = paths.isAbsolute(dirFlag) ? dirFlag : paths.resolve(dirFlag);

			const { VAULT_ROOT, PROJECTS_DIR, CLI_PROJECT, cliConfig } = await import("../infrastructure/config.js");

			const state = await startDashboardServer({
				port,
				rootDir,
				cliProjectPath: CLI_PROJECT,
				projectsDir: PROJECTS_DIR,
				vaultRoot: VAULT_ROOT,
				projectConfig: ctx.project?.config,
				vaultAgentsConfig: cliConfig.agents,
				worldState: ctx.deps.worldState,
				workerManager: ctx.deps.workerManager,
			}, ctx.deps);

			if (state) {
				return state;
			}
			return { stopped: false };
		},
		renderer: renderStart,
	}),

	"serve:stop": adaptDescriptor<Record<string, unknown>, ServeStopModel>({
		handler: (ctx) => {
			stopDashboard(ctx.deps.log);
			return { stopped: true };
		},
		renderer: () => {},
	}),

	"serve:status": adaptDescriptor<Record<string, unknown>, ServeStatusModel>({
		handler: () => {
			const state = getDashboardState();
			return { running: isDashboardRunning(), state };
		},
		renderer: renderStatus,
	}),
};
