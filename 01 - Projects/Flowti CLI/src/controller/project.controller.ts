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
import { renderInteractiveOnly, renderSuccess, renderNoProject, type InteractiveOnlyModel, type SuccessModel, type NoProjectModel } from "../ui/common-renderers.js";
import { writeReadme } from "../domain/project/readme-generator.js";

const actions: Record<string, ControllerAction> = {
	project: async (req) => {
		if (req.format === "json") {
			const model: InteractiveOnlyModel = { command: "project", error: "Project selector is interactive and cannot produce JSON output." };
			return dataResponse(model, renderInteractiveOnly);
		}
		await startMenu();
	},

	readme: (req) => {
		if (!req.project) {
			return dataResponse<NoProjectModel>({ command: "readme" }, renderNoProject);
		}
		const readmePath = writeReadme(req.project, req.deps);
		return dataResponse<SuccessModel>({ message: `README.md written to ${readmePath}` }, renderSuccess);
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
