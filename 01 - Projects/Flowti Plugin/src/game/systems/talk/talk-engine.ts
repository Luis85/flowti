/**
 * talk-engine.ts — Template-driven ambient chatter system for agent liveliness.
 *
 * Each agent periodically "says" domain-relevant phrases as thought bubbles.
 * Templates are resolved using a weighted random selection with priority:
 *   1. Active phrase chain (if one is playing)
 *   2. Reactive trigger (immediate, event-driven)
 *   3. Mood-flavored variant (15% chance, based on current mood)
 *   4. Tier-modified phrase (15% chance, wraps base with tier prefix/suffix)
 *   5. Composed fragment (25% chance, assembled from fragment pools)
 *   6. Crossover templates (when nearby agent is from a different domain)
 *   7. Agent's own domain templates (highest weight)
 *   8. Social templates (if nearby agents exist)
 *   9. Core templates (fallback)
 *
 * Features:
 *   - Conversational memory: avoids repeating recent phrases (last 15)
 *   - Phrase chains: multi-step thought sequences with timed delays
 *   - Reactive triggers: immediate phrases from state changes
 *   - Context-aware: phase, weather, streaks, relationships in template vars
 *   - Mood overlay: mood-influenced phrase selection
 *   - Domain crossover: specialized lines for cross-domain conversations
 *
 * When an LLM response arrives, the agent is silenced for a cooldown period
 * so the real response takes precedence. Staggered startup prevents all
 * agents from chattering simultaneously on load.
 */

import type { BubbleKind, TemplateVars, WeightedTemplate } from "./talk-types.js";
import { DOMAIN_TEMPLATES, coreTemplates, socialTemplates } from "./templates/index.js";
import { REACTIVE_TEMPLATES, type ReactiveTrigger } from "./templates/reactive-phrases.js";
import { PHRASE_CHAINS, type PhraseChain } from "./templates/phrase-chains.js";
import { findCrossover } from "./templates/crossover-templates.js";
import { MOOD_VARIANTS, type AgentMood } from "./templates/mood-variants.js";
import type { FragmentComposer, ComposeContext } from "./fragment-composer.js";
import { TIER_PREFIXES, TIER_SUFFIXES } from "./templates/tier-modifiers.js";
import type { RelationshipTier } from "../relationship-system.js";
import type { DialogueBias } from "../echo/echo-types.js";

// ── Per-agent chatter state ─────────────────────────────────────────

interface ChatterEntry {
	readonly domain: string;
	readonly personality: readonly string[];
	readonly charisma: number;
	timer: number;
	interval: number;
	silencedUntil: number;
	vars: TemplateVars;
	activated: boolean;
	/** Recently used phrases — dedup buffer to avoid repetition. */
	recentlyUsed: string[];
	/** Active phrase chain being played out. */
	activeChain: PhraseChain | null;
	activeChainStep: number;
	activeChainTimer: number;
}

// ── Constants ────────────────────────────────────────────────────────

const MIN_INTERVAL = 12000;
const MAX_INTERVAL = 30000;
const LLM_SILENCE_DURATION = 15000;
const STARTUP_QUIET_PERIOD = 10000;
const DEDUP_BUFFER_SIZE = 25;
const CHAIN_CHANCE = 0.08;
const MOOD_CHANCE = 0.15;
const CROSSOVER_CHANCE = 0.25;
const TIER_MODIFIER_CHANCE = 0.15;
const COMPOSE_CHANCE = 0.25;

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

/** Pick a random template from a weighted list, avoiding recently used phrases. */
function weightedRandom(templates: readonly WeightedTemplate[], avoid: readonly string[]): WeightedTemplate | undefined {
	if (templates.length === 0) return undefined;
	// Filter out recently used
	const avoidSet = new Set(avoid);
	const filtered = templates.filter((t) => !avoidSet.has(t.template));
	const pool = filtered.length > 0 ? filtered : templates; // fallback to full pool if all filtered
	const totalWeight = pool.reduce((sum, t) => sum + t.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const t of pool) {
		roll -= t.weight;
		if (roll <= 0) return t;
	}
	return pool[pool.length - 1];
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
		nearby_domain: "",
		persona_quirk: "",
		phase: "afternoon",
		weather: "clear",
		streak: "0",
		friend_name: "",
		mood: "neutral",
		pet_name: "",
		pet_type: "",
		owner_name: "",
		nearby_agent_mood: "",
		hunger_level: "",
		affection_level: "",
	};
}

