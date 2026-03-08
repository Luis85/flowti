/**
 * make-commands.ts — Non-interactive CLI commands for in-project scaffolding.
 *
 * These commands are invoked from the command line (e.g., `flowti make:component --name=Button`).
 * Project creation is handled by the Scaffold domain — Make only provides
 * in-project boilerplate (journey, component).
 */

import { commands as componentCommands } from "./component/component-commands.js";
import { commands as editCommands } from "./component/component-edit.js";
import type { ProjectContext } from "../../infrastructure/types.js";

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	...componentCommands,
	...editCommands,
};
