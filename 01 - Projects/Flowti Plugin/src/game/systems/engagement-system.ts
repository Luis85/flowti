/**
 * engagement-system.ts — Escalating Director engagement based on idle time.
 *
 * Reads DirectorPresence.idleMs to determine the current engagement tier and
 * selects the best available idle agent to deliver a contextually appropriate
 * thought or speech bubble.
 *
 * Escalation tiers (idleMs thresholds from WORLD_CONFIG.engagement):
 *   Tier 0 (Passive)  — idleMs < 30 s    → no engagement
 *   Tier 1 (Ambient)  — idleMs >= 30 s   → thought bubble, 1 / 45 s
 *   Tier 2 (Nudge)    — idleMs >= 90 s   → speech bubble, 1 / 90 s
 *   Tier 3 (Offer)    — idleMs >= 180 s  → speech bubble with action offer, 1 / 180 s
 *
 * Agent selection priority:
 *   1. Agent with a pending sensor event (hasPendingSensor callback)
 *   2. Agent with low morale (< 30)
 *   3. Agent with a completed task awaiting acknowledgment
 *   4. Highest-CHA idle agent (fallback)
 */

import type { DirectorPresence } from "./director-system.js";
import type { AgentNeeds } from "./needs-system.js";
import type { AgentIntent } from "./blackboard.js";
import { WORLD_CONFIG } from "../data/world-config.js";
import { TIER1_TEMPLATES, TIER2_TEMPLATES, TIER3_TEMPLATES, interpolateTemplate } from "../data/engagement-templates.js";

// ── Public interfaces ─────────────────────────────────────────────────

export interface EngagementEvent {
	tier: number;
	agentName: string;
	text: string;
	bubbleKind: "thought" | "speech";
	toolOfferId?: string;
}

// ── Internal per-agent entry ──────────────────────────────────────────

interface AgentEntry {
	domain: string;
	cha: number;
}

// ── Idle states eligible for engagement ──────────────────────────────

const IDLE_ELIGIBLE = new Set<AgentIntent>(["idle", "on-break", "waiting"]);

// ── EngagementSystem ──────────────────────────────────────────────────

export class EngagementSystem {
	private readonly agents = new Map<string, AgentEntry>();
	private readonly engagementCallbacks: Array<(e: EngagementEvent) => void> = [];

	/** ms accumulated since the last engagement fired. */
	private timeSinceLastEngagement = 0;

	/** True when an engagement is currently active (not yet dismissed). */
	private engagementActive = false;

	/** Agents that have completed a task and are awaiting acknowledgment. */
	private readonly pendingTaskCompletions = new Set<string>();

	/** Workspace context variables for template interpolation. */
	private context: Record<string, string> = {};

	// ── Registration ────────────────────────────────────────────────

	register(agentName: string, info: { domain: string; cha: number }): void {
		this.agents.set(agentName, { domain: info.domain, cha: info.cha });
	}

	unregister(agentName: string): void {
		this.agents.delete(agentName);
		this.pendingTaskCompletions.delete(agentName);
	}

	// ── Callbacks ───────────────────────────────────────────────────

	onEngagement(cb: (e: EngagementEvent) => void): void {
		this.engagementCallbacks.push(cb);
	}

	offEngagement(cb: (e: EngagementEvent) => void): void {
		const idx = this.engagementCallbacks.indexOf(cb);
		if (idx >= 0) this.engagementCallbacks.splice(idx, 1);
	}

	// ── Context ────────────────────────────────────────────────────

	/** Set workspace context variables for template interpolation. */
	setContext(ctx: Record<string, string>): void {
		this.context = ctx;
	}

	// ── Task completion tracking ─────────────────────────────────────

	markTaskCompleted(agentName: string): void {
		this.pendingTaskCompletions.add(agentName);
	}

	clearTaskCompleted(agentName: string): void {
		this.pendingTaskCompletions.delete(agentName);
	}

	// ── Director interaction reset ──────────────────────────────────

	dismissEngagement(): void {
		this.engagementActive = false;
		this.timeSinceLastEngagement = 0;
	}

	// ── Update ──────────────────────────────────────────────────────