// ── Phrase resolution helpers ────────────────────────────────────────

function resolveActivatedPhrase(entry: ChatterEntry): string | null {
	if (!entry.activated) return null;
	const domainSet = DOMAIN_TEMPLATES.get(entry.domain);
	const domainWaiting = domainSet?.categories["waiting"] ?? [];
	const coreWaiting = coreTemplates.categories["waiting"] ?? [];
	const pool = Math.random() < 0.7 && domainWaiting.length > 0 ? domainWaiting : coreWaiting;
	const picked = weightedRandom(pool, entry.recentlyUsed);
	return picked ? interpolate(picked.template, entry.vars) : null;
}

function resolveMoodPhrase(entry: ChatterEntry): string | null {
	const mood = entry.vars.mood as AgentMood;
	if (!mood || mood === "neutral" || Math.random() >= MOOD_CHANCE) return null;
	const moodPool = MOOD_VARIANTS[mood];
	if (!moodPool || moodPool.length === 0) return null;
	const picked = weightedRandom(moodPool, entry.recentlyUsed);
	return picked ? interpolate(picked.template, entry.vars) : null;
}

function resolveCrossoverPhrase(entry: ChatterEntry): string | null {
	if (!entry.vars.nearby_agent || !entry.vars.nearby_domain) return null;
	if (entry.vars.nearby_domain === entry.domain) return null;
	if (Math.random() >= CROSSOVER_CHANCE) return null;
	const crossover = findCrossover(entry.domain, entry.vars.nearby_domain);
	if (!crossover) return null;
	const lines = crossover.domainA === entry.domain ? crossover.linesA : crossover.linesB;
	const picked = weightedRandom(lines, entry.recentlyUsed);
	return picked ? interpolate(picked.template, entry.vars) : null;
}

function resolvePersonalityPhrase(entry: ChatterEntry): string | null {
	if (entry.personality.length === 0 || Math.random() >= 0.2) return null;
	const quote = entry.personality[Math.floor(Math.random() * entry.personality.length)];
	return !entry.recentlyUsed.includes(quote) ? quote : null;
}

function resolveSocialPhrase(entry: ChatterEntry): string | null {
	if (entry.activated || entry.charisma <= 12 || Math.random() >= 0.3) return null;
	const socialPool = flattenTemplates(socialTemplates.categories);
	const picked = weightedRandom(socialPool, entry.recentlyUsed);
	return picked ? interpolate(picked.template, entry.vars) : null;
}

function resolveDomainPhrase(entry: ChatterEntry): string | null {
	const domainSet = DOMAIN_TEMPLATES.get(entry.domain);
	if (!domainSet || Math.random() >= 0.6) return null;
	const domainPool = flattenTemplates(domainSet.categories);
	const picked = weightedRandom(domainPool, entry.recentlyUsed);
	return picked ? interpolate(picked.template, entry.vars) : null;
}

function resolveCorePhrase(entry: ChatterEntry): string | null {
	const corePool = flattenTemplates(coreTemplates.categories);
	const picked = weightedRandom(corePool, entry.recentlyUsed);
	return picked ? interpolate(picked.template, entry.vars) : null;
}

function resolveTierPhrase(
	agentName: string,
	entry: ChatterEntry,
	getTier: (a: string, b: string) => RelationshipTier,
): string | null {
	if (!entry.vars.nearby_agent || Math.random() >= TIER_MODIFIER_CHANCE) return null;
	const tier = getTier(agentName, entry.vars.nearby_agent);
	const prefixes = TIER_PREFIXES[tier];
	const suffixes = TIER_SUFFIXES[tier];
	if (!prefixes || !suffixes) return null;

	const base = resolveDomainPhrase(entry) ?? resolveCorePhrase(entry);
	if (!base) return null;

	if (Math.random() < 0.5) {
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		return interpolate(prefix, entry.vars) + " " + base;
	}
	const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
	return base + " " + suffix;
}

