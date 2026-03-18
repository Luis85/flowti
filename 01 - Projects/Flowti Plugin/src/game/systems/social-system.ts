/**
 * social-system.ts — Proximity conversation detection between related agents.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

import type { BrainState } from "../brain/brain-types.js";

export interface SocialAgent {
	readonly socialRadius: number;
	readonly personality: readonly string[];
	readonly relationships: readonly { target: string; type: string }[];
}

interface SocialEntry extends SocialAgent {
	proximityTimers: Map<string, number>;
}

const PROXIMITY_THRESHOLD_MS = 4000;
const PAIR_COOLDOWN_MS = 60000;
const IDLE_STATES: readonly BrainState[] = ["idle", "on-break", "waiting"];

type ConversationCallback = (agentA: string, agentB: string, lineA: string, lineB: string) => void;

const CONVERSATION_LINES: Record<string, readonly string[]> = {
	engineering: ["The build looks good today.", "Have you seen the latest test results?", "This architecture is clean.", "The pipeline is green."],
	design: ["The flow feels intuitive now.", "I love how this looks.", "Users will appreciate this.", "Nice color choices."],
	product: ["The roadmap is shaping up.", "Good progress on the scope.", "Let's review the backlog.", "The metrics look promising."],
	general: ["How's it going?", "Good to see you.", "Making progress!", "Nice work today.", "What are you working on?"],
};

export class SocialSystem {
	private readonly entries = new Map<string, SocialEntry>();
	private readonly pairCooldowns = new Map<string, number>();
	private callback: ConversationCallback | null = null;

	onConversation(cb: ConversationCallback): void {
		this.callback = cb;
	}

	register(name: string, agent: SocialAgent): void {
		this.entries.set(name, { ...agent, proximityTimers: new Map() });
	}

	unregister(name: string): void {
		this.entries.delete(name);
	}

	update(
		deltaMs: number,
		getPosition: (name: string) => { x: number; y: number },
		getState: (name: string) => BrainState,
	): void {
		// Decrement pair cooldowns
		for (const [key, remaining] of this.pairCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.pairCooldowns.delete(key);
			else this.pairCooldowns.set(key, updated);
		}

		for (const [nameA, entryA] of this.entries) {
			if (!IDLE_STATES.includes(getState(nameA))) continue;
			const posA = getPosition(nameA);

			for (const rel of entryA.relationships) {
				const entryB = this.entries.get(rel.target);
				if (!entryB) continue;
				if (!IDLE_STATES.includes(getState(rel.target))) continue;

				const pairKey = [nameA, rel.target].sort().join("|");
				if (this.pairCooldowns.has(pairKey)) continue;

				const posB = getPosition(rel.target);
				const dx = posA.x - posB.x;
				const dy = posA.y - posB.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				const maxRadius = Math.max(entryA.socialRadius, entryB.socialRadius);

				if (dist > maxRadius) {
					entryA.proximityTimers.delete(rel.target);
					continue;
				}

				const timer = (entryA.proximityTimers.get(rel.target) ?? 0) + deltaMs;
				entryA.proximityTimers.set(rel.target, timer);

				if (timer >= PROXIMITY_THRESHOLD_MS) {
					entryA.proximityTimers.delete(rel.target);
					this.pairCooldowns.set(pairKey, PAIR_COOLDOWN_MS);

					const lineA = this.pickLine(entryA.personality);
					const lineB = this.pickLine(entryB.personality);
					this.callback?.(nameA, rel.target, lineA, lineB);
				}
			}
		}
	}

	private pickLine(_personality: readonly string[]): string {
		const pool = CONVERSATION_LINES["general"];
		return pool[Math.floor(Math.random() * pool.length)];
	}
}
