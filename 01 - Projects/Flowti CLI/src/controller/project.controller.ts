/**
 * project.controller.ts — Controller for project selection command.
 *
 * The startMenu function lives in ui/menus/project-menu.ts (interactive).
 * listProjects and getProjectPath are in domain/project/project.ts (pure).
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { startMenu } from "../ui/menus/project-menu.js";
import { renderInteractiveOnly, type InteractiveOnlyModel } from "../ui/common-renderers.js";

const actions: Record<string, ControllerAction> = {
	project: async (req) => {
		if (req.format === "json") {
			const model: InteractiveOnlyModel = { command: "project", error: "Project selector is interactive and cannot produce JSON output." };
			return dataResponse(model, renderInteractiveOnly);
		}
		await startMenu();
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