function resolveComposedPhrase(
	agentName: string,
	entry: ChatterEntry,
	composer: FragmentComposer,
	getTier?: (a: string, b: string) => RelationshipTier,
): string | null {
	if (Math.random() >= COMPOSE_CHANCE) return null;
	const context: ComposeContext = {
		mood: entry.vars.mood || undefined,
		domain: entry.domain,
		tier: entry.vars.nearby_agent && agentName && getTier
			? getTier(agentName, entry.vars.nearby_agent)
			: undefined,
	};
	return composer.compose(context, entry.recentlyUsed);
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

export interface TalkEngineEnrichment {
	readonly composer?: FragmentComposer;
	readonly getTier?: (a: string, b: string) => RelationshipTier;
	readonly getEchoBias?: (agent: string) => DialogueBias;
}

export class TalkEngine {
	private readonly entries = new Map<string, ChatterEntry>();
	private readonly callbacks: TalkEngineCallbacks;
	private readonly enrichment: TalkEngineEnrichment;
	private lastGlobalTalk = 0;

	constructor(callbacks: TalkEngineCallbacks, enrichment?: TalkEngineEnrichment) {
		this.callbacks = callbacks;
		this.enrichment = enrichment ?? {};
	}

	/** Remove an agent from ambient chatter (roster removed). */
	unregister(name: string): void {
		this.entries.delete(name);
	}

	register(name: string, domain: string, personality: readonly string[], charisma: number): void {
		if (this.entries.has(name)) return;
		const interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
		const startupSilence = STARTUP_QUIET_PERIOD + Math.random() * MAX_INTERVAL;
		this.entries.set(name, {
			domain: domain.toLowerCase(),
			personality,
			charisma,
			timer: 0,
			interval,
			silencedUntil: performance.now() + startupSilence,
			vars: defaultVars(domain.toLowerCase()),
			activated: false,
			recentlyUsed: [],
			activeChain: null,
			activeChainStep: 0,
			activeChainTimer: 0,
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
			entry.activeChain = null; // cancel any active chain
		}
	}

	/** Call when waiting for LLM — activates rapid chatter ("thinking aloud"). */
	activate(agentName: string): void {
		const entry = this.entries.get(agentName);
		if (entry) {
			entry.silencedUntil = 0;
			entry.timer = 0;
			entry.interval = 2000 + Math.random() * 1500;
			entry.activated = true;
		}
	}

	/** Fire an immediate reactive phrase based on a state change. */
	triggerReactive(agentName: string, trigger: ReactiveTrigger): void {
		const entry = this.entries.get(agentName);
		if (!entry) return;
		const pool = REACTIVE_TEMPLATES[trigger];
		if (!pool || pool.length === 0) return;
		const picked = weightedRandom(pool, entry.recentlyUsed);
		if (picked) {
			const text = interpolate(picked.template, entry.vars);
			this.recordPhrase(entry, text);
			this.callbacks.showBubble(agentName, "thought", text);
		}
	}

	/**
	 * @param recordAgent optional wall-time recorder for canvas perf (per agent per frame).
	 */
	update(deltaMs: number, recordAgent?: (name: string, durationMs: number) => void): void {
		const now = performance.now();
		for (const [name, entry] of this.entries) {
			const work = (): void => {
				if (this.callbacks.isOnScene && !this.callbacks.isOnScene(name)) return;
				if (now < entry.silencedUntil) return;

				if (entry.activeChain) {
					this.advanceChain(name, entry, deltaMs);
					return;
				}

				if (!entry.activated && !this.callbacks.isIdle(name)) return;

				entry.timer += deltaMs;
				if (entry.timer >= entry.interval) {
					this.fireChatter(name, entry, now);
				}
			};

			if (recordAgent) {
				const t0 = performance.now();
				work();
				recordAgent(name, performance.now() - t0);
			} else {
				work();
			}
		}
	}

	/** Advance an active phrase chain for an agent. */
	private advanceChain(name: string, entry: ChatterEntry, deltaMs: number): void {
		entry.activeChainTimer += deltaMs;
		const step = entry.activeChain!.steps[entry.activeChainStep];
		if (!step || entry.activeChainTimer < step.delayMs) return;

		entry.activeChainTimer = 0;
		const text = interpolate(step.text, entry.vars);
		this.callbacks.showBubble(name, step.kind, text);
		this.recordPhrase(entry, text);
		entry.activeChainStep++;
		if (entry.activeChainStep >= entry.activeChain!.steps.length) {
			entry.activeChain = null;
			entry.timer = 0;
			entry.interval = MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
		}
	}

	/** Fire a chatter line or start a chain when the timer expires. */
	private fireChatter(name: string, entry: ChatterEntry, now: number): void {
		if (!entry.activated && now - this.lastGlobalTalk < MIN_GAP) {
			entry.timer = entry.interval - (MIN_GAP - (now - this.lastGlobalTalk));
			return;
		}

		entry.timer = 0;
		entry.interval = entry.activated
			? 3000 + Math.random() * 4000
			: MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);

		if (!entry.activated && Math.random() < CHAIN_CHANCE) {
			const chain = this.pickChain(entry);
			if (chain) {
				entry.activeChain = chain;
				entry.activeChainStep = 0;
				entry.activeChainTimer = 0;
				const firstStep = chain.steps[0];
				const text = interpolate(firstStep.text, entry.vars);
				this.callbacks.showBubble(name, firstStep.kind, text);
				this.recordPhrase(entry, text);
				entry.activeChainStep = 1;
				this.lastGlobalTalk = now;
				return;
			}
		}

		// Echo-driven mood bias — override mood before phrase resolution
		if (this.enrichment.getEchoBias) {
			const bias = this.enrichment.getEchoBias(name);
			if (bias.moodOverride) {
				entry.vars = {
					...entry.vars,
					mood: bias.moodOverride,
					mood_adj: bias.moodOverride === "tired" ? "drained" : "energized",
				};
			}

			// Memory boost — set friend_name to strongest shared memory partner
			if (bias.memoryBoosts.size > 0) {
				let bestMemory = "";
				let bestWeight = 0;
				for (const [target, weight] of bias.memoryBoosts) {
					if (weight > bestWeight) { bestMemory = target; bestWeight = weight; }
				}
				if (bestMemory) {
					entry.vars = { ...entry.vars, friend_name: bestMemory };
				}
			}
		}

		const phrase = this.resolvePhrase(name, entry);
		if (!phrase.trim()) {
			this.lastGlobalTalk = now;
			return;
		}
		this.callbacks.showBubble(name, "thought", phrase);
		this.recordPhrase(entry, phrase);
		this.lastGlobalTalk = now;
	}

	// ── Template resolution ─────────────────────────────────────────

	private resolvePhrase(agentName: string, entry: ChatterEntry): string {
		return resolveActivatedPhrase(entry)
			?? resolveMoodPhrase(entry)
			?? (this.enrichment.getTier
				? resolveTierPhrase(agentName, entry, this.enrichment.getTier)
				: null)
			?? (this.enrichment.composer
				? resolveComposedPhrase(agentName, entry, this.enrichment.composer, this.enrichment.getTier)
				: null)
			?? resolveCrossoverPhrase(entry)
			?? resolvePersonalityPhrase(entry)
			?? resolveSocialPhrase(entry)
			?? resolveDomainPhrase(entry)
			?? resolveCorePhrase(entry)
			?? "";
	}

	// ── Chain selection ──────────────────────────────────────────────

	private pickChain(entry: ChatterEntry): PhraseChain | null {
		// Determine agent state for chain trigger matching
		// We check via domain because we don't have agentName here — isIdle defaults to idle for unknown
		const eligible = PHRASE_CHAINS.filter(
			(c) => c.trigger === "idle" || c.trigger === "any",
		);
		if (eligible.length === 0) return null;
		const totalWeight = eligible.reduce((sum, c) => sum + c.weight, 0);
		let roll = Math.random() * totalWeight;
		for (const c of eligible) {
			roll -= c.weight;
			if (roll <= 0) return c;
		}
		return eligible[eligible.length - 1];
	}

	// ── Dedup buffer management ─────────────────────────────────────

	private recordPhrase(entry: ChatterEntry, phrase: string): void {
		entry.recentlyUsed.push(phrase);
		if (entry.recentlyUsed.length > DEDUP_BUFFER_SIZE) {
			entry.recentlyUsed.shift();
		}
	}
}
