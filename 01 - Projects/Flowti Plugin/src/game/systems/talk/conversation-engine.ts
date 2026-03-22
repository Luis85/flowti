/**
 * conversation-engine.ts — Multi-turn scripted conversation system.
 *
 * Selects and plays conversation scripts between agent pairs based on
 * relationship tier, domains, and trigger events. Locks participants
 * during playback to prevent ambient chatter overlap.
 *
 * Integration: The collected-action processor routes social actions here
 * before falling back to one-liner talk engine phrases.
 */

import type {
	ConversationScript, ConversationTrigger, ConversationTurn, RunningJoke, TurnCondition,
} from "./conversation-types.js";
import type { BubbleKind } from "./talk-types.js";
import type { RelationshipTier } from "../relationship-system.js";

// ── Tier ordering for range checks ──────────────────────────────────

const TIER_ORDER: Record<RelationshipTier, number> = {
	rival: 0,
	acquaintance: 1,
	colleague: 2,
	friend: 3,
	"best-friend": 4,
};

function tierInRange(tier: RelationshipTier, range: readonly [RelationshipTier, RelationshipTier]): boolean {
	const val = TIER_ORDER[tier];
	return val >= TIER_ORDER[range[0]] && val <= TIER_ORDER[range[1]];
}

// ── Variable interpolation ──────────────────────────────────────────

const VAR_PATTERN = /\{(\w+)\}/g;

function interpolate(text: string, vars: Record<string, string>): string {
	return text.replace(VAR_PATTERN, (_m, key: string) => vars[key] ?? `{${key}}`);
}

// ── Callbacks ───────────────────────────────────────────────────────

export interface ConversationEngineCallbacks {
	readonly showBubble: (agentName: string, kind: BubbleKind, text: string) => void;
	readonly getTier: (a: string, b: string) => RelationshipTier;
	readonly silenceTalk: (agentName: string) => void;
	readonly recordConversation: (a: string, b: string) => void;
	readonly getJokePlayCount?: (a: string, b: string, jokeId: string) => number;
	readonly incrementJokePlayCount?: (a: string, b: string, jokeId: string) => void;
	readonly externalLockQuery?: (entityId: string) => boolean;
}

// ── Active conversation state ───────────────────────────────────────

interface ActiveConversation {
	readonly scriptId: string;
	readonly agentA: string;
	readonly agentB: string;
	readonly pet?: string;
	readonly vars: Record<string, string>;
	readonly turns: readonly ConversationTurn[];
	currentTurn: number;
	timer: number;
}

// ── Try context ─────────────────────────────────────────────────────

export interface TryScriptContext {
	readonly domainA: string;
	readonly domainB: string;
	readonly pet?: string;
	readonly agentC?: string;
}

// ── Engine ───────────────────────────────────────────────────────────

export class ConversationEngine {
	private readonly callbacks: ConversationEngineCallbacks;
	private readonly scripts: ConversationScript[] = [];
	private readonly jokes: RunningJoke[] = [];
	private readonly locked = new Set<string>();
	private readonly active: ActiveConversation[] = [];
	private readonly cooldowns = new Map<string, number>();

	constructor(callbacks: ConversationEngineCallbacks) {
		this.callbacks = callbacks;
	}

	get scriptCount(): number {
		return this.scripts.length + this.jokes.length;
	}

	registerScripts(scripts: readonly ConversationScript[]): void {
		this.scripts.push(...scripts);
	}

	registerJokes(jokes: readonly RunningJoke[]): void {
		this.jokes.push(...jokes);
	}

	isLocked(name: string): boolean {
		return this.locked.has(name);
	}

	tryScript(agentA: string, agentB: string, trigger: ConversationTrigger, ctx: TryScriptContext): boolean {
		if (this.locked.has(agentA) || this.locked.has(agentB)) return false;

		if (this.callbacks.externalLockQuery) {
			if (this.callbacks.externalLockQuery(agentA) || this.callbacks.externalLockQuery(agentB)) return false;
			if (ctx.pet && this.callbacks.externalLockQuery(ctx.pet)) return false;
		}

		const tier = this.callbacks.getTier(agentA, agentB);
		const now = performance.now();

		const eligible = this.filterEligibleScripts(trigger, tier, ctx, now);
		const eligibleJokes = this.filterEligibleJokes(trigger, tier, ctx, now);

		if (eligible.length === 0 && eligibleJokes.length === 0) return false;

		if (eligibleJokes.length > 0 && (eligible.length === 0 || Math.random() < 0.3)) {
			if (this.tryPlayJoke(eligibleJokes, agentA, agentB, ctx)) return true;
		}

		const script = this.weightedPick(eligible);
		if (!script) return false;

		const vars = this.buildVars(agentA, agentB, ctx);
		this.startScript(script, agentA, agentB, vars, ctx.pet);
		return true;
	}

