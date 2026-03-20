/**
 * talk-engine.ts — Template-driven ambient chatter system for agent liveliness.
 *
 * Each agent periodically "says" domain-relevant phrases as thought bubbles.
 * Templates are resolved using a weighted random selection with priority:
 *   1. Agent's own domain templates (highest weight)
 *   2. Social templates (if nearby agents exist)
 *   3. Core templates (fallback)
 *
 * When an LLM response arrives, the agent is silenced for a cooldown period
 * so the real response takes precedence. Staggered startup prevents all
 * agents from chattering simultaneously on load.
 */

import type { BubbleKind, TemplateVars, WeightedTemplate } from "./talk-types.js";
import { DOMAIN_TEMPLATES, coreTemplates, socialTemplates } from "./templates/index.js";

// ── Per-agent chatter state ─────────────────────────────────────────

interface ChatterEntry {
	readonly domain: string;
	readonly personality: readonly string[];
	readonly charisma: number;
	timer: number;
	interval: number;
	silencedUntil: number;
	lastTemplate: string;
	vars: TemplateVars;
	activated: boolean;
}

// ── Constants ────────────────────────────────────────────────────────

const MIN_INTERVAL = 12000;
const MAX_INTERVAL = 30000;
const LLM_SILENCE_DURATION = 15000;
const STARTUP_QUIET_PERIOD = 10000;

// ── Variable interpolation ──────────────────────────────────────────

const VAR_PATTERN = /\{(\w+)\}/g;

/** Replace `{variable}` tokens in a template string with values from vars. */
function interpolate(template: string, vars: TemplateVars): string {
	return template.replace(VAR_PATTERN, (_match, key: string) => {
		const value = vars[key as keyof TemplateVars];
		return value !== undefined ? value : `{${key}}`;
	});
}

// ── Weighted random selection ───────────────────────────────────────

/** Pick a random template from a weighted list. */
function weightedRandom(templates: readonly WeightedTemplate[]): WeightedTemplate | undefined {
	if (templates.length === 0) return undefined;
	const totalWeight = templates.reduce((sum, t) => sum + t.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const t of templates) {
		roll -= t.weight;
		if (roll <= 0) return t;
	}
	return templates[templates.length - 1];
}

/** Collect all templates from a TemplateSet into a flat array. */
function flattenTemplates(categories: Record<string, WeightedTemplate[]>): WeightedTemplate[] {
	const result: WeightedTemplate[] = [];
	for (const group of Object.values(categories)) {
		for (const t of group) {
			result.push(t);
		}
	}
	return result;
}

// ── Default template vars ───────────────────────────────────────────

function defaultVars(domain: string): TemplateVars {
	return {
		task: "",
		mood_adj: "focused",
		role: "team member",
		domain,
		idle_action: "thinking quietly",
		nearby_agent: "",
		persona_quirk: "",
	};
}

// ── TalkEngine ──────────────────────────────────────────────────────

export interface TalkEngineCallbacks {
	readonly showBubble: (agentName: string, kind: BubbleKind, text: string) => void;
	readonly isIdle: (agentName: string) => boolean;
	readonly isOnScene?: (agentName: string) => boolean;
	readonly isWaiting?: (agentName: string) => boolean;
}

/** Minimum gap between any two agents talking (prevents exact-same-frame stacking). */
const MIN_GAP = 2000;

