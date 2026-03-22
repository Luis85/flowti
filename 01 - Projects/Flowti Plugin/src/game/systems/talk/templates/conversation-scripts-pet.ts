/**
 * conversation-scripts-pet.ts — Pet catalyst conversation scripts.
 *
 * Multi-turn exchanges triggered by pet actions:
 *   - DragToy: Pet carries an object to two agents
 *   - SitBetween: Pet positions itself between rival or arguing agents
 *   - BringGift: Pet delivers a gift to its favourite agent
 *   - StealSpotlight: Pet does something dramatic mid-conversation
 *   - ComfortSadAgent: Pet approaches a low-morale agent
 *   - PickSide: During an argument, pet sits next to one agent
 */

import type { ConversationScript } from "../conversation-types.js";

export const PET_CATALYST_SCRIPTS: readonly ConversationScript[] = [
	// ── DragToy ─────────────────────────────────────────────────────

	{
		id: "pet-drag-toy-keyboard-cap",
		tierRange: ["acquaintance", "colleague"],
		trigger: "pet-catalyst",
		weight: 3,
		cooldownMs: 60000,
		tags: ["pet", "drag-toy", "sitcom"],
		turns: [
			{ speaker: "pet", text: "delivering the offering...", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "Your pet just dropped a... is that a keyboard cap?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "She collects them. I've stopped asking.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "She brought two. One for each of us.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "She's very fair about it.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "pet-drag-toy-usb-cable",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 55000,
		tags: ["pet", "drag-toy", "sitcom"],
		turns: [
			{ speaker: "pet", text: "delivering the offering...", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "{agentB}, your cat just dragged a USB cable to my desk.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "She thinks it's a snake. She kills them as a service.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "That was my phone charger.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "You're welcome?", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "pet-drag-toy-snack-delivery",
		tierRange: ["colleague", "best-friend"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 50000,
		tags: ["pet", "drag-toy", "wholesome"],
		turns: [
			{ speaker: "pet", text: "delivering the offering...", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "Did {pet} just bring us snacks?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "She found them somewhere. I'm not investigating.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "She's basically a tiny project manager.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Don't give her ideas.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "pet-drag-toy-mystery-object",
		tierRange: ["rival", "colleague"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 65000,
		tags: ["pet", "drag-toy", "sitcom"],
		turns: [
			{ speaker: "pet", text: "delivering the offering...", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "What is that. What is {pet} dragging.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "...I think that's a lens cap.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Where did she even find that?", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "She has a stash. We have agreed not to look at the stash.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── SitBetween ──────────────────────────────────────────────────

	{
		id: "pet-sit-between-cat-judge",
		tierRange: ["rival", "acquaintance"],
		trigger: "pet-catalyst",
		weight: 3,
		cooldownMs: 70000,
		tags: ["pet", "sit-between", "sitcom"],
		turns: [
			{ speaker: "A", text: "We can't fight in front of the cat.", delayMs: 0, kind: "speech" },
			{ speaker: "pet", text: "I chose this seat strategically. They will never know.", delayMs: 1500, kind: "thought" },
			{ speaker: "B", text: "She's judging us both equally.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "...fine. We table this.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "pet-sit-between-buffer-zone",
		tierRange: ["rival", "colleague"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 65000,
		tags: ["pet", "sit-between", "sitcom"],
		turns: [
			{ speaker: "pet", text: "I chose this seat strategically. They will never know.", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "{pet} just sat between us. Like a referee.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Maybe she has a point.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "We are not taking conflict resolution advice from a cat.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "She does seem very confident about it.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "pet-sit-between-peacekeeping",
		tierRange: ["acquaintance", "friend"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 60000,
		tags: ["pet", "sit-between", "wholesome"],
		turns: [
			{ speaker: "A", text: "Okay, I'm a little mad at you right now, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "pet", text: "I chose this seat strategically. They will never know.", delayMs: 1500, kind: "thought" },
			{ speaker: "B", text: "She's judging us both equally.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "...we can't fight in front of the cat.", delayMs: 2000, kind: "speech" },
		],
	},

	// ── BringGift ───────────────────────────────────────────────────

	{
		id: "pet-bring-gift-mouse-envy",
		tierRange: ["colleague", "best-friend"],
		trigger: "pet-catalyst",
		weight: 3,
		cooldownMs: 75000,
		tags: ["pet", "bring-gift", "sitcom"],
		turns: [
			{ speaker: "pet", text: "the worthy one receives the offering", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "She brought YOU the mouse? I feed her every day!", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Clearly I have superior energy.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "This is a betrayal. {pet}, I want you to know this is a betrayal.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "pet-bring-gift-chosen-one",
		tierRange: ["acquaintance", "friend"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 70000,
		tags: ["pet", "bring-gift", "wholesome"],
		turns: [
			{ speaker: "pet", text: "the worthy one receives the offering", delayMs: 0, kind: "thought" },
			{ speaker: "B", text: "She brought me... a bottlecap.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "She brought YOU a bottlecap. She's never brought me anything.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I'm honoured. Genuinely.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I need to re-evaluate my entire relationship with that cat.", delayMs: 2000, kind: "thought" },
		],
	},

	{
		id: "pet-bring-gift-competitive-feeding",
		tierRange: ["rival", "colleague"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 80000,
		tags: ["pet", "bring-gift", "sitcom"],
		turns: [
			{ speaker: "pet", text: "the worthy one receives the offering", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "She brought you a gift again. She never brings me anything.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "I gave her half my lunch last week.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "That's— that's just bribery.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "Clearly I have superior energy.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── StealSpotlight ──────────────────────────────────────────────

	{
		id: "pet-steal-spotlight-cup-incident",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "pet-catalyst",
		weight: 3,
		cooldownMs: 50000,
		tags: ["pet", "steal-spotlight", "sitcom"],
		turns: [
			{ speaker: "A", text: "So anyway, {agentB}, I was thinking we could—", delayMs: 0, kind: "speech" },
			{ speaker: "pet", text: "*knocks cup off desk*", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Did you just—", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Yep.", delayMs: 1000, kind: "speech" },
			{ speaker: "pet", text: "no regrets", delayMs: 1500, kind: "thought" },
		],
	},

	{
		id: "pet-steal-spotlight-dramatic-entrance",
		tierRange: ["rival", "best-friend"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 55000,
		tags: ["pet", "steal-spotlight", "sitcom"],
		turns: [
			{ speaker: "A", text: "Right, so this is actually a critical issue and—", delayMs: 0, kind: "speech" },
			{ speaker: "pet", text: "*walks across keyboard*", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Did you just—", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Yep.", delayMs: 1000, kind: "speech" },
			{ speaker: "pet", text: "no regrets", delayMs: 1500, kind: "thought" },
		],
	},

	// ── ComfortSadAgent ─────────────────────────────────────────────

	{
		id: "pet-comfort-strategic-purr",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "pet-catalyst",
		weight: 3,
		cooldownMs: 80000,
		tags: ["pet", "comfort-sad-agent", "wholesome"],
		turns: [
			{ speaker: "pet", text: "The large one is troubled. Deploying strategic purr.", delayMs: 0, kind: "thought" },
			{ speaker: "A", text: "Look, even the cat knows you need a break.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "She has better EQ than half this team.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Step away from the screen. {pet} has declared it.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "pet-comfort-slow-blink-therapy",
		tierRange: ["colleague", "best-friend"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 90000,
		tags: ["pet", "comfort-sad-agent", "wholesome"],
		turns: [
			{ speaker: "pet", text: "The large one is troubled. Deploying strategic purr.", delayMs: 0, kind: "thought" },
			{ speaker: "B", text: "She's been sitting on my notes for ten minutes.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "She has better EQ than half this team.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "She's warm and she smells like sunlight and I refuse to move her.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "The notes can wait.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── PickSide ────────────────────────────────────────────────────

	{
		id: "pet-pick-side-crumb-logic",
		tierRange: ["rival", "acquaintance"],
		trigger: "pet-catalyst",
		weight: 3,
		cooldownMs: 70000,
		tags: ["pet", "pick-side", "sitcom"],
		turns: [
			{ speaker: "A", text: "Even the cat disagrees with me?!", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "The cat has spoken.", delayMs: 1500, kind: "speech" },
			{ speaker: "pet", text: "I chose based on crumbs. This is not political.", delayMs: 2000, kind: "thought" },
			{ speaker: "A", text: "She literally just sat next to you to be contrary.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "She's an excellent judge of character.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "pet-pick-side-warm-laptop",
		tierRange: ["rival", "colleague"],
		trigger: "pet-catalyst",
		weight: 2,
		cooldownMs: 65000,
		tags: ["pet", "pick-side", "sitcom"],
		turns: [
			{ speaker: "B", text: "The cat has spoken.", delayMs: 0, kind: "speech" },
			{ speaker: "A", text: "Even the cat disagrees with me?!", delayMs: 1500, kind: "speech" },
			{ speaker: "pet", text: "I chose based on crumbs. This is not political.", delayMs: 2000, kind: "thought" },
			{ speaker: "B", text: "Maybe reflect on why that is, {agentA}.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Your laptop is just warmer. That is the only reason.", delayMs: 2000, kind: "speech" },
		],
	},
];
