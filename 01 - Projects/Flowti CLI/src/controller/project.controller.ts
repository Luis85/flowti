/**
 * project.controller.ts — Controller for project selection command.
 *
 * The startMenu, listProjects, and getProjectPath functions remain
 * in domain/project/project.ts as they serve both interactive and
 * non-interactive flows.
 */

import type { CommandHandler } from "../infrastructure/types.js";
import { startMenu } from "../ui/menus/project-menu.js";

export const commands: Record<string, CommandHandler> = {
	project: async () => { await startMenu(); },
};
