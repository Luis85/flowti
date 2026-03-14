/**
 * help.controller.ts — Controller for the help command.
 *
 * Returns help content as structured data; rendering handled by ui/help.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { getHelp, getHelpSections } from "../ui/help-content.js";
import { renderHelp, type HelpModel } from "../ui/help.js";

const actions: Record<string, ControllerAction> = {
	help: (req) => {
		const section = (Object.keys(req.flags)[0] ?? req.rawArgs?.[1] ?? "main").toLowerCase();
		const { disk, paths, log } = req.deps;
		const content = getHelp(section, { disk, paths });
		const model: HelpModel = { section, content, availableSections: getHelpSections({ disk, paths }) };
		return dataResponse(model, (d) => renderHelp(d, log));
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
