/**
 * serve.controller.ts — Controller for the static file server.
 *
 * Starts a zero-dependency HTTP server from a configurable directory.
 * Keeps the server alive until the user presses Enter or Ctrl+C.
 *
 * Usage:
 *   flowti serve [--port=3000] [--dir=.flowti/site]
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { startServer, openInBrowser } from "../domain/serve/static-server.js";
import type { ServerHandle } from "../domain/serve/static-server.js";

// ── Data model ───────────────────────────────────────────────────────

export interface ServeModel {
	readonly url: string;
	readonly port: number;
	readonly dir: string;
}

function renderServe(model: ServeModel, log: (msg: string) => void): void {
	log(`\nServing static files from: ${model.dir}`);
	log(`Server running at: ${model.url}`);
	log(`\nPress Enter to stop the server.\n`);
}

// ── Controller actions ───────────────────────────────────────────────

const DEFAULT_PORT = 3000;
const DEFAULT_DIR = ".flowti/site";

const actions: Record<string, ControllerAction> = {
	"serve": async (req) => {
		const { log, input, paths } = req.deps;
		const port = typeof req.flags.port === "string" ? parseInt(req.flags.port, 10) || DEFAULT_PORT : DEFAULT_PORT;
		const dirFlag = typeof req.flags.dir === "string" ? req.flags.dir : DEFAULT_DIR;
		const rootDir = paths.isAbsolute(dirFlag) ? dirFlag : paths.resolve(dirFlag);

		let handle: ServerHandle | undefined;
		try {
			handle = await startServer({ port, dir: rootDir }, {
				disk: req.deps.disk,
				paths: req.deps.paths,
				shell: req.deps.shell,
				log: req.deps.log,
			});

			openInBrowser(handle.url, req.deps.shell);

			const model: ServeModel = { url: handle.url, port, dir: rootDir };
			renderServe(model, log);

			await input.waitForEnter();
		} finally {
			handle?.close();
		}

		log("Server stopped.");
		return dataResponse({ stopped: true }, () => {});
	},
};

// ── Adapted commands ─────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
