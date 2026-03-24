/**
 * needs-system.ts — Per-agent needs (energy, social, focus, morale) with mood derivation.
 *
 * Needs decay and restore based on brain state:
 *   - Working: focus drains, energy drains slowly, morale grows
 *   - Idle/wandering: energy restores, focus restores slowly
 *   - Talking: social restores, energy drains slightly
 *   - On-break: energy restores fast, focus restores
 *
 * Mood is derived from the dominant need state.
 */

import type { AgentAttributes } from "../data/types.js";

// ── Public types ──────────────────────────────────────────────────────

export interface AgentNeeds {
	readonly energy: number;
	readonly social: number;
	readonly focus: number;
	readonly morale: number;
	readonly hunger: number;
	readonly thirst: number;
}

export interface ThresholdAction {
	readonly type: "force-break" | "seek-agent" | "seek-quiet" | "demoralized";
}

interface NeedsEntry {
	energy: number;
	social: number;
	focus: number;
	morale: number;
	hunger: number;
	thirst: number;
	attributes: AgentAttributes;
}

// ── Decay/restore rates (per second) ─────────────────────────────────

export const DECAY = {
	working: { energy: -0.8, social: -0.3, focus: -1.2, morale: 0.5, hunger: -0.6, thirst: -0.8 },
	idle: { energy: 0.5, social: -0.1, focus: 0.3, morale: -0.1, hunger: -0.2, thirst: -0.3 },
	wandering: { energy: 0.3, social: -0.1, focus: 0.2, morale: 0, hunger: -0.3, thirst: -0.4 },
	"walking-to": { energy: -0.2, social: 0, focus: 0, morale: 0, hunger: -0.2, thirst: -0.3 },
	seeking: { energy: -0.2, social: -0.1, focus: 0, morale: -0.15, hunger: -0.2, thirst: -0.3 },
	talking: { energy: -0.3, social: 1.5, focus: -0.2, morale: 0.3, hunger: -0.3, thirst: -0.5 },
	"on-break": { energy: 1.2, social: 0, focus: 0.5, morale: 0.2, hunger: -0.1, thirst: -0.1 },
} as Record<string, Record<string, number>>;

const DEFAULT_RATES = { energy: 0, social: 0, focus: 0, morale: 0, hunger: 0, thirst: 0 };

// ── System ───────────────────────────────────────────────────────────

export class NeedsSystem {
	private agents = new Map<string, NeedsEntry>();

	/** Register an agent with attribute-influenced starting needs. */
	register(name: string, attributes?: AgentAttributes): void {
		this.agents.set(name, { energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80, attributes: attributes ?? {} });
	}

	/** Apply a partial needs effect (e.g., from sensor reactions or social events). */
	applyEffect(name: string, effect: Partial<AgentNeeds>): void {
		const entry = this.agents.get(name);
		if (!entry) return;
		if (effect.energy !== undefined) entry.energy = clamp(entry.energy + effect.energy);
		if (effect.social !== undefined) entry.social = clamp(entry.social + effect.social);
		if (effect.focus !== undefined) entry.focus = clamp(entry.focus + effect.focus);
		if (effect.morale !== undefined) entry.morale = clamp(entry.morale + effect.morale);
		if (effect.hunger !== undefined) entry.hunger = clamp(entry.hunger + effect.hunger);
		if (effect.thirst !== undefined) entry.thirst = clamp(entry.thirst + effect.thirst);
	}

	/** Remove an agent. */
	remove(name: string): void {
		this.agents.delete(name);
	}

	/** Get current needs for an agent. Returns default if unknown. */
	getNeeds(name: string): AgentNeeds {
		const entry = this.agents.get(name);
		if (!entry) return { energy: 50, social: 50, focus: 50, morale: 50, hunger: 50, thirst: 50 };
		return { energy: entry.energy, social: entry.social, focus: entry.focus, morale: entry.morale, hunger: entry.hunger, thirst: entry.thirst };
	}

	/** Derive mood from current needs state. */
	getMood(name: string): string {
		const n = this.agents.get(name);
		if (!n) return "neutral";
		if (n.energy < 25) return "tired";
		if (n.morale > 80) return "excited";
		if (n.morale < 30) return "frustrated";
		if (n.social < 25) return "lonely";
		if (n.focus < 20) return "distracted";
		return "neutral";
	}

