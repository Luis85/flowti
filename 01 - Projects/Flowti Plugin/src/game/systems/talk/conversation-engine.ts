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
	ConversationScript, ConversationTrigger, ConversationTurn, RunningJoke,
} from "./conversation-types.js";
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
	readonly showBubble: (agentName: string, kind: string, text: string) => void;
	readonly getTier: (a: string, b: string) => RelationshipTier;
	readonly silenceTalk: (agentName: string) => void;
	readonly recordConversation: (a: string, b: string) => void;
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

		const tier = this.callbacks.getTier(agentA, agentB);
		const now = performance.now();

		const eligible = this.scripts.filter((s) => {
			if (s.trigger !== trigger) return false;
			if (!tierInRange(tier, s.tierRange)) return false;
			if (s.domainFilter) {
				const pair = [ctx.domainA, ctx.domainB].sort();
				const filterPair = [...s.domainFilter].sort();
				if (pair[0] !== filterPair[0] || pair[1] !== filterPair[1]) return false;
			}
			const lastUsed = this.cooldowns.get(s.id) ?? 0;
			if (now - lastUsed < s.cooldownMs) return false;
			return true;
		});

		if (eligible.length === 0) return false;

		const script = this.weightedPick(eligible);
		if (!script) return false;

		const vars: Record<string, string> = {
			agentA,
			agentB,
			domain_a: ctx.domainA,
			domain_b: ctx.domainB,
			pet: ctx.pet ?? "",
		};

		this.startScript(script, agentA, agentB, vars, ctx.pet);
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
			this.active.splice(completed[i], 1);
		}
	}

	private startScript(script: ConversationScript, agentA: string, agentB: string, vars: Record<string, string>, pet?: string): void {
		this.locked.add(agentA);
		this.locked.add(agentB);
		if (pet) this.locked.add(pet);

		this.callbacks.silenceTalk(agentA);
		this.callbacks.silenceTalk(agentB);

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

	private weightedPick(scripts: readonly ConversationScript[]): ConversationScript | undefined {
		const totalWeight = scripts.reduce((sum, s) => sum + s.weight, 0);
		let roll = Math.random() * totalWeight;
		for (const s of scripts) {
			roll -= s.weight;
			if (roll <= 0) return s;
		}
		return scripts[scripts.length - 1];
	}
}