	update(
		deltaMs: number,
		getPresence: () => DirectorPresence,
		getNeeds: (name: string) => AgentNeeds,
		getAgentIntent: (name: string) => AgentIntent,
		hasPendingSensor: (name: string) => boolean,
	): void {
		const presence = getPresence();

		// Director interaction resets engagement
		if (presence.idleMs === 0) {
			this.engagementActive = false;
			this.timeSinceLastEngagement = 0;
			return;
		}

		// One engagement at a time
		if (this.engagementActive) {
			this.timeSinceLastEngagement += deltaMs;
			// Auto-dismiss after engagementDuration
			if (this.timeSinceLastEngagement >= WORLD_CONFIG.engagement.engagementDuration) {
				this.engagementActive = false;
			}
			return;
		}

		// Determine current tier
		const tier = this.computeTier(presence.idleMs);
		if (tier === 0) return;

		// Determine required frequency for this tier
		const frequencyMs = this.tierFrequencyMs(tier);
		this.timeSinceLastEngagement += deltaMs;
		if (this.timeSinceLastEngagement < frequencyMs) return;

		// Select best agent
		const agentName = this.selectAgent(getNeeds, getAgentIntent, hasPendingSensor);
		if (!agentName) return;

		// Build and emit engagement event
		const entry = this.agents.get(agentName);
		if (!entry) return;

		const event = this.buildEvent(tier, agentName, entry.domain);
		this.engagementActive = true;
		this.timeSinceLastEngagement = 0;
		this.emit(event);
	}

	// ── Private helpers ─────────────────────────────────────────────

	private computeTier(idleMs: number): number {
		const { ambient, nudge, offer } = WORLD_CONFIG.engagement.tiers;
		if (idleMs >= offer.idleThresholdMs) return 3;
		if (idleMs >= nudge.idleThresholdMs) return 2;
		if (idleMs >= ambient.idleThresholdMs) return 1;
		return 0;
	}

	private tierFrequencyMs(tier: number): number {
		const { ambient, nudge, offer } = WORLD_CONFIG.engagement.tiers;
		if (tier >= 3) return offer.durationMs;
		if (tier === 2) return nudge.durationMs;
		return ambient.durationMs;
	}

	private selectAgent(
		getNeeds: (name: string) => AgentNeeds,
		getAgentIntent: (name: string) => AgentIntent,
		hasPendingSensor: (name: string) => boolean,
	): string | null {
		const eligible = [...this.agents.keys()].filter(
			(name) => IDLE_ELIGIBLE.has(getAgentIntent(name)),
		);

		if (eligible.length === 0) return null;

		// Priority 1: agent with pending sensor event
		const sensorAgent = eligible.find((n) => hasPendingSensor(n));
		if (sensorAgent) return sensorAgent;

		// Priority 2: agent with low morale (< 30)
		const lowMoraleAgent = eligible.find((n) => getNeeds(n).morale < 30);
		if (lowMoraleAgent) return lowMoraleAgent;

		// Priority 3: agent with completed task awaiting acknowledgment
		const taskAgent = eligible.find((n) => this.pendingTaskCompletions.has(n));
		if (taskAgent) return taskAgent;

		// Priority 4: highest-CHA idle agent
		return eligible.reduce((best, name) => {
			const bestCha = this.agents.get(best)?.cha ?? 0;
			const thisCha = this.agents.get(name)?.cha ?? 0;
			return thisCha > bestCha ? name : best;
		});
	}

	private buildEvent(tier: number, agentName: string, domain: string): EngagementEvent {
		const templates = tier >= 3 ? TIER3_TEMPLATES : tier === 2 ? TIER2_TEMPLATES : TIER1_TEMPLATES;
		const template = templates[Math.floor(Math.random() * templates.length)];
		const text = interpolateTemplate(template.text, { domain, task: "current task", mood_adj: "focused", ...this.context });

		const bubbleKind: "thought" | "speech" = tier === 1 ? "thought" : "speech";

		const event: EngagementEvent = {
			tier,
			agentName,
			text,
			bubbleKind,
		};

		if (tier >= 3) {
			event.toolOfferId = `offer-${agentName}-${Date.now()}`;
		}

		return event;
	}

	private emit(event: EngagementEvent): void {
		for (const cb of this.engagementCallbacks) {
			cb(event);
		}
	}
}
