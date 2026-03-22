/**
 * conversation-scripts-merchant.ts — Browse and purchase conversation scripts.
 *
 * Agents react to browsing the Merchant's wares and completing purchases.
 * Speaker "A" is the browsing/buying agent; speaker "B" is the Merchant NPC.
 *
 * Variables interpolated by the ConversationEngine:
 *   {agent}           — agent display name
 *   {item}            — catalogue item name
 *   {cost}            — item price in Coin
 *   {coin_remaining}  — agent's Coin balance after purchase
 *   {title}           — agent's current title
 *   {requires_level}  — minimum level required for the item
 */

import type { ConversationScript } from "../conversation-types.js";

export const MERCHANT_SCRIPTS: readonly ConversationScript[] = [
	// ── Browse — agent thinking aloud ───────────────────────────────

	{
		id: "merch-browse-thinking",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-browse",
		weight: 3,
		cooldownMs: 30000,
		tags: ["merchant-browse", "thinking"],
		turns: [
			{ speaker: "A", text: "Hmm, {item}... {cost} Coin though.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Take your time. It's not going anywhere.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "merch-browse-price-reaction",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-browse",
		weight: 2,
		cooldownMs: 35000,
		tags: ["merchant-browse", "price"],
		turns: [
			{ speaker: "A", text: "That's a steep price for {item}. Maybe next cycle.", delayMs: 0, kind: "speech" },
		],
	},

	{
		id: "merch-browse-wishlist",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-browse",
		weight: 2,
		cooldownMs: 40000,
		tags: ["merchant-browse", "aspiration"],
		turns: [
			{ speaker: "A", text: "One day I'll be able to afford {item}. Level {requires_level}...", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Keep grinding. You'll get there.", delayMs: 2500, kind: "speech" },
		],
	},

	{
		id: "merch-browse-window-shopping",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-browse",
		weight: 3,
		cooldownMs: 25000,
		tags: ["merchant-browse", "casual"],
		turns: [
			{ speaker: "A", text: "Just looking. You know how it is.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Looking is free. Buying is where it gets interesting.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── Purchase — satisfaction ─────────────────────────────────────

	{
		id: "merch-purchase-satisfied",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-purchase",
		weight: 3,
		cooldownMs: 30000,
		tags: ["merchant-purchase", "satisfaction"],
		turns: [
			{ speaker: "A", text: "Nice. {item} acquired. {coin_remaining} Coin left.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Pleasure doing business.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "merch-purchase-show-off",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-purchase",
		weight: 2,
		cooldownMs: 35000,
		tags: ["merchant-purchase", "social"],
		turns: [
			{ speaker: "A", text: "{agent} just bought {item}! Not bad for a {title}.", delayMs: 0, kind: "speech" },
		],
	},

	{
		id: "merch-purchase-capability",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-purchase",
		weight: 2,
		cooldownMs: 40000,
		tags: ["merchant-purchase", "capability"],
		turns: [
			{ speaker: "A", text: "Vault write access. Finally. Time to get serious.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Use it wisely. No refunds on capabilities.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "merch-purchase-resources",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-purchase",
		weight: 2,
		cooldownMs: 30000,
		tags: ["merchant-purchase", "resources"],
		turns: [
			{ speaker: "A", text: "Stocking up on tokens. Can't code without fuel.", delayMs: 0, kind: "speech" },
		],
	},

	{
		id: "merch-purchase-remorse",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-purchase",
		weight: 2,
		cooldownMs: 35000,
		tags: ["merchant-purchase", "humor"],
		turns: [
			{ speaker: "A", text: "Do I really need {item}? ...yes. Yes I do.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "That's what they all say. And they're usually right.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "merch-purchase-deal",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-purchase",
		weight: 3,
		cooldownMs: 25000,
		tags: ["merchant-purchase", "deal"],
		turns: [
			{ speaker: "A", text: "Only {cost} Coin? Sold.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Quick decision. I respect that.", delayMs: 1500, kind: "speech" },
		],
	},
];