export class TalkEngine {
	private readonly entries = new Map<string, ChatterEntry>();
	private readonly callbacks: TalkEngineCallbacks;
	private lastGlobalTalk = 0;

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
			lastTemplate: "",
			vars: defaultVars(domain.toLowerCase()),
			activated: false,
		});
	}

	/** Update the template variables for an agent (e.g., when task or mood changes). */
	updateVars(agentName: string, vars: Partial<TemplateVars>): void {
		const entry = this.entries.get(agentName);
		if (entry) {
			entry.vars = { ...entry.vars, ...vars };
		}
	}

	/** Call when an LLM response arrives for an agent — silences chatter. */
	silence(agentName: string): void {
		const entry = this.entries.get(agentName);
		if (entry) {
			entry.silencedUntil = performance.now() + LLM_SILENCE_DURATION;
			entry.interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
			entry.activated = false;
		}
	}

	/** Call when waiting for LLM — activates rapid chatter ("thinking aloud"). */
	activate(agentName: string): void {
		const entry = this.entries.get(agentName);
		if (entry) {
			entry.silencedUntil = 0;
			entry.timer = 0; // start from zero — first chatter after initial delay
			entry.interval = 2000 + Math.random() * 1500; // 2-3.5s before first "thinking" phrase
			entry.activated = true;
		}
	}

	update(deltaMs: number): void {
		const now = performance.now();
		for (const [name, entry] of this.entries) {
			// Skip agents not present in the current scene
			if (this.callbacks.isOnScene && !this.callbacks.isOnScene(name)) continue;
			if (now < entry.silencedUntil) continue;
			// Activated agents (waiting for LLM) always chatter, idle agents chatter normally
			if (!entry.activated && !this.callbacks.isIdle(name)) continue;

			entry.timer += deltaMs;
			if (entry.timer >= entry.interval) {
				// If another agent just talked, nudge this one forward a bit instead of dropping it
				if (!entry.activated && now - this.lastGlobalTalk < MIN_GAP) {
					entry.timer = entry.interval - (MIN_GAP - (now - this.lastGlobalTalk));
					continue;
				}

				entry.timer = 0;
				if (entry.activated) {
					entry.interval = 3000 + Math.random() * 4000; // keep rapid pace
				} else {
					entry.interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
				}
				const phrase = this.resolvePhrase(entry);
				this.callbacks.showBubble(name, "thought", phrase);
				this.lastGlobalTalk = now;
			}
		}
	}

	// ── Template resolution ─────────────────────────────────────────

	private resolvePhrase(entry: ChatterEntry): string {
		// When activated (waiting for LLM), strongly prefer "waiting" category
		if (entry.activated) {
			// 70% domain waiting, 30% core waiting
			const domainSet = DOMAIN_TEMPLATES.get(entry.domain);
			const domainWaiting = domainSet?.categories["waiting"] ?? [];
			const coreWaiting = coreTemplates.categories["waiting"] ?? [];

			const pool = Math.random() < 0.7 && domainWaiting.length > 0 ? domainWaiting : coreWaiting;
			const picked = weightedRandom(pool);
			if (picked) {
				const result = interpolate(picked.template, entry.vars);
				if (result !== entry.lastTemplate) {
					entry.lastTemplate = result;
					return result;
				}
			}
			// Fall through to normal resolution if we picked the same template
		}

		// 1. Personality-driven quotes (20% chance)
		if (entry.personality.length > 0 && Math.random() < 0.2) {
			return entry.personality[Math.floor(Math.random() * entry.personality.length)];
		}

		// 2. Social templates for charismatic agents (30% chance when charisma > 12)
		if (!entry.activated && entry.charisma > 12 && Math.random() < 0.3) {
			const socialPool = flattenTemplates(socialTemplates.categories);
			const picked = weightedRandom(socialPool);
			if (picked) {
				const result = interpolate(picked.template, entry.vars);
				if (result !== entry.lastTemplate) {
					entry.lastTemplate = result;
					return result;
				}
			}
		}

		// 3. Domain-specific templates (60% chance)
		const domainSet = DOMAIN_TEMPLATES.get(entry.domain);
		if (domainSet && Math.random() < 0.6) {
			const domainPool = flattenTemplates(domainSet.categories);
			const picked = weightedRandom(domainPool);
			if (picked) {
				const result = interpolate(picked.template, entry.vars);
				if (result !== entry.lastTemplate) {
					entry.lastTemplate = result;
					return result;
				}
			}
		}

		// 4. Core templates (fallback)
		const corePool = flattenTemplates(coreTemplates.categories);
		const picked = weightedRandom(corePool);
		if (picked) {
			const result = interpolate(picked.template, entry.vars);
			entry.lastTemplate = result;
			return result;
		}

		// Ultimate fallback (should never reach here)
		return "...";
	}
}
