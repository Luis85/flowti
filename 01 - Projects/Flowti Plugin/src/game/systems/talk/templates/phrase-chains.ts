/**
 * phrase-chains.ts — Multi-step thought sequences for richer inner monologue (barrel).
 *
 * Each chain plays out over 2-3 bubbles with timed pauses between them,
 * creating little narrative moments that make agents feel more alive.
 */

import { CORE_PHRASE_CHAINS } from "./phrase-chains-core.js";
import { ADDITIONAL_PHRASE_CHAINS } from "./phrase-chains-additional.js";
import { EXPANDED_PHRASE_CHAINS } from "./phrase-chains-expanded.js";

export interface PhraseChain {
	readonly id: string;
	readonly trigger: "idle" | "working" | "thinking" | "break" | "any";
	readonly weight: number;
	readonly steps: readonly { text: string; delayMs: number; kind: "thought" | "speech" }[];
}

export const PHRASE_CHAINS: readonly PhraseChain[] = [
	...CORE_PHRASE_CHAINS,
	...ADDITIONAL_PHRASE_CHAINS,
	...EXPANDED_PHRASE_CHAINS,
];
