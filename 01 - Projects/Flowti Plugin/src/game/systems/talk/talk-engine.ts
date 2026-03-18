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
			lastTemplate: "",
			vars: defaultVars(domain.toLowerCase()),
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
				const phrase = this.resolvePhrase(entry);
				this.callbacks.showBubble(name, "thought", phrase);
			}
		}
	}

	// ── Template resolution ─────────────────────────────────────────

	private resolvePhrase(entry: ChatterEntry): string {
		// 1. Personality-driven quotes (20% chance, preserved from original)
		if (entry.personality.length > 0 && Math.random() < 0.2) {
			return entry.personality[Math.floor(Math.random() * entry.personality.length)];
		}

		// 2. Social templates for charismatic agents (30% chance when charisma > 12)
		if (entry.charisma > 12 && Math.random() < 0.3) {
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
