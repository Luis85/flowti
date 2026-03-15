/**
 * info.controller.ts — Controller for project info display.
 *
 * Returns typed data models; rendering is handled by ui/info-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { collectProjectInfo } from "../domain/info/info.js";
import { displayInfo } from "../ui/displays/info-display.js";

export const commands: Record<string, CommandHandler> = {
	info: adaptDescriptor({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell } = ctx.deps;
			return collectProjectInfo(ctx.project!, { disk, paths, shell });
		},
		renderer: displayInfo,
	}),
};
