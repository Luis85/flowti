/**
 * sensor-system.ts — Workspace event processing with rule evaluation and cooldowns.
 *
 * Receives SensorEventData from the game scene (CLI SSE stream, file-watcher, etc.)
 * and evaluates them against DEFAULT_SENSOR_RULES. The first matching, non-cooled
 * rule wins. Three layers of cooldown are enforced:
 *   1. Global — 10 s between any two reactions (configurable via WorldConfig).
 *   2. Per-rule — each rule carries its own cooldown.
 *   3. Per-agent — 5 s between sensor-triggered bubbles for the same agent.
 *
 * pushFeedback() queues an event for processing on the next update() frame.
 * applyOverrides() lets callers disable rules or change their cooldowns at runtime.
 */

import type { SensorEventData, SensorReaction, SensorRule, SensorRuleOverride } from "../data/sensor-rules.js";
import { DEFAULT_SENSOR_RULES } from "../data/sensor-rules.js";
import { DEFAULT_WORLD_CONFIG } from "../data/world-config.js";

// ── Internal per-agent entry ──────────────────────────────────────────

interface AgentEntry {
	domain: string;
	/** Remaining cooldown in ms before another sensor bubble may fire for this agent. */
	agentCooldownRemaining: number;
}

// ── SensorSystem ──────────────────────────────────────────────────────

export class SensorSystem {
	private readonly agents = new Map<string, AgentEntry>();
	private readonly reactionCallbacks: Array<(r: SensorReaction) => void> = [];

	/** Effective rules after overrides are applied. */
	private rules: SensorRule[] = DEFAULT_SENSOR_RULES.map((r) => ({ ...r }));

	/** Remaining global cooldown in ms. */
	private globalCooldownRemaining = 0;

	/** Remaining per-rule cooldowns, keyed by rule id. */
	private readonly ruleCooldowns = new Map<string, number>();

	/** Events queued via pushFeedback() to be processed on the next frame. */
	private feedbackQueue: SensorEventData[] = [];

	// ── Registration ────────────────────────────────────────────────

	register(agentName: string, domain: string): void {
		this.agents.set(agentName, { domain, agentCooldownRemaining: 0 });
	}

	unregister(agentName: string): void {
		this.agents.delete(agentName);
	}

	// ── Callback ────────────────────────────────────────────────────

	onReaction(cb: (reaction: SensorReaction) => void): void {
		this.reactionCallbacks.push(cb);
	}

	// ── Event ingestion ─────────────────────────────────────────────

	/** Process an event immediately on this frame. */
	pushEvent(event: SensorEventData): void {
		this.processEvent(event);
	}

	/** Queue an event to be processed on the next update() frame. */
	pushFeedback(event: SensorEventData): void {
		this.feedbackQueue.push(event);
	}

	// ── Overrides ───────────────────────────────────────────────────

	/**
	 * Apply rule overrides at runtime.
	 * A negative cooldownMs disables the rule entirely.
	 */
	applyOverrides(overrides: SensorRuleOverride[]): void {
		this.rules = DEFAULT_SENSOR_RULES.map((rule) => {
			const override = overrides.find((o) => o.ruleId === rule.id);
			if (!override) return { ...rule };
			return { ...rule, cooldown: override.cooldownMs };
		});
	}

	// ── Update ──────────────────────────────────────────────────────

	update(deltaMs: number): void {
		// Drain global cooldown
		if (this.globalCooldownRemaining > 0) {
			this.globalCooldownRemaining = Math.max(0, this.globalCooldownRemaining - deltaMs);
		}

		// Drain per-rule cooldowns
		for (const [id, remaining] of this.ruleCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.ruleCooldowns.delete(id);
			else this.ruleCooldowns.set(id, updated);
		}

		// Drain per-agent cooldowns
		for (const entry of this.agents.values()) {
			if (entry.agentCooldownRemaining > 0) {
				entry.agentCooldownRemaining = Math.max(0, entry.agentCooldownRemaining - deltaMs);
			}
		}

		// Process queued feedback events (one-frame delay)
		const pending = this.feedbackQueue;
		this.feedbackQueue = [];
		for (const event of pending) {
			this.processEvent(event);
		}
	}