	/** Convenience wrapper: trigger a gossip conversation about an absent third agent. */
	gossipAbout(agentA: string, agentB: string, subject: string, ctx: TryScriptContext): boolean {
		return this.tryScript(agentA, agentB, "gossip", { ...ctx, agentC: subject });
	}

	private buildVars(agentA: string, agentB: string, ctx: TryScriptContext): Record<string, string> {
		return {
			agentA,
			agentB,
			domain_a: ctx.domainA,
			domain_b: ctx.domainB,
			pet: ctx.pet ?? "",
			agentC: ctx.agentC ?? "",
		};
	}

	private tryPlayJoke(eligibleJokes: RunningJoke[], agentA: string, agentB: string, ctx: TryScriptContext): boolean {
		const joke = this.weightedPickJoke(eligibleJokes);
		if (!joke) return false;
		const playCount = this.callbacks.getJokePlayCount?.(agentA, agentB, joke.id) ?? 0;
		const variantIndex = Math.min(playCount, joke.maxEscalation - 1);
		const turns = joke.variants[variantIndex];
		const vars = this.buildVars(agentA, agentB, ctx);
		this.startJoke(joke, agentA, agentB, turns, vars, ctx.pet);
		return true;
	}

	update(deltaMs: number): void {
		const completed: number[] = [];

		for (let i = 0; i < this.active.length; i++) {
			const conv = this.active[i];
			conv.timer += deltaMs;

			const turn = conv.turns[conv.currentTurn];
			if (!turn || conv.timer < turn.delayMs) continue;

			conv.timer = 0;

			// Check condition — skip turn if not met
			if (!this.evaluateCondition(turn.condition, conv)) {
				conv.currentTurn++;
				if (conv.currentTurn >= conv.turns.length) {
					completed.push(i);
				}
				continue;
			}

			const speaker = turn.speaker === "A" ? conv.agentA
				: turn.speaker === "B" ? conv.agentB
				: conv.pet ?? conv.agentA;
			const text = interpolate(turn.text, conv.vars);
			this.callbacks.showBubble(speaker, turn.kind, text);

			conv.currentTurn++;
			if (conv.currentTurn >= conv.turns.length) {
				completed.push(i);
			}
		}

		// Remove completed conversations in reverse order
		for (let i = completed.length - 1; i >= 0; i--) {
			const conv = this.active[completed[i]];
			this.locked.delete(conv.agentA);
			this.locked.delete(conv.agentB);
			if (conv.pet) this.locked.delete(conv.pet);
			this.callbacks.recordConversation(conv.agentA, conv.agentB);
			// If this was a running joke, increment play count
			const joke = this.jokes.find((j) => j.id === conv.scriptId);
			if (joke && this.callbacks.incrementJokePlayCount) {
				this.callbacks.incrementJokePlayCount(conv.agentA, conv.agentB, joke.id);
			}
			this.active.splice(completed[i], 1);
		}
	}

	private evaluateCondition(condition: TurnCondition | undefined, conv: ActiveConversation): boolean {
		if (!condition) return true;
		switch (condition.type) {
			case "petPresent":
				return !!conv.pet;
			case "thirdAgentNearby":
				return !!conv.vars.agentC;
			case "tier":
			case "mood":
				// These require runtime state we don't have in the conversation context
				// For now, always pass — future enhancement can wire in live state
				return true;
			default:
				return true;
		}
	}

