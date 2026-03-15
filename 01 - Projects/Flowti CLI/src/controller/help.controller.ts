/**
 * help.controller.ts — Controller for the help command.
 *
 * Returns help content as structured data; rendering handled by ui/help.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { getHelp, getHelpSections } from "../ui/help-content.js";
import { renderHelp, type HelpModel } from "../ui/help.js";

export const commands: Record<string, CommandHandler> = {
	help: adaptDescriptor<Record<string, unknown>, HelpModel>({
		rawArgs: true,
		handler: (ctx) => {
			const section = (ctx.rawArgs?.[1] ?? "main").toLowerCase();
			const { disk, paths } = ctx.deps;
			const content = getHelp(section, { disk, paths });
			return { section, content, availableSections: getHelpSections({ disk, paths }) };
		},
		renderer: renderHelp,
	}),
};
