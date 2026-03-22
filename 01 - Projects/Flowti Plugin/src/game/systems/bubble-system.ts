/**
 * bubble-system.ts — Manages speech/thought/question bubbles per agent.
 *
 * FIFO queue per agent (max 3). Auto-dismiss after duration.
 * Bubbles are added as children of the agent actor so they follow automatically.
 */

import * as ex from "excalibur";
import { BubbleActor, type BubbleKind } from "../actors/bubble-actor.js";
import type { BrainParams } from "../brain/brain-types.js";

// ── Constants ────────────────────────────────────────────────────────

const DEFAULT_DURATION = 5000;
const MIN_BUBBLE_GAP = 1500;
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

	/** Register an entity for bubble management (roster agent or pet id). */
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
		getActor: (name: string) => ex.Actor | undefined,
		duration: number = DEFAULT_DURATION,
		priority?: boolean,
	): void {
		const entry = this.entries.get(agentName);
		if (!entry) return;

		// Throttle: enforce gap between bubbles to prevent burst spam
		const now = performance.now();
		if (!priority && entry.lastBubbleTime && now - entry.lastBubbleTime < MIN_BUBBLE_GAP) return;
		entry.lastBubbleTime = now;

		const actor = getActor(agentName);
		if (!actor) return;

		// Kill any existing bubble — one at a time, no stacking
		for (const b of entry.bubbles) b.kill();
		entry.bubbles.length = 0;

		const localY = BUBBLE_Y_OFFSET;

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
		_getActor: (name: string) => ex.Actor | undefined,
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
