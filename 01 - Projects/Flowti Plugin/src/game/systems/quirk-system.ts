/**
 * quirk-system.ts — Assigns and manages per-agent behavioral quirks.
 *
 * On first registration (no saved quirks), rolls 2-3 quirks from the eligible pool.
 * Computes combined QuirkOverrides for BrainSystem to apply as post-multipliers.
 */

import { QUIRK_DEFINITIONS, rollQuirks, type QuirkOverrides } from "../data/quirk-definitions.js";

interface AgentQuirkEntry {
	quirks: string[];
	overrides: QuirkOverrides;
}

export class QuirkSystem {
	private readonly agents = new Map<string, AgentQuirkEntry>();

	/** Register an agent. If savedQuirks is empty, rolls new quirks. */
	register(name: string, attrs: Record<string, number>, domain: string, savedQuirks: string[]): void {
		const quirks = savedQuirks.length > 0 ? savedQuirks : rollQuirks(attrs, domain);
		const overrides = this.computeOverrides(quirks);
		this.agents.set(name, { quirks, overrides });
	}

	getQuirks(name: string): string[] {
		return this.agents.get(name)?.quirks ?? [];
	}

	getOverrides(name: string): QuirkOverrides {
		return this.agents.get(name)?.overrides ?? {};
	}

	hasQuirk(name: string, quirkId: string): boolean {
		return this.agents.get(name)?.quirks.includes(quirkId) ?? false;
	}

	/** Get all quirk phrase pools combined for an agent. */
	getQuirkPhrases(name: string): string[] {
		const entry = this.agents.get(name);
		if (!entry) return [];
		const phrases: string[] = [];
		for (const qId of entry.quirks) {
			const def = QUIRK_DEFINITIONS.find((d) => d.id === qId);
			if (def) phrases.push(...def.phrases);
		}
		return phrases;
	}

	private computeOverrides(quirks: string[]): QuirkOverrides {
		const result: Record<string, number> = {};
		for (const qId of quirks) {
			const def = QUIRK_DEFINITIONS.find((d) => d.id === qId);
			if (!def) continue;
			for (const [key, value] of Object.entries(def.overrides)) {
				if (typeof value === "number") {
					result[key] = (result[key] ?? 1) * value;
				}
			}
		}
		return result as QuirkOverrides;
	}
}