	// ── Private helpers ─────────────────────────────────────────────

	private processEvent(event: SensorEventData): void {
		// Global cooldown gate
		if (this.globalCooldownRemaining > 0) return;

		for (const rule of this.rules) {
			// Rule must match event type
			if (rule.event !== event.type) continue;

			// Disabled rules (negative cooldown) are skipped
			if (rule.cooldown < 0) continue;

			// Per-rule cooldown gate
			if (this.ruleCooldowns.has(rule.id)) continue;

			// Optional predicate
			if (rule.condition && !rule.condition(event.data)) continue;

			// Resolve target agents
			const targets = this.resolveTargets(rule, event.data);
			if (targets.length === 0) continue;

			for (const agentName of targets) {
				const entry = this.agents.get(agentName);
				if (!entry) continue;

				// Per-agent cooldown gate (only for rules that produce bubbles)
				if (rule.reaction.bubble && entry.agentCooldownRemaining > 0) continue;

				const reaction = this.buildReaction(agentName, rule);
				this.emit(reaction);

				// Apply per-agent cooldown when a bubble was produced
				if (rule.reaction.bubble) {
					entry.agentCooldownRemaining = DEFAULT_WORLD_CONFIG.sensors.perAgentCooldown;
				}
			}

			// Apply per-rule cooldown and global cooldown
			this.ruleCooldowns.set(rule.id, rule.cooldown);
			this.globalCooldownRemaining = DEFAULT_WORLD_CONFIG.sensors.globalCooldown;

			// First matching rule wins
			break;
		}
	}

	private resolveTargets(rule: SensorRule, data: Record<string, unknown>): string[] {
		const agentNames = [...this.agents.keys()];

		if (agentNames.length === 0) return [];

		if (rule.agentFilter === "all") {
			return agentNames;
		}

		if (rule.agentFilter === "nearest-domain") {
			// Prefer agents whose domain matches the rule's domainHint
			const hint = rule.domainHint;
			if (hint) {
				const match = agentNames.find((n) => this.agents.get(n)?.domain === hint);
				if (match) return [match];
			}
			// Fallback: first registered agent
			return [agentNames[0]];
		}

		if (rule.agentFilter === "domain-match") {
			// Use file path from event data to determine domain
			const filePath = typeof data["path"] === "string" ? data["path"] : "";
			const domainPaths = DEFAULT_WORLD_CONFIG.sensors.domainPaths ?? {};

			let matchedDomain: string | null = null;
			for (const [domain, prefix] of Object.entries(domainPaths)) {
				if (filePath.startsWith(prefix)) {
					matchedDomain = domain;
					break;
				}
			}

			if (matchedDomain) {
				const match = agentNames.find((n) => this.agents.get(n)?.domain === matchedDomain);
				if (match) return [match];
			}

			// Fallback: first registered agent
			return [agentNames[0]];
		}

		return [];
	}

	private buildReaction(agentName: string, rule: SensorRule): SensorReaction {
		const r: SensorReaction = { agentName };
		if (rule.reaction.bubble) {
			r.bubble = { kind: rule.reaction.bubble.kind, text: rule.reaction.bubble.template };
		}
		if (rule.reaction.emote !== undefined) {
			r.emote = rule.reaction.emote;
		}
		if (rule.reaction.needsEffect) {
			r.needsEffect = rule.reaction.needsEffect;
		}
		if (rule.reaction.brainEvent) {
			r.brainEvent = rule.reaction.brainEvent;
		}
		return r;
	}

	private emit(reaction: SensorReaction): void {
		for (const cb of this.reactionCallbacks) {
			cb(reaction);
		}
	}
}