	/** Get all registered agent names. */
	getAgentNames(): string[] {
		return [...this.agents.keys()];
	}

	/** Check thresholds and return recommended actions for critically low needs. */
	checkThresholds(name: string): ThresholdAction[] {
		const entry = this.agents.get(name);
		if (!entry) return [];
		const actions: ThresholdAction[] = [];
		if (entry.energy < 30) actions.push({ type: "force-break" });
		if (entry.social < 25) actions.push({ type: "seek-agent" });
		if (entry.focus < 20) actions.push({ type: "seek-quiet" });
		if (entry.morale < 10) actions.push({ type: "demoralized" });
		return actions;
	}

	/** Tick needs based on each agent's current brain state and nearby agents. */
	update(
		deltaMs: number,
		getState: (name: string) => string,
		getNearby: (name: string) => string[],
		phaseMultipliers?: { energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number },
	): void {
		const dt = deltaMs / 1000;
		const pm = phaseMultipliers ?? { energy: 1, social: 1, focus: 1, morale: 1, hunger: 1, thirst: 1 };
		for (const [name, entry] of this.agents) {
			const state = getState(name);
			const rates = DECAY[state] ?? DEFAULT_RATES;
			const mods = this.getModifiers(entry.attributes);

			// Social gets a bonus when nearby agents exist
			const nearbyCount = getNearby(name).length;
			const socialBonus = nearbyCount > 0 ? 0.3 * nearbyCount : 0;

			// Hunger/thirst decay (phase-multiplied)
			entry.hunger = clamp(entry.hunger + (rates.hunger ?? 0) * (pm.hunger ?? 1) * dt);
			entry.thirst = clamp(entry.thirst + (rates.thirst ?? 0) * (pm.thirst ?? 1) * dt);

			// Energy drain multiplier (stacking)
			let energyMult = 1;
			if (entry.hunger < 40) energyMult *= 1.5;
			if (entry.thirst < 30) energyMult *= 1.5;

			entry.energy = clamp(entry.energy + applyMod(rates.energy, mods.energy) * pm.energy * energyMult * dt);
			entry.social = clamp(entry.social + (applyMod(rates.social, mods.social) + socialBonus) * pm.social * dt);
			entry.focus = clamp(entry.focus + applyMod(rates.focus, mods.focus) * pm.focus * dt);
			entry.morale = clamp(entry.morale + applyMod(rates.morale, mods.morale) * pm.morale * dt);
		}
	}

	/** Serialize all agent needs for persistence. */
	serialize(): Record<string, AgentNeeds> {
		const result: Record<string, AgentNeeds> = {};
		for (const [name, entry] of this.agents) {
			result[name] = { energy: entry.energy, social: entry.social, focus: entry.focus, morale: entry.morale, hunger: entry.hunger, thirst: entry.thirst };
		}
		return result;
	}

	/** Restore previously saved needs. Only updates agents that have been registered. */
	restore(data: Record<string, AgentNeeds>): void {
		for (const [name, needs] of Object.entries(data)) {
			const entry = this.agents.get(name);
			if (!entry) continue;
			entry.energy = clamp(needs.energy ?? entry.energy);
			entry.social = clamp(needs.social ?? entry.social);
			entry.focus = clamp(needs.focus ?? entry.focus);
			entry.morale = clamp(needs.morale ?? entry.morale);
			entry.hunger = clamp(needs.hunger ?? entry.hunger);
			entry.thirst = clamp(needs.thirst ?? entry.thirst);
		}
	}

	/** Compute per-need decay multipliers from agent attributes. */
	private getModifiers(attrs: AgentAttributes): { energy: number; social: number; focus: number; morale: number } {
		return {
			energy: 1 - (attrs.con ?? 0) / 40,
			social: 1 + (attrs.cha ?? 0) / 20,
			focus: 1 - (attrs.int ?? 0) / 40,
			morale: 1 - (attrs.wis ?? 0) / 40,
		};
	}
}

function clamp(value: number, min = 0, max = 100): number {
	return Math.max(min, Math.min(max, value));
}

/** Apply attribute modifier only to negative rates (drains). Positive rates pass through unmodified. */
function applyMod(rate: number, modifier: number): number {
	return rate < 0 ? rate * modifier : rate;
}
