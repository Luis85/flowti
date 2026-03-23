/**
 * visual-feedback-presets.ts — Constants for the visual feedback system.
 *
 * All urgency thresholds, timing values, sprite paths, and cooldown
 * durations live here. Tuning visual behavior means editing this file,
 * not the system logic.
 */

// ── Urgency Thresholds ───────────────────────────────────────────

export interface ThresholdEntry {
	readonly base: number;
	readonly quirks?: Readonly<Record<string, number>>;
}

export const URGENCY_THRESHOLDS: Readonly<Record<string, ThresholdEntry>> = {
	hunger: { base: 35, quirks: { snacker: 50 } },
	thirst: { base: 30, quirks: { "coffee-addict": 45 } },
	energy: { base: 30 },
	social: { base: 30 },
};

/** Resolve effective threshold for a need, checking agent quirks for overrides. */
export function resolveThreshold(need: string, quirks: readonly string[]): number {
	const entry = URGENCY_THRESHOLDS[need];
	if (!entry) return 50;
	if (entry.quirks) {
		for (const q of quirks) {
			if (entry.quirks[q] !== undefined) return entry.quirks[q];
		}
	}
	return entry.base;
}

/** Compute urgency 0..1 from a need value and its effective threshold. */
export function computeUrgency(needValue: number, threshold: number): number {
	return Math.max(0, Math.min(1, 1 - needValue / threshold));
}

/** Classify urgency into a tier. */
export type UrgencyTier = "low" | "medium" | "high";

export function classifyUrgency(urgency: number): UrgencyTier {
	if (urgency >= 0.6) return "high";
	if (urgency >= 0.3) return "medium";
	return "low";
}

// ── Timing ───────────────────────────────────────────────────────

export const TIMING = {
	thoughtBubbleDuration: 1500,
	intentIconFadeMs: 200,
	itemPopDurationMs: 600,
	satisfactionEmoteDurationMs: 1500,
	satisfactionDelayMs: 400,
	sparkBurstDurationMs: 500,
} as const;

// ── Cooldowns ────────────────────────────────────────────────────

export const COOLDOWNS = {
	payoffCooldownMs: 3000,
	ambientEmoteMinMs: 8000,
	ambientEmoteMaxMs: 15000,
	proximityPairCooldownMs: 15000,
	longIdleCooldownMs: 45000,
	longIdleThresholdMs: 60000,
	roomEntryLookDurationMs: 600,
	facingTransitionDelayMs: 200,
} as const;

// ── Sprite Paths ─────────────────────────────────────────────────

export const INTENT_SPRITES: Readonly<Record<string, string>> = {
	"seek-food": "assets/Items/Food/Onigiri.png",
	"seek-preferred-food": "assets/Items/Food/Onigiri.png",
	"seek-drink": "assets/Items/Potion/WaterPot.png",
	"seek-preferred-drink": "assets/Items/Potion/WaterPot.png",
	"seek-work": "assets/Items/Object/Book.png",
	"seek-merchant": "assets/Items/Treasure/GoldCoin.png",
};

export const ITEM_POP_SPRITES = {
	hunger: [
		"assets/Items/Food/Onigiri.png",
		"assets/Items/Food/Fish.png",
		"assets/Items/Food/Sushi.png",
	],
	thirst: [
		"assets/Items/Potion/WaterPot.png",
		"assets/Items/Potion/MilkPot.png",
	],
	merchant: [
		"assets/Items/Treasure/GoldCoin.png",
	],
} as const;

export const URGENCY_SPEED_MULTIPLIERS = {
	low: 1.0,
	medium: 1.2,
	high: 1.4,
} as const;

// ── Emote Indices (Ninja Adventure emote sprites) ────────────────

export const EMOTE_INDICES = {
	happy: [3, 5],
	concerned: [8, 7],
	distressed: [10, 12],
	sleep: 7,
	determined: [15, 20],
	alert: 12,
} as const;

// ── Idle Awareness Thresholds ────────────────────────────────────

export const IDLE_AWARENESS = {
	proximityTriggerPx: 40,
	facingInterestRadiusPx: 60,
	nearStationRadiusPx: 40,
	lowEnergyThreshold: 40,
	lowMoraleThreshold: 30,
	highSocialNeedThreshold: 30,
	highFocusThreshold: 80,
} as const;
