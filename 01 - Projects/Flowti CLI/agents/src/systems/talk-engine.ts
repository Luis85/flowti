/**
 * talk-engine.ts — Ambient chatter system for agent liveliness.
 *
 * Each agent periodically "says" domain-relevant phrases as thought bubbles.
 * When an LLM response arrives, the agent is silenced for a cooldown period
 * so the real response takes precedence.
 */

import type { BubbleKind } from "../actors/bubble-actor.js";

// ── Topic books per domain ──────────────────────────────────────────

const DOMAIN_TOPICS: Record<string, readonly string[]> = {
	engineering: [
		"This could use some refactoring...",
		"Tests are green!",
		"Interesting pattern here...",
		"Time to review that PR",
		"The build looks clean",
		"Let me trace this logic...",
		"Need to update the docs",
		"That edge case though...",
		"Clean architecture matters",
		"Ship it!",
	],
	design: [
		"The spacing feels off...",
		"Users would expect this here",
		"Color contrast needs work",
		"Wireframes coming along nicely",
		"Accessibility first",
		"This flow could be simpler",
		"Consistent icons everywhere",
		"The grid is satisfying",
		"Typography is key",
		"Less is more",
	],
	product: [
		"Stakeholders want this soon",
		"Let's prioritize the backlog",
		"User feedback is in",
		"Scope looks manageable",
		"Release notes drafted",
		"Feature flag it first",
		"Metrics are trending up",
		"Customer interview tomorrow",
		"That's a good MVP scope",
		"OKRs need updating",
	],
	management: [
		"Team velocity looks good",
		"Sprint planning soon",
		"Blockers cleared",
		"One-on-ones scheduled",
		"Cross-team sync needed",
		"Budget looks on track",
		"Risk register updated",
		"Capacity planning time",
		"Good progress this week",
		"Retro action items done",
	],
	quality: [
		"Found an edge case...",
		"Coverage is improving",
		"Regression suite passed",
		"This needs a test",
		"Load test results are in",
		"Bug triage complete",
		"Smoke tests look good",
		"Performance baseline set",
		"Test data refreshed",
		"Quality gates are green",
	],
	analysis: [
		"The data tells a story...",
		"Interesting correlation here",
		"Dashboards need updating",
		"Hypothesis confirmed",
		"Sample size looks good",
		"Time for A/B results",
		"Funnel drop-off at step 3",
		"Segmentation reveals patterns",
		"Report ready for review",
		"Anomaly detected...",
	],
	operations: [
		"Systems running smoothly",
		"Alert thresholds adjusted",
		"Deployment pipeline green",
		"Monitoring dashboard updated",
		"Incident response drilled",
		"Scaling config optimized",
		"Backup verified",
		"Latency looking good",
		"Cost optimization opportunity",
		"Infrastructure as code",
	],
	orchestration: [
		"Coordinating the teams",
		"All agents reporting in",
		"Workflow is flowing",
		"Dependencies resolved",
		"Integration point verified",
		"Sequencing looks right",
		"Handoff complete",
		"Sync meeting went well",
		"Pipeline stages aligned",
		"Everything on track",
	],
};

const GENERIC_CHATTER: readonly string[] = [
	"Hmm...",
	"Let me think...",
	"Interesting...",
	"Good progress today",
	"Almost there...",
	"Back to it",
	"Focus time",
	"That works!",
	"Need a quick break soon",
	"On it!",
];

const SOCIAL_CHATTER: readonly string[] = [
	"Hey, how's it going?",
	"Nice work on that!",
	"Let's sync up later",
	"Great teamwork",
	"Coffee break anyone?",
	"Shall we pair on this?",
];

// ── Per-agent chatter state ─────────────────────────────────────────

interface ChatterEntry {
	readonly domain: string;
	readonly personality: readonly string[];
	readonly charisma: number;
	timer: number;
	interval: number;
	silencedUntil: number;
	lastIndex: number;
}

// ── Constants ────────────────────────────────────────────────────────

const MIN_INTERVAL = 12000;
const MAX_INTERVAL = 30000;
const LLM_SILENCE_DURATION = 15000;
const STARTUP_QUIET_PERIOD = 10000;

// ── TalkEngine ──────────────────────────────────────────────────────

export interface TalkEngineCallbacks {
	readonly showBubble: (agentName: string, kind: BubbleKind, text: string) => void;
	readonly isIdle: (agentName: string) => boolean;
}

export class TalkEngine {
	private readonly entries = new Map<string, ChatterEntry>();
	private readonly callbacks: TalkEngineCallbacks;

	constructor(callbacks: TalkEngineCallbacks) {
		this.callbacks = callbacks;
	}

	register(name: string, domain: string, personality: readonly string[], charisma: number): void {
		if (this.entries.has(name)) return;
		const interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
		// Stagger startup: each agent starts silent for a random 10-40s window
		const startupSilence = STARTUP_QUIET_PERIOD + Math.random() * MAX_INTERVAL;
		this.entries.set(name, {
			domain: domain.toLowerCase(),
			personality,
			charisma,
			timer: 0,
			interval,
			silencedUntil: performance.now() + startupSilence,
			lastIndex: -1,
		});
	}

	/** Call when an LLM response arrives for an agent — silences chatter. */
	silence(agentName: string): void {
		const entry = this.entries.get(agentName);
		if (entry) {
			entry.silencedUntil = performance.now() + LLM_SILENCE_DURATION;
		}
	}

	update(deltaMs: number): void {
		const now = performance.now();
		for (const [name, entry] of this.entries) {
			if (now < entry.silencedUntil) continue;
			if (!this.callbacks.isIdle(name)) continue;

			entry.timer += deltaMs;
			if (entry.timer >= entry.interval) {
				entry.timer = 0;
				entry.interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
				const phrase = this.pickPhrase(entry);
				this.callbacks.showBubble(name, "thought", phrase);
			}
		}
	}

	private pickPhrase(entry: ChatterEntry): string {
		// Social agents chatter more socially
		if (entry.charisma > 12 && Math.random() < 0.3) {
			return SOCIAL_CHATTER[Math.floor(Math.random() * SOCIAL_CHATTER.length)];
		}

		// Personality-driven quotes
		if (entry.personality.length > 0 && Math.random() < 0.2) {
			return entry.personality[Math.floor(Math.random() * entry.personality.length)];
		}

		// Domain-specific topics
		const domainPhrases = DOMAIN_TOPICS[entry.domain];
		if (domainPhrases && Math.random() < 0.6) {
			let idx: number;
			do {
				idx = Math.floor(Math.random() * domainPhrases.length);
			} while (idx === entry.lastIndex && domainPhrases.length > 1);
			entry.lastIndex = idx;
			return domainPhrases[idx];
		}

		// Generic fallback
		return GENERIC_CHATTER[Math.floor(Math.random() * GENERIC_CHATTER.length)];
	}
}
