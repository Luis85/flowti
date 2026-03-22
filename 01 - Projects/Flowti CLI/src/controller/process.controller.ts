/**
 * process.controller.ts — Process registry commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { listProcesses } from "../domain/processes/process-registry.js";
import { renderProcessList } from "../ui/renderers/process-renderers.js";
import type { ProcessListResultModel } from "../ui/renderers/process-renderers.js";

export const commands: Record<string, CommandHandler> = {
	"process:list": adaptDescriptor<{ type?: string }, ProcessListResultModel>({
		flags: {
			type: { type: "string", required: false, hint: "--type=storybook" },
		},
		handler: (ctx) => {
			const { disk, paths, clock, pidOps } = ctx.deps;
			const entries = listProcesses({ disk, paths, clock, pidOps }, ctx.flags.type || undefined);
			return { entries };
		},
		renderer: renderProcessList,
	}),
};
