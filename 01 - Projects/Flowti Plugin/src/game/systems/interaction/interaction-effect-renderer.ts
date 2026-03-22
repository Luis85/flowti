import type { InteractionAction } from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";

/**
 * Systems that the effect renderer can talk to.
 * Each field is optional — renderers degrade gracefully when systems aren't available.
 */
export interface EffectRendererSystems {
	readonly talk?: {
		triggerReactive(entityId: string, trigger: string): void;
	};
	readonly bubble?: {
		showBubble(entityId: string, kind: string, text: string): void;
	};
}

/**
 * Maps InteractionAction[] to visual system calls.
 * State mutations (affinity, needs, economy) are already handled by the CLI domain
 * applyEffect() inside the bus tick — this function handles only visual/audio effects.
 */
export function renderInteractionActions(
	actions: readonly InteractionAction[],
	systems: EffectRendererSystems,
): void {
	for (const action of actions) {
		switch (action.actionType) {
			case "bubble": {
				const params = action.params as {
					bubbleKind: string;
					phrasePool: string;
					templateVars?: Record<string, string>;
				};
				// Route all bubbles through TalkEngine reactive triggers.
				// phrasePool values are either "reactive:<trigger>" or template-specific IDs.
				// TalkEngine handles unknown triggers gracefully (no-op).
				const trigger = params.phrasePool.startsWith("reactive:")
					? params.phrasePool.replace("reactive:", "")
					: params.phrasePool;
				if (systems.talk) {
					systems.talk.triggerReactive(action.entityId, trigger);
				}
				break;
			}
			case "particle":
				// Future: trigger particle effect on entity via particle pool manager
				break;
			case "sound":
				// Future: audio system integration
				break;
		}
	}
}