	private startScript(script: ConversationScript, agentA: string, agentB: string, vars: Record<string, string>, pet?: string): void {
		this.locked.add(agentA);
		this.locked.add(agentB);
		if (pet) this.locked.add(pet);

		this.callbacks.silenceTalk(agentA);
		this.callbacks.silenceTalk(agentB);
		if (pet) this.callbacks.silenceTalk(pet);

		this.cooldowns.set(script.id, performance.now());

		const firstTurn = script.turns[0];
		if (firstTurn && firstTurn.delayMs === 0) {
			const speaker = firstTurn.speaker === "A" ? agentA
				: firstTurn.speaker === "B" ? agentB
				: pet ?? agentA;
			this.callbacks.showBubble(speaker, firstTurn.kind, interpolate(firstTurn.text, vars));

			this.active.push({
				scriptId: script.id,
				agentA,
				agentB,
				pet,
				vars,
				turns: script.turns,
				currentTurn: 1,
				timer: 0,
			});
		} else {
			this.active.push({
				scriptId: script.id,
				agentA,
				agentB,
				pet,
				vars,
				turns: script.turns,
				currentTurn: 0,
				timer: 0,
			});
		}
	}

	private filterEligibleScripts(trigger: ConversationTrigger, tier: RelationshipTier, ctx: TryScriptContext, now: number): ConversationScript[] {
		return this.scripts.filter((s) => {
			if (s.trigger !== trigger) return false;
			if (!tierInRange(tier, s.tierRange)) return false;
			if (s.domainFilter) {
				const pair = [ctx.domainA, ctx.domainB].sort();
				const filterPair = [...s.domainFilter].sort();
				if (pair[0] !== filterPair[0] || pair[1] !== filterPair[1]) return false;
			}
			const lastUsed = this.cooldowns.get(s.id) ?? 0;
			return now - lastUsed >= s.cooldownMs;
		});
	}

	private filterEligibleJokes(trigger: ConversationTrigger, tier: RelationshipTier, ctx: TryScriptContext, now: number): RunningJoke[] {
		return this.jokes.filter((j) => {
			if (j.trigger !== trigger) return false;
			if (!tierInRange(tier, j.tierRange)) return false;
			if (j.domainFilter) {
				const pair = [ctx.domainA, ctx.domainB].sort();
				const filterPair = [...j.domainFilter].sort();
				if (pair[0] !== filterPair[0] || pair[1] !== filterPair[1]) return false;
			}
			const lastUsed = this.cooldowns.get(j.id) ?? 0;
			return now - lastUsed >= j.cooldownMs;
		});
	}

	private weightedPick(scripts: readonly ConversationScript[]): ConversationScript | undefined {
		const totalWeight = scripts.reduce((sum, s) => sum + s.weight, 0);
		let roll = Math.random() * totalWeight;
		for (const s of scripts) {
			roll -= s.weight;
			if (roll <= 0) return s;
		}
		return scripts[scripts.length - 1];
	}

	private weightedPickJoke(jokes: readonly RunningJoke[]): RunningJoke | undefined {
		const totalWeight = jokes.reduce((sum, j) => sum + j.weight, 0);
		let roll = Math.random() * totalWeight;
		for (const j of jokes) {
			roll -= j.weight;
			if (roll <= 0) return j;
		}
		return jokes[jokes.length - 1];
	}

	private startJoke(joke: RunningJoke, agentA: string, agentB: string, turns: readonly ConversationTurn[], vars: Record<string, string>, pet?: string): void {
		this.locked.add(agentA);
		this.locked.add(agentB);
		if (pet) this.locked.add(pet);

		this.callbacks.silenceTalk(agentA);
		this.callbacks.silenceTalk(agentB);
		if (pet) this.callbacks.silenceTalk(pet);

		this.cooldowns.set(joke.id, performance.now());

		const firstTurn = turns[0];
		if (firstTurn && firstTurn.delayMs === 0) {
			const speaker = firstTurn.speaker === "A" ? agentA
				: firstTurn.speaker === "B" ? agentB
				: pet ?? agentA;
			this.callbacks.showBubble(speaker, firstTurn.kind, interpolate(firstTurn.text, vars));

			this.active.push({
				scriptId: joke.id,
				agentA,
				agentB,
				pet,
				vars,
				turns,
				currentTurn: 1,
				timer: 0,
			});
		} else {
			this.active.push({
				scriptId: joke.id,
				agentA,
				agentB,
				pet,
				vars,
				turns,
				currentTurn: 0,
				timer: 0,
			});
		}
	}
}
