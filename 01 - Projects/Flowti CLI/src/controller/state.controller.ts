/**
 * state.controller.ts — Controller for the `flowti state` command.
 *
 * Reads world state from disk and renders a summary or entity detail.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { renderWorldStateSummary, renderEntityDetail } from "../ui/displays/state-display.js";

const actions: Record<string, ControllerAction> = {
	state: (req) => {
		const state = req.deps.worldState.getState();

		if (req.flags.json) {
			return dataResponse(state, (d) => { req.deps.log(JSON.stringify(d, null, 2)); });
		}

		const agentName = typeof req.flags.agent === "string" ? req.flags.agent : null;
		if (agentName) {
			const entity = req.deps.worldState.getEntity(agentName);
			return dataResponse(entity, (d) => {
				if (d) renderEntityDetail(d, req.deps.log);
				else req.deps.log(`\n  Agent "${agentName}" not found in world state.\n`);
			});
		}

		return dataResponse(state, (d) => renderWorldStateSummary(d, req.deps.log));
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
