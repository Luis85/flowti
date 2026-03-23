/**
 * visual-feedback-system.ts — Presentation director for agent visual feedback.
 *
 * Pure logic — no ExcaliburJS imports. Reads blackboard state each frame,
 * detects intent transitions, computes urgency, and emits typed visual
 * commands via callbacks. A thin render adapter translates these into
 * ExcaliburJS actor operations.
 */

import type { AgentBlackboard } from "./blackboard.js";
import type { SpritePreset } from "./particle-system.js";
import {
	resolveThreshold,
	computeUrgency,
	classifyUrgency,
	INTENT_SPRITES,
	ITEM_POP_SPRITES,
	TIMING,
	COOLDOWNS,
	URGENCY_SPEED_MULTIPLIERS,
	EMOTE_INDICES,
	IDLE_AWARENESS,
	type UrgencyTier,
} from "./visual-feedback-presets.js";

// ── Callback types ───────────────────────────────────────────────

export interface VisualFeedbackCallbacks {
	onShowIntentIcon: (agentName: string, spritePath: string, position: { x: number; y: number }) => void;
	onHideIntentIcon: (agentName: string) => void;
	onItemPop: (agentName: string, spritePath: string, fromPos: { x: number; y: number }) => void;
	onParticleBurst: (preset: SpritePreset, position: { x: number; y: number }) => void;
	onEmoteFlash: (agentName: string, emoteIndex: number) => void;
	onThoughtBubble: (agentName: string, text: string, iconPath?: string, duration?: number) => void;
	onFacingChange: (agentName: string, direction: "left" | "right") => void;
}

// ── Per-agent visual state ───────────────────────────────────────

interface AgentVisualState {
	quirks: readonly string[];
	lastIntent: string;
	lastIntentDetail: string;
	intentIconShowing: boolean;
	lastPayoffTimestamp: number;
	lastAmbientEmoteTimestamp: number;
	ambientEmoteCooldown: number;
	idleSinceTimestamp: number;
	longIdleFired: boolean;
	previousRoom: string;
	lastFacingDirection: "left" | "right";
	lastFacingChangeTimestamp: number;
	activeVisualPriority: number;
	activeVisualUntil: number;
}

function createAgentVisualState(quirks: readonly string[]): AgentVisualState {
	return {
		quirks,
		lastIntent: "idle",
		lastIntentDetail: "",
		intentIconShowing: false,
		lastPayoffTimestamp: -Infinity,
		lastAmbientEmoteTimestamp: -Infinity,
		ambientEmoteCooldown: randomCooldown(),
		idleSinceTimestamp: -Infinity,
		longIdleFired: false,
		previousRoom: "",
		lastFacingDirection: "right",
		lastFacingChangeTimestamp: 0,
		activeVisualPriority: 0,
		activeVisualUntil: 0,
	};
}

function randomCooldown(): number {
	return COOLDOWNS.ambientEmoteMinMs + Math.random() * (COOLDOWNS.ambientEmoteMaxMs - COOLDOWNS.ambientEmoteMinMs);
}

