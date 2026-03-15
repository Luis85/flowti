/**
 * project.controller.ts — Controller for project selection command.
 *
 * listProjects and getProjectPath are in domain/project/project.ts (pure).
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { renderInteractiveOnly, renderSuccess, renderNoProject, type InteractiveOnlyModel, type SuccessModel, type NoProjectModel } from "../ui/renderers/common-renderers.js";
import { writeReadme } from "../domain/project/readme-generator.js";

const actions: Record<string, ControllerAction> = {
	project: (req) => {
		const { log } = req.deps;
		const model: InteractiveOnlyModel = { command: "project", error: "Project selection is interactive. Run \"flowti\" without arguments to use the interactive menu." };
		return dataResponse(model, (d) => renderInteractiveOnly(d, log));
	},

	readme: (req) => {
		const { log } = req.deps;
		if (!req.project) {
			return dataResponse<NoProjectModel>({ command: "readme" }, (d) => renderNoProject(d, log));
		}
		const readmePath = writeReadme(req.project, req.deps);
		return dataResponse<SuccessModel>({ message: `README.md written to ${readmePath}` }, (d) => renderSuccess(d, log));
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
