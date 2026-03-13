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
		const content = getHelp(section);
		const model: HelpModel = { section, content, availableSections: getHelpSections() };
		return dataResponse(model, renderHelp);
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
