/**
 * emote-system.ts — Periodic mood emotes floating above agents.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

import type { AgentIntent } from "./blackboard.js";

/** Maps mood strings to Ninja Adventure emote sprite indices (1-30). */
export const MOOD_EMOTE_MAP: Record<string, number[]> = {
	happy: [3, 5],
	enthusiastic: [3, 5],
	neutral: [7, 8],
	frustrated: [10, 12],
	angry: [10, 12],
	focused: [15, 20],
	empathetic: [3, 22],
	inspired: [20, 5],
	aesthetic: [22, 8],
	playful: [5, 25],
};

const FALLBACK_EMOTES = [7];
const IDLE_STATES: readonly AgentIntent[] = ["idle", "on-break", "waiting"];

interface AgentEmoteEntry {
	mood: string;
	cooldown: number;
	timer: number;
}

type EmoteCallback = (agentName: string, emoteIndex: number) => void;

export class EmoteSystem {
	private readonly entries = new Map<string, AgentEmoteEntry>();
	private callback: EmoteCallback | null = null;

	onEmote(cb: EmoteCallback): void {
		this.callback = cb;
	}

	offEmote(): void {
		this.callback = null;
	}

	register(name: string, mood: string, quoteFrequency: number): void {
		this.entries.set(name, {
			mood,
			cooldown: quoteFrequency,
			timer: Math.random() * quoteFrequency * 0.5,
		});
	}

	unregister(name: string): void {
		this.entries.delete(name);
	}

	updateMood(name: string, mood: string): void {
		const entry = this.entries.get(name);
		if (entry) entry.mood = mood;
	}

	update(deltaMs: number, getState: (name: string) => AgentIntent): void {
		for (const [name, entry] of this.entries) {
			entry.timer += deltaMs;
			if (entry.timer < entry.cooldown) continue;

			const state = getState(name);
			if (!IDLE_STATES.includes(state)) continue;

			entry.timer = 0;
			const candidates = MOOD_EMOTE_MAP[entry.mood] ?? FALLBACK_EMOTES;
			const idx = candidates[Math.floor(Math.random() * candidates.length)];
			this.callback?.(name, idx);
		}
	}
}
