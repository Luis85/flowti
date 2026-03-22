/**
 * pet-voice-selector.ts — Selects pet inner monologue voice based on context.
 *
 * Maps pet state to weighted voice probabilities:
 *   - Instinct: hungry/tired — broken grammar, pure animal brain
 *   - Eloquent: observing agents — dry wit, detached commentary
 *   - Gremlin: bored/playful — chaotic, dramatic overreaction
 */

import type { PetVoice } from "./talk-types.js";

export interface PetVoiceContext {
	readonly hunger: number;
	readonly thirst: number;
	readonly nearbyAgentMorale?: number;
	readonly state: string;
	readonly energy?: number;
}

interface VoiceWeight {
	readonly instinct: number;
	readonly eloquent: number;
	readonly gremlin: number;
}

const HUNGRY_WEIGHTS: VoiceWeight = { instinct: 80, eloquent: 0, gremlin: 20 };
const EMPATHY_WEIGHTS: VoiceWeight = { instinct: 30, eloquent: 70, gremlin: 0 };
const PLAYFUL_WEIGHTS: VoiceWeight = { instinct: 0, eloquent: 40, gremlin: 60 };
const SLEEPING_WEIGHTS: VoiceWeight = { instinct: 100, eloquent: 0, gremlin: 0 };
const DEFAULT_WEIGHTS: VoiceWeight = { instinct: 33, eloquent: 34, gremlin: 33 };

function selectFromWeights(weights: VoiceWeight): PetVoice {
	const total = weights.instinct + weights.eloquent + weights.gremlin;
	let roll = Math.random() * total;
	if ((roll -= weights.instinct) <= 0) return "instinct";
	if ((roll -= weights.eloquent) <= 0) return "eloquent";
	return "gremlin";
}

export function selectPetVoice(ctx: PetVoiceContext): PetVoice {
	if (ctx.hunger < 30 || ctx.thirst < 30) return selectFromWeights(HUNGRY_WEIGHTS);
	if (ctx.nearbyAgentMorale !== undefined && ctx.nearbyAgentMorale < 30) return selectFromWeights(EMPATHY_WEIGHTS);
	if (ctx.state === "sleeping") return selectFromWeights(SLEEPING_WEIGHTS);
	if (ctx.state === "idle" && (ctx.energy ?? 50) > 70) return selectFromWeights(PLAYFUL_WEIGHTS);
	return selectFromWeights(DEFAULT_WEIGHTS);
}