function pickRandom<T>(arr: readonly T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

// ── System ───────────────────────────────────────────────────────

export class VisualFeedbackSystem {
	private readonly agents = new Map<string, AgentVisualState>();
	private readonly cb: Partial<VisualFeedbackCallbacks>;

	constructor(callbacks: Partial<VisualFeedbackCallbacks>) {
		this.cb = callbacks;
	}

	register(agentName: string, quirks: readonly string[]): void {
		if (!this.agents.has(agentName)) {
			this.agents.set(agentName, createAgentVisualState(quirks));
		}
	}

	unregister(agentName: string): void {
		this.agents.delete(agentName);
	}

	/**
	 * Tick one agent's visual feedback. Called once per frame per agent.
	 * @param now - current simulation time in ms
	 * @param deltaMs - frame delta in ms
	 */
	tick(agentName: string, bb: AgentBlackboard, now: number, deltaMs: number): void {
		const state = this.agents.get(agentName);
		if (!state) return;

		const intentKey = `${bb.intent}:${bb.intentDetail}`;
		const prevIntentKey = `${state.lastIntent}:${state.lastIntentDetail}`;
		const transitioned = intentKey !== prevIntentKey;

		// ── Phase 1: Intent telegraph ────────────────────
		if (transitioned) {
			this.handleIntentTransition(agentName, bb, state, now);
		}

		// ── Phase 2: Arrival payoff ──────────────────────
		const isSeekDetail = bb.intentDetail.includes("food") || bb.intentDetail.includes("drink") || bb.intentDetail.includes("merchant");
		if (bb.arrived && isSeekDetail && bb.intent === "seeking") {
			this.handleArrivalPayoff(agentName, bb, state, now);
		}

		// ── Phase 3: Urgency speed boost ─────────────────
		this.updateUrgencySpeed(bb, state);

		// ── Phase 4: Idle micro-actions ──────────────────
		if (bb.intent === "idle" || bb.intent === "on-break" || bb.intent === "waiting") {
			this.handleIdleBehavior(agentName, bb, state, now, deltaMs);
		} else {
			state.idleSinceTimestamp = now;
			state.longIdleFired = false;
		}

		// ── Phase 5: Room transition ─────────────────────
		if (bb.currentRoom && bb.currentRoom !== state.previousRoom && state.previousRoom !== "") {
			this.handleRoomTransition(agentName, bb, state);
		}
		state.previousRoom = bb.currentRoom;

		// ── Bookkeeping ──────────────────────────────────
		state.lastIntent = bb.intent;
		state.lastIntentDetail = bb.intentDetail;

		if (transitioned) {
			bb.lastIntentTransition = {
				from: prevIntentKey,
				to: intentKey,
				timestamp: now,
			};
		}
	}

	// ── Intent telegraph ─────────────────────────────────────────

	private handleIntentTransition(
		agentName: string,
		bb: AgentBlackboard,
		state: AgentVisualState,
		now: number,
	): void {
		// Hide any existing intent icon
		if (state.intentIconShowing) {
			this.cb.onHideIntentIcon?.(agentName);
			state.intentIconShowing = false;
		}

		// Only telegraph seeking intents
		if (bb.intent !== "seeking") return;

		const tier = this.resolveUrgencyTier(bb, state);

		// Face toward target
		if (bb.movementTarget) {
			const dir = bb.movementTarget.x < bb.position.x ? "left" : "right";
			this.cb.onFacingChange?.(agentName, dir);
			bb.facingDirection = dir;
			state.lastFacingDirection = dir;
			state.lastFacingChangeTimestamp = now;
		}

		// Resolve intent sprite
		const baseDetail = bb.intentDetail.split(":")[0];
		const spritePath = INTENT_SPRITES[baseDetail] ?? INTENT_SPRITES[bb.intentDetail];

		// Telegraph based on urgency tier
		if (tier === "low" && spritePath) {
			this.cb.onThoughtBubble?.(agentName, "", spritePath, TIMING.thoughtBubbleDuration);
			this.cb.onShowIntentIcon?.(agentName, spritePath, bb.position);
			state.intentIconShowing = true;
		} else if (tier === "medium" || tier === "high") {
			const emotes = tier === "high" ? EMOTE_INDICES.distressed : EMOTE_INDICES.concerned;
			const idx = Array.isArray(emotes) ? pickRandom(emotes) : emotes;
			this.cb.onEmoteFlash?.(agentName, idx);

			if (spritePath) {
				this.cb.onShowIntentIcon?.(agentName, spritePath, bb.position);
				state.intentIconShowing = true;
			}

			if (tier === "high") {
				this.cb.onParticleBurst?.("sprite-smoke", bb.position);
			}
		}

		state.activeVisualPriority = 3;
		state.activeVisualUntil = now + TIMING.thoughtBubbleDuration;
	}

	// ── Arrival payoff ───────────────────────────────────────────

	private handleArrivalPayoff(
		agentName: string,
		bb: AgentBlackboard,
		state: AgentVisualState,
		now: number,
	): void {
		if (now - state.lastPayoffTimestamp < COOLDOWNS.payoffCooldownMs) return;

		// Hide intent icon
		if (state.intentIconShowing) {
			this.cb.onHideIntentIcon?.(agentName);
			state.intentIconShowing = false;
		}

		// Determine item sprites
		const detail = bb.intentDetail;
		let pool: readonly string[] | undefined;
		if (detail.includes("food")) pool = ITEM_POP_SPRITES.hunger;
		else if (detail.includes("drink")) pool = ITEM_POP_SPRITES.thirst;
		else if (detail.includes("merchant")) pool = ITEM_POP_SPRITES.merchant;

		if (pool && pool.length > 0) {
			this.cb.onItemPop?.(agentName, pickRandom(pool), bb.position);
		}

		// Satisfaction emote + particles
		this.cb.onEmoteFlash?.(agentName, pickRandom(EMOTE_INDICES.happy));
		this.cb.onParticleBurst?.("sprite-sparkle", bb.position);
		this.cb.onParticleBurst?.("sprite-heart", bb.position);

		state.lastPayoffTimestamp = now;
		state.activeVisualPriority = 3;
		state.activeVisualUntil = now + TIMING.satisfactionEmoteDurationMs + TIMING.satisfactionDelayMs;
	}

	// ── Urgency speed ────────────────────────────────────────────

	private updateUrgencySpeed(bb: AgentBlackboard, state: AgentVisualState): void {
		if (bb.intent !== "seeking") {
			bb.urgencySpeedBoost = 1.0;
			return;
		}
		const tier = this.resolveUrgencyTier(bb, state);
		bb.urgencySpeedBoost = URGENCY_SPEED_MULTIPLIERS[tier];
	}

	// ── Idle behavior ────────────────────────────────────────────

	private handleIdleBehavior(
		agentName: string,
		bb: AgentBlackboard,
		state: AgentVisualState,
		now: number,
		_deltaMs: number,
	): void {
		// Skip if higher-priority visual is still active (time-based expiry)
		if (state.activeVisualPriority >= 2 && now < state.activeVisualUntil) {
			return;
		}
		if (now >= state.activeVisualUntil) {
			state.activeVisualPriority = 0;
		}

		// Initialize idle start on first idle tick
		if (!isFinite(state.idleSinceTimestamp)) state.idleSinceTimestamp = now;
		const idleDuration = now - state.idleSinceTimestamp;

		// Long idle (> 60s): sleep emote
		if (idleDuration > COOLDOWNS.longIdleThresholdMs && !state.longIdleFired) {
			this.cb.onEmoteFlash?.(agentName, EMOTE_INDICES.sleep);
			state.longIdleFired = true;
			state.lastAmbientEmoteTimestamp = now;
			return;
		}

		// Ambient emotes on cooldown
		if (now - state.lastAmbientEmoteTimestamp < state.ambientEmoteCooldown) return;

		// Context-driven ambient emotes
		let fired = false;
		if (bb.needs.energy < IDLE_AWARENESS.lowEnergyThreshold) {
			this.cb.onEmoteFlash?.(agentName, EMOTE_INDICES.sleep);
			this.cb.onThoughtBubble?.(agentName, "zzz", undefined, 1500);
			fired = true;
		} else if (bb.needs.morale < IDLE_AWARENESS.lowMoraleThreshold) {
			this.cb.onEmoteFlash?.(agentName, pickRandom(EMOTE_INDICES.distressed));
			fired = true;
		} else if (bb.needs.social < IDLE_AWARENESS.highSocialNeedThreshold && bb.nearbyAgents.length > 0) {
			this.cb.onEmoteFlash?.(agentName, EMOTE_INDICES.alert);
			this.cb.onFacingChange?.(agentName, "right");
			fired = true;
		} else if (bb.needs.focus > IDLE_AWARENESS.highFocusThreshold) {
			this.cb.onEmoteFlash?.(agentName, pickRandom(EMOTE_INDICES.determined));
			fired = true;
		}

		if (!fired) return;
		state.lastAmbientEmoteTimestamp = now;
		state.ambientEmoteCooldown = randomCooldown();
		state.activeVisualPriority = 1;
	}

	// ── Room transition ──────────────────────────────────────────

	private handleRoomTransition(
		_agentName: string,
		bb: AgentBlackboard,
		_state: AgentVisualState,
	): void {
		this.cb.onParticleBurst?.("sprite-leaf", bb.position);
	}

	// ── Helpers ──────────────────────────────────────────────────

	private resolveUrgencyTier(bb: AgentBlackboard, state: AgentVisualState): UrgencyTier {
		const detail = bb.intentDetail;
		let need: number;
		let needKey: string;

		if (detail.includes("food")) {
			need = bb.needs.hunger;
			needKey = "hunger";
		} else if (detail.includes("drink")) {
			need = bb.needs.thirst;
			needKey = "thirst";
		} else {
			return "low";
		}

		const threshold = resolveThreshold(needKey, state.quirks);
		const urgency = computeUrgency(need, threshold);
		return classifyUrgency(urgency);
	}
}
