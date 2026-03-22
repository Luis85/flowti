/**
 * conversation-scripts-colleague.ts — Multi-turn conversation scripts for colleague tier.
 *
 * Professional warmth, shared tips, collaborative problem-solving, and the kind
 * of light humor that only emerges once you've survived a few sprints together.
 */

import type { ConversationScript } from "../conversation-types.js";

export const COLLEAGUE_SCRIPTS: readonly ConversationScript[] = [
	// ── Collaborative problem-solving ───────────────────────────────

	{
		id: "col-rubber-duck",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["collaborative", "problem-solving"],
		turns: [
			{ speaker: "A", text: "Hey {agentB}, can I think out loud at you for a second?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Go for it. I'm a very good rubber duck.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Okay so — actually, I think I just figured it out. Thanks.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "My best work yet.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "col-pair-review-offer",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["collaborative", "helpful"],
		turns: [
			{ speaker: "A", text: "I pushed that fix. Would you mind doing a quick once-over?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah, send me the PR link. I'll look after my standup.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Appreciate it. I'll owe you a coffee.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-shared-approach",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["collaborative", "tips"],
		turns: [
			{ speaker: "A", text: "How do you usually handle debouncing in the event system?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I keep a map of timers keyed by event ID. Messy but it works.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That's exactly what I was going to do. Glad it's not just me.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "There's a comfort in shared messiness.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── Sharing tips ────────────────────────────────────────────────

	{
		id: "col-keyboard-shortcut-tip",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["tips", "warmth"],
		turns: [
			{ speaker: "A", text: "You know you can jump to the last edit position with Ctrl+Q, right?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I did NOT know that. How long has that existed?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Since forever. I only found out last month.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-debug-trick",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["tips", "helpful"],
		turns: [
			{ speaker: "A", text: "Pro tip: if you wrap the test output in JSON.stringify with two-space indent, you can actually read it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "That feels obvious in retrospect and I've been suffering for months.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "We all have. Pass it on.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-tool-rec",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["tips", "collaborative"],
		turns: [
			{ speaker: "A", text: "Have you tried that new diff viewer everyone's talking about?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Not yet. Is it actually better or is it just pretty?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Honestly? Pretty. But it's very pretty.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Sold. Sending me the link?", delayMs: 1500, kind: "speech" },
		],
	},

	// ── Light humor ─────────────────────────────────────────────────

	{
		id: "col-naming-things",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["humor", "relatable"],
		turns: [
			{ speaker: "A", text: "I've been staring at this function for ten minutes trying to name it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "What does it do?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "...processes things.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "ProcessThings. Done.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "col-monday-solidarity",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["humor", "warmth"],
		turns: [
			{ speaker: "A", text: "Is it Friday yet?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "It's Monday, {agentA}.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I know. I was asking rhetorically.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "col-over-engineered",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["humor", "collaborative"],
		turns: [
			{ speaker: "A", text: "I built a whole abstraction for this. Took three hours.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Does it work?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Beautifully. For a problem that only occurs once.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "The craft, though.", delayMs: 1000, kind: "speech" },
		],
	},

	// ── Professional warmth ─────────────────────────────────────────

	{
		id: "col-good-catch",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["warmth", "recognition"],
		turns: [
			{ speaker: "A", text: "Hey, good catch on that edge case in the review.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Ah, thanks. It's the kind of thing that bites you later.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Exactly. Thanks for looking closely.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-handoff-care",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["helpful", "warmth"],
		turns: [
			{ speaker: "A", text: "Before you pick up that ticket — I left some context in the comments. Might save you time.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh, that's really thoughtful, {agentA}. Thanks.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I wish someone had done it for me last week.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "col-support-under-pressure",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["warmth", "support"],
		turns: [
			{ speaker: "A", text: "That demo went really well, {agentB}.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I was terrified honestly. I nearly rebooted the whole thing.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You couldn't tell at all from the outside.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "That's the job, I guess.", delayMs: 1500, kind: "speech" },
		],
	},

	// ── Helpful exchanges ────────────────────────────────────────────

	{
		id: "col-onboarding-memory",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 45000,
		tags: ["helpful", "collaborative"],
		turns: [
			{ speaker: "A", text: "There's a new person joining the team next week.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh nice. I'll put together a quick doc of the stuff I wish someone had told me.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That would be genuinely great. They'll appreciate it.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "col-cross-domain-ask",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["collaborative", "helpful"],
		turns: [
			{ speaker: "A", text: "You've touched the event pipeline before, right? I have a question.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "A while ago, but sure — what's the question?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Does it drop events if the queue is full, or block?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Drops. There's a dead-letter log if you need to replay.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "col-sprint-retrospective",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 45000,
		tags: ["collaborative", "reflection"],
		turns: [
			{ speaker: "A", text: "What's one thing you'd change about how we ran this sprint?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Fewer meetings before noon. I hit flow state early and then it shatters.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Seconded. I'll bring it up in the retro.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "col-knowledge-share",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 30000,
		tags: ["tips", "warmth"],
		turns: [
			{ speaker: "A", text: "By the way, if you're dealing with timezone issues, there's a utility in shared/time.ts that handles it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I just spent two hours writing one of those.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Oh no. Well... now you really understand timezone issues.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Deeply and painfully, yes.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-end-of-day-check",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["warmth", "wrap-up"],
		turns: [
			{ speaker: "A", text: "Heading out? Anything blocking you for tomorrow?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I'm waiting on a review, but otherwise good. You?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Same, more or less. See you tomorrow.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-naming-vindication",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 45000,
		tags: ["humor", "collaborative"],
		turns: [
			{ speaker: "A", text: "You were right about calling it UserContext and not AuthSession.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I will not say 'I told you so'.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "You just did.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "A little bit, yeah.", delayMs: 1000, kind: "speech" },
		],
	},

	{
		id: "col-quiet-check-in",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["warmth", "support"],
		turns: [
			{ speaker: "A", text: "You've been pretty quiet today, {agentB}. Everything alright?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah, just deep in something. But thanks for asking.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Anytime. I'll let you get back to it.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-documentation-pact",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["collaborative", "humor"],
		turns: [
			{ speaker: "A", text: "I am going to write the documentation this time. Actually.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I believe you. In the same way I believe in parallel universes where I also exercise.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "This is different. I have a template.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Okay now I actually believe you.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-mutual-learning",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 30000,
		tags: ["tips", "collaborative"],
		turns: [
			{ speaker: "A", text: "That pattern you used in the adapter layer — can you walk me through it sometime?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Sure! It's basically just dependency inversion with a factory. I can show you Friday.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Friday works. I'll bring snacks.", delayMs: 2000, kind: "speech" },
		],
	},

	{
		id: "col-after-incident",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 45000,
		tags: ["support", "warmth"],
		turns: [
			{ speaker: "A", text: "Hey, the outage wasn't your fault. The flag was undocumented.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. It still feels bad.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Yeah. Write the post-mortem, eat some bad vending machine food, and move on.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "Solid protocol. Thanks, {agentA}.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-version-mismatch",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["humor", "problem-solving"],
		turns: [
			{ speaker: "A", text: "Are you on Node 18 or 20?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "18. Why?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I've been debugging this on 20 and I think that might just... be it.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Classic. Let me check mine too.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-appreciate-review",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 3,
		cooldownMs: 30000,
		tags: ["warmth", "recognition"],
		turns: [
			{ speaker: "A", text: "Thanks for the detailed review notes, {agentB}. Actually useful.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I try to give the review I'd want to receive.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "It shows. Seriously.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-feature-pride",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["warmth", "recognition"],
		turns: [
			{ speaker: "A", text: "I saw the new filter component shipped. Clean implementation.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Three rewrites to get there, but yeah. I'm finally happy with it.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Worth it. You can tell.", delayMs: 1500, kind: "speech" },
		],
	},
];
