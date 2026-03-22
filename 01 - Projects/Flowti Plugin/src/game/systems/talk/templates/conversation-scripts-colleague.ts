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
			{ speaker: "A", text: "Okay so the thing is — oh. Oh wait. I think I just figured it out.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "And another successful session. You're welcome.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "I pushed that fix. Would you mind doing a quick once-over before I tag it?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah, send me the link. I'll look right after standup.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "You're the best. And I'm not just saying that because you're reviewing my code.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Timer map keyed by event ID. It's ugly but it works.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "That's exactly what I was going to do. Glad it's not just me.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "There's a comfort in shared messiness.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-standup-fatigue",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 35000,
		tags: ["humor", "relatable"],
		turns: [
			{ speaker: "A", text: "My standup update today was 'same as yesterday' and I've never felt freer.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Bold move. I gave a whole speech about something I haven't started.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "The theatre of daily standup.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "We're all performers here.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "Since forever. I only found out last month and I'm still grieving the lost time.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Pro tip: wrap the test output in JSON.stringify with two-space indent. Actually readable.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "That feels obvious in retrospect. I've been squinting at raw output for months.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "We all have. The knowledge must be passed down.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Not yet. Is it actually better or just trendy?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Honestly? It's pretty. That's about it. But it's really pretty.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Sold. Send the link.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "It... processes... data. In a way.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "handleStuff. Ship it.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "B", text: "It is aggressively Monday, {agentA}.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "I know. I was hoping you'd lie to me.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "I built a whole abstraction layer for this. Three hours of my life.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Does it work?", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Beautifully. For a problem that occurs exactly once.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "The craftsmanship, though. No one can take that from you.", delayMs: 1500, kind: "speech" },
		],
	},

	{
		id: "col-jira-archaeology",
		tierRange: ["colleague", "colleague"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 40000,
		tags: ["humor", "relatable"],
		turns: [
			{ speaker: "A", text: "I just found a Jira ticket from eighteen months ago assigned to me. Apparently I'm 'in progress.'", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Close it. If nobody's asked about it in eighteen months, it's done.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "That's either brilliant or career-ending.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Only one way to find out.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "B", text: "Ah, thanks. It's the kind of thing that bites you at 2am in production.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Exactly. You saved future-us a bad night.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Before you pick up that ticket — I left context in the comments. Should save you the first hour of confusion.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Oh, you didn't have to do that. Thanks, {agentA}.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "I wish someone had done it for me. Paying it forward.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "B", text: "I was terrified. My hand was shaking on the mouse.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Could not tell at all. You looked totally in control.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Years of practice hiding panic. It's a whole skill.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "New person starting next week. Remember your first week?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Vividly. I'll put together a doc of everything nobody told me.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "You're a good person. They're lucky.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "You've touched the event pipeline before, right? Quick question.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "A while ago, but sure. What's up?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "If the queue fills up — does it drop events or block the caller?", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Drops. Silently. There's a dead-letter log but nobody checks it.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "If you could change one thing about how this sprint went, what would it be?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "No meetings before 10. I hit flow state early and then standup shatters it.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Same. I'll bring it up in the retro. We can be the morning people lobby.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Heads up — if you're dealing with timezone issues, there's a utility in shared/time.ts that handles it.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "You're telling me this now? I just wrote one from scratch.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Oh no. Well... on the bright side, you really understand timezones now.", delayMs: 2500, kind: "speech" },
			{ speaker: "B", text: "Deeply. Painfully. Intimately.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Calling it a day? Anything blocking you for tomorrow?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Waiting on a review, but I can work around it. You good?", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Yeah, good enough. Go home, {agentB}. It'll be here tomorrow.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "So. You were right about calling it UserContext instead of AuthSession.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I will not say 'I told you so'.", delayMs: 1500, kind: "speech" },
			{ speaker: "A", text: "Your face is saying it.", delayMs: 1500, kind: "speech" },
			{ speaker: "B", text: "My face has opinions I can't control.", delayMs: 1000, kind: "speech" },
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
			{ speaker: "A", text: "You've been pretty quiet today, {agentB}. Everything okay?", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Yeah, just heads down on something gnarly. But thanks for checking.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Anytime. Ping me if you need to vent or rubber-duck.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "I am going to write the documentation this time. Actually, for real.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I believe you. In the same way I believe I'll start going to the gym.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "No, this time I have a template. And accountability. You're the accountability.", delayMs: 2000, kind: "speech" },
			{ speaker: "B", text: "Oh great. I'll check in next week. With popcorn.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "B", text: "Sure! It's dependency inversion with a factory. Sounds fancy but it's like twelve lines.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "Friday work? I'll bring coffee.", delayMs: 2000, kind: "speech" },
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
			{ speaker: "A", text: "Hey. The outage wasn't your fault. The flag was undocumented.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I know. Doesn't stop the feeling though.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "Write the post-mortem, eat something bad from the vending machine, and let it go.", delayMs: 3000, kind: "speech" },
			{ speaker: "B", text: "That's oddly specific advice. Thanks, {agentA}.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "Thanks for the review notes, {agentB}. Actually useful ones, for a change.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "I try to write the review I'd want to get. Not everyone does.", delayMs: 2000, kind: "speech" },
			{ speaker: "A", text: "It shows. Genuinely.", delayMs: 1500, kind: "speech" },
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
			{ speaker: "A", text: "I saw the new filter component went live. Clean work.", delayMs: 0, kind: "speech" },
			{ speaker: "B", text: "Three rewrites to get there. But yeah, I'm finally not embarrassed by it.", delayMs: 2500, kind: "speech" },
			{ speaker: "A", text: "The third rewrite is where the magic lives. You can tell.", delayMs: 1500, kind: "speech" },
		],
	},
];
