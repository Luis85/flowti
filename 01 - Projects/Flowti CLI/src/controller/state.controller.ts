/**
 * state.controller.ts — Controller for the `flowti state` command.
 *
 * Reads world state from disk and renders a summary or entity detail.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { WorldState, WorldEntity } from "../infrastructure/types.js";
import { renderWorldStateSummary, renderEntityDetail } from "../ui/displays/state-display.js";
import type { LogFn } from "../infrastructure/command-engine.js";

type StateModel =
	| { kind: "json"; state: WorldState }
	| { kind: "entity"; entity: WorldEntity | undefined; agentName: string }
	| { kind: "summary"; state: WorldState };

function renderState(model: StateModel, log: LogFn): void {
	if (model.kind === "json") {
		log(JSON.stringify(model.state, null, 2));
	} else if (model.kind === "entity") {
		if (model.entity) renderEntityDetail(model.entity, log);
		else log(`\n  Agent "${model.agentName}" not found in world state.\n`);
	} else {
		renderWorldStateSummary(model.state, log);
	}
}

export const commands: Record<string, CommandHandler> = {
	state: adaptDescriptor<{ json?: boolean; agent?: string }, StateModel>({
		handler: (ctx) => {
			const state = ctx.deps.worldState.getState();

			if (ctx.flags.json) {
				return { kind: "json", state };
			}

			const agentName = typeof ctx.flags.agent === "string" ? ctx.flags.agent : null;
			if (agentName) {
				const entity = ctx.deps.worldState.getEntity(agentName);
				return { kind: "entity", entity: entity ?? undefined, agentName };
			}

			return { kind: "summary", state };
		},
		renderer: renderState,
	}),
};
