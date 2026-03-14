/**
 * info.controller.ts — Controller for project info display.
 *
 * Returns typed data models; rendering is handled by ui/info-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { collectProjectInfo } from "../domain/info/info.js";
import { displayInfo } from "../ui/displays/info-display.js";
import { renderNoProject, type NoProjectModel } from "../ui/renderers/common-renderers.js";

// ── Helpers ─────────────────────────────────────────────────────────

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	info: (req) => {
		const { log } = req.deps;
		if (!req.project) return dataResponse<NoProjectModel>({ command: "info" }, (d) => renderNoProject(log, d));
		const { disk, paths, shell } = req.deps;
		const model = collectProjectInfo(req.project, { disk, paths, shell });
		return dataResponse(model, (d) => displayInfo(log, d));
	},
};

// ── Adapted commands ────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
