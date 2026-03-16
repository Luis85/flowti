/**
 * bubble-system.ts — Manages speech/thought/question bubbles per agent.
 *
 * FIFO queue per agent (max 3). Auto-dismiss after duration.
 * Periodically shows idle quotes from agent personality traits.
 */

import * as ex from "excalibur";
import { BubbleActor, type BubbleKind } from "../actors/bubble-actor.js";
import type { AgentActor } from "../actors/agent-actor.js";
import type { BrainParams } from "../brain/brain-types.js";

// ── Constants ────────────────────────────────────────────────────────

const MAX_BUBBLES_PER_AGENT = 3;
const DEFAULT_DURATION = 5000;
const BUBBLE_STACK_OFFSET = 30;
const BUBBLE_Y_OFFSET = -45;

// ── Per-agent bubble queue ───────────────────────────────────────────

interface AgentBubbleEntry {
	readonly bubbles: BubbleActor[];
	idleQuoteTimer: number;
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

	/** Show a bubble above the given agent. */
	showBubble(
		agentName: string,
		kind: BubbleKind,
		text: string,
		scene: ex.Scene,
		getActor: (name: string) => AgentActor | undefined,
		duration: number = DEFAULT_DURATION,
	): void {
		const entry = this.entries.get(agentName);
		if (!entry) return;

		const actor = getActor(agentName);
		if (!actor) return;

		// FIFO: remove oldest if at capacity
		while (entry.bubbles.length >= MAX_BUBBLES_PER_AGENT) {
			const oldest = entry.bubbles.shift();
			if (oldest) oldest.kill();
		}

		// Stack position: each bubble offset upward from the previous
		const stackIndex = entry.bubbles.length;
		const bubbleX = actor.pos.x;
		const bubbleY = actor.pos.y + BUBBLE_Y_OFFSET - stackIndex * BUBBLE_STACK_OFFSET;

		const bubble = new BubbleActor({
			text,
			kind,
			x: bubbleX,
			y: bubbleY,
			duration,
		});
		scene.add(bubble);
		entry.bubbles.push(bubble);

		// Clean up dead bubbles on a timer
		setTimeout(() => {
			this.cleanupDead(agentName);
		}, duration + 100);
	}

	/** Update idle quote timers. Show quotes for idle agents. */
	update(
		deltaMs: number,
		isIdle: (name: string) => boolean,
		scene: ex.Scene,
		getActor: (name: string) => AgentActor | undefined,
	): void {
		for (const [name, entry] of this.entries) {
			// Clean up dead bubbles
			this.cleanupDead(name);

			if (!isIdle(name)) {
				entry.idleQuoteTimer = 0;
				continue;
			}

			entry.idleQuoteTimer += deltaMs;
			if (entry.idleQuoteTimer >= entry.quoteFrequency && entry.personality.length > 0) {
				entry.idleQuoteTimer = 0;
				const quote = entry.personality[Math.floor(Math.random() * entry.personality.length)];
				this.showBubble(name, "thought", quote, scene, getActor, DEFAULT_DURATION);
			}
		}
	}

	private cleanupDead(agentName: string): void {
		const entry = this.entries.get(agentName);
		if (!entry) return;
		// Remove killed bubbles from the array
		for (let i = entry.bubbles.length - 1; i >= 0; i--) {
			if (entry.bubbles[i].isKilled()) {
				entry.bubbles.splice(i, 1);
			}
		}
	}
}
