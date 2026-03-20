/**
 * bubble-system.ts — Manages speech/thought/question bubbles per agent.
 *
 * FIFO queue per agent (max 3). Auto-dismiss after duration.
 * Bubbles are added as children of the agent actor so they follow automatically.
 */

import { BubbleActor, type BubbleKind } from "../actors/bubble-actor.js";
import type { AgentActor } from "../actors/agent-actor.js";
import type { BrainParams } from "../brain/brain-types.js";

// ── Constants ────────────────────────────────────────────────────────

const MAX_BUBBLES_PER_AGENT = 3;
const DEFAULT_DURATION = 5000;
const BUBBLE_STACK_OFFSET = 20;
const BUBBLE_Y_OFFSET = -10;
const AGENT_SCALE = 2;

// ── Per-agent bubble queue ───────────────────────────────────────────

interface AgentBubbleEntry {
	readonly bubbles: BubbleActor[];
	idleQuoteTimer: number;
	lastBubbleTime: number;
	readonly personality: readonly string[];
	readonly quoteFrequency: number;
}

// ── BubbleSystem ─────────────────────────────────────────────────────

export class BubbleSystem {
	private readonly entries = new Map<string, AgentBubbleEntry>();

	/** Register an agent for bubble management. */
	register(name: string, personality: readonly string[], params: BrainParams): void {
		if (this.entries.has(name)) return;
		this.entries.set(name, {
			bubbles: [],
			idleQuoteTimer: 0,
			lastBubbleTime: 0,
			personality,
			quoteFrequency: params.quoteFrequency,
		});
	}

	/** Remove an agent and kill all its bubbles. */
	unregister(name: string): void {
		const entry = this.entries.get(name);
		if (entry) {
			for (const b of entry.bubbles) b.kill();
			this.entries.delete(name);
		}
	}

	/** Show a bubble above the given agent (added as child of the agent actor). */
	showBubble(
		agentName: string,
		kind: BubbleKind,
		text: string,
		_scene: unknown,
		getActor: (name: string) => AgentActor | undefined,
		duration: number = DEFAULT_DURATION,
		priority?: boolean,
	): void {
		const entry = this.entries.get(agentName);
		if (!entry) return;

		// Throttle: max 1 bubble per agent per 500ms to prevent DOM thrashing
		const now = performance.now();
		if (!priority && entry.lastBubbleTime && now - entry.lastBubbleTime < 500) return;
		entry.lastBubbleTime = now;

		const actor = getActor(agentName);
		if (!actor) return;

		// FIFO: remove oldest if at capacity
		while (entry.bubbles.length >= MAX_BUBBLES_PER_AGENT) {
			const oldest = entry.bubbles.shift();
			if (oldest) oldest.kill();
		}

		// Stack position in parent-local coords (parent is AGENT_SCALE)
		const stackIndex = entry.bubbles.length;
		const localY = BUBBLE_Y_OFFSET - stackIndex * (BUBBLE_STACK_OFFSET / AGENT_SCALE);

		const bubble = new BubbleActor({
			text,
			kind,
			x: 0,
			y: localY,
			duration,
			scale: 1 / AGENT_SCALE,
		});
		actor.addChild(bubble);
		entry.bubbles.push(bubble);

		// Clean up dead bubbles on a timer
		setTimeout(() => {
			this.cleanupDead(agentName);
		}, duration + 100);
	}

	/** Clean up dead bubbles. Idle quotes are handled by the TalkEngine. */
	update(
		_deltaMs: number,
		_isIdle: (name: string) => boolean,
		_scene: unknown,
		_getActor: (name: string) => AgentActor | undefined,
	): void {
		for (const [name] of this.entries) {
			this.cleanupDead(name);
		}
	}

	private cleanupDead(agentName: string): void {
		const entry = this.entries.get(agentName);
		if (!entry) return;
		for (let i = entry.bubbles.length - 1; i >= 0; i--) {
			if (entry.bubbles[i].isKilled()) {
				entry.bubbles.splice(i, 1);
			}
		}
	}
}
