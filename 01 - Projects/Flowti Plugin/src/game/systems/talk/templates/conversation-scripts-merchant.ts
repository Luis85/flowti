/**
 * conversation-scripts-merchant.ts \u2014 Browse and purchase conversation scripts.
 *
 * Agents react to browsing the Merchant's wares and completing purchases.
 * Speaker "A" is the browsing/buying agent; speaker "B" is the Merchant NPC.
 *
 * All dialogue is self-contained and uses only the standard variables
 * provided by ConversationEngine.buildVars():
 *   {agentA}   \u2014 browsing/buying agent name
 *   {agentB}   \u2014 Merchant NPC name
 *   {domain_a} \u2014 agent's domain
 *   {domain_b} \u2014 Merchant's domain
 *   {pet}      \u2014 pet name (if present)
 *   {agentC}   \u2014 third agent (if nearby)
 */

import type { ConversationScript } from "../conversation-types.js";

export const MERCHANT_SCRIPTS: readonly ConversationScript[] = [
	// \u2500\u2500 Browse \u2014 agent thinking aloud \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

	{
		id: "merch-browse-thinking",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-browse",
		weight: 3,
		cooldownMs: 30000,
		tags: ["merchant-browse", "thinking"],
		turns: [
			{ speaker: "A", text: "Hmm, interesting selection today. Let me take a closer look.", delayMs: 0, kind: "speech" },
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
			{ speaker: "A", text: "Some steep prices in here. Maybe next cycle.", delayMs: 0, kind: "speech" },
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
			{ speaker: "A", text: "One day I'll be able to afford the good stuff. Just need a few more levels.", delayMs: 0, kind: "speech" },
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

	// \u2500\u2500 Purchase \u2014 satisfaction \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

	{
		id: "merch-purchase-satisfied",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "merchant-purchase",
		weight: 3,
		cooldownMs: 30000,
		tags: ["merchant-purchase", "satisfaction"],
		turns: [
			{ speaker: "A", text: "Nice. That's a solid pickup. Worth every coin.", delayMs: 0, kind: "speech" },
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
			{ speaker: "A", text: "{agentA} just made a purchase! Moving up in the world.", delayMs: 0, kind: "speech" },
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
			{ speaker: "A", text: "New capabilities unlocked. Time to get serious.", delayMs: 0, kind: "speech" },
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
			{ speaker: "A", text: "Stocking up on supplies. Can't code without fuel.", delayMs: 0, kind: "speech" },
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
			{ speaker: "A", text: "Do I really need this? ...yes. Yes I do.", delayMs: 0, kind: "speech" },
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
			{ speaker: "A", text: "Good price on that one. Sold.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Quick decision. I respect that.", delayMs: 1500, kind: "speech" },
		],
	},
];
