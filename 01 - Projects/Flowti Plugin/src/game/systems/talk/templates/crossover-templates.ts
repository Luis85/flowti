/**
 * crossover-templates.ts — Cross-domain conversation templates (barrel).
 *
 * When agents from different domains interact, these templates acknowledge
 * the domain gap with playful, authentic banter between specializations.
 */

import type { WeightedTemplate } from "../talk-types.js";
import { CORE_CROSSOVER_PAIRS } from "./crossover-core.js";
import { EXTENDED_CROSSOVER_PAIRS } from "./crossover-extended.js";

export interface CrossoverPair {
	readonly domainA: string;
	readonly domainB: string;
	readonly linesA: readonly WeightedTemplate[];
	readonly linesB: readonly WeightedTemplate[];
}

export const CROSSOVER_PAIRS: readonly CrossoverPair[] = [
	...CORE_CROSSOVER_PAIRS,
	...EXTENDED_CROSSOVER_PAIRS,
];

/** Find a crossover pair for two given domains, checking both orderings. */
export function findCrossover(domainA: string, domainB: string): CrossoverPair | undefined {
	return CROSSOVER_PAIRS.find(
		(pair) =>
			(pair.domainA === domainA && pair.domainB === domainB) ||
			(pair.domainA === domainB && pair.domainB === domainA),
	);
}
