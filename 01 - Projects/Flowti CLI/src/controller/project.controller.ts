/**
 * project.controller.ts — Controller for project selection command.
 *
 * listProjects and getProjectPath are in domain/project/project.ts (pure).
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { renderInteractiveOnly, renderSuccess, type InteractiveOnlyModel, type SuccessModel } from "../ui/renderers/common-renderers.js";
import { writeReadme } from "../domain/project/readme-generator.js";

export const commands: Record<string, CommandHandler> = {
	project: adaptDescriptor<Record<string, unknown>, InteractiveOnlyModel>({
		handler: (_ctx) => ({
			command: "project",
			error: "Project selection is interactive. Run \"flowti\" without arguments to use the interactive menu.",
		}),
		renderer: renderInteractiveOnly,
	}),

	readme: adaptDescriptor<Record<string, unknown>, SuccessModel>({
		requires: "project",
		handler: (ctx) => {
			const readmePath = writeReadme(ctx.project!, ctx.deps);
			return { message: `README.md written to ${readmePath}` };
		},
		renderer: renderSuccess,
	}),
};
