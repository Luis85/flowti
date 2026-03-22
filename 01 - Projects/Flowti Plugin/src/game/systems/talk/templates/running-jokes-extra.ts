/**
 * running-jokes-extra.ts — Jokes 9-15 for the agent world.
 *
 * Split from running-jokes.ts to keep file size manageable.
 * Imported and re-exported via the main running-jokes module.
 */

import type { RunningJoke } from "../conversation-types.js";

export const RUNNING_JOKES_EXTRA: readonly RunningJoke[] = [
	// ── 9. Documentation Promise ────────────────────────────────────────
	{
		id: "joke:documentation-promise",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 75000,
		tags: ["running-joke", "tech", "procrastination"],
		maxEscalation: 3,
		callbackChance: 0.12,
		callbackLines: [
			"That's seventeen 'document laters' now.",
			"Future {agentA} will handle it, apparently.",
			"The docs will be beautiful. Someday.",
		],
		variants: [
			// variant 0 — the original promise
			[
				{ speaker: "A", text: "I'll document this properly later, I'm in the zone right now.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Sure.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "I mean it this time.", delayMs: 1000, kind: "speech" },
				{ speaker: "B", text: "I know.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "*makes a tally mark*", delayMs: 1200, kind: "thought" },
			],
			// variant 1 — the tally grows
			[
				{ speaker: "B", text: "That's the eighth time this sprint.", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "Eighth what?", delayMs: 1000, kind: "speech" },
				{ speaker: "B", text: "*shows tally mark sheet*", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "You've been keeping score?!", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "Someone has to.", delayMs: 800, kind: "speech" },
			],
			// variant 2 — fully resigned
			[
				{ speaker: "A", text: "I'll document this la—", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "*makes tally mark before the sentence ends*", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "You didn't even let me finish.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I knew where it was going.", delayMs: 800, kind: "speech" },
				{ speaker: "A", text: "Fair.", delayMs: 600, kind: "thought" },
			],
		],
	},

	// ── 10. Mysterious Tuesday Bug ──────────────────────────────────────
	{
		id: "joke:mysterious-bug",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 85000,
		tags: ["running-joke", "tech", "conspiracy"],
		maxEscalation: 4,
		callbackChance: 0.09,
		callbackLines: [
			"What day is it? *checks nervously*",
			"Is it Tuesday? I need to know if it's Tuesday.",
			"The Tuesday bug lives rent-free in my head.",
		],
		variants: [
			// variant 0 — first discovery
			[
				{ speaker: "A", text: "This only fails on Tuesdays. I've tracked it for three weeks.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "...what?", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "Monday? Fine. Wednesday? Fine. Tuesdays it falls apart.", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "That's not how software works.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "And yet.", delayMs: 800, kind: "speech" },
			],
			// variant 1 — theories multiply
			[
				{ speaker: "A", text: "I think it's the Tuesday timezone offset from the cron job.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Last week you said it was cosmic rays.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "Those aren't mutually exclusive.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "They really are.", delayMs: 800, kind: "speech" },
			],
			// variant 2 — conspiracy deepens
			[
				{ speaker: "A", text: "I blocked all Tuesdays from our deploy calendar.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "You can't just remove Tuesday from the calendar.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "Watch me.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "There will still be a Tuesday. It will just be mislabeled Wednesday.", delayMs: 2000, kind: "speech" },
				{ speaker: "A", text: "Then the bug won't know.", delayMs: 1000, kind: "thought" },
			],
			// variant 3 — fully meta
			[
				{ speaker: "A", text: "It's Tuesday.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "How's the bug?", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "Present. Correct. Reliable as the sunrise.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "At least we can count on something.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "The bug is my Tuesday friend now.", delayMs: 1200, kind: "thought" },
			],
		],
	},

	// ── 11. Meeting That Could Have Been an Email ───────────────────────
	{
		id: "joke:meeting-email",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 70000,
		tags: ["running-joke", "social", "meetings"],
		maxEscalation: 3,
		callbackChance: 0.13,
		callbackLines: [
			"This could have been an email.",
			"*makes eye contact* Email.",
			"Ninety minutes I will never reclaim.",
		],
		variants: [
			// variant 0 — post-meeting complaint
			[
				{ speaker: "A", text: "That entire meeting could have been a three-line email.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Two lines. The third was redundant.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "Ninety minutes.", delayMs: 1200, kind: "thought" },
				{ speaker: "B", text: "Ninety.", delayMs: 800, kind: "thought" },
			],
			// variant 1 — post-it protest
			[
				{ speaker: "A", text: "I put a post-it on my monitor: 'Could this be an email?'", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "How often does it help?", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "It doesn't stop the meetings. It just validates my suffering.", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "That's something, I suppose.", delayMs: 1200, kind: "speech" },
			],
			// variant 2 — a glance is enough
			[
				{ speaker: "A", text: "We made eye contact across the room at the start of that call.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "We both knew.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "Instantly.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "Didn't need to say a word.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "We're past words now.", delayMs: 1000, kind: "thought" },
			],
		],
	},

	// ── 12. Pet Code Review ─────────────────────────────────────────────
	{
		id: "joke:pet-code-review",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 80000,
		tags: ["running-joke", "pet", "tech"],
		maxEscalation: 4,
		callbackChance: 0.11,
		callbackLines: [
			"{petName} has requested changes.",
			"The cat's feedback was brief but decisive.",
			"I've merged {petName}'s review. Who am I to argue?",
		],
		variants: [
			// variant 0 — keyboard walk
			[
				{ speaker: "A", text: "{petName} just walked across my keyboard.", delayMs: 0, kind: "speech" },
				{ speaker: "pet", text: "*walks across keyboard with purpose*", delayMs: 1500, kind: "thought" },
				{ speaker: "B", text: "What did they type?", delayMs: 1800, kind: "speech" },
				{ speaker: "A", text: "';;; ,,,vvv'. I've added it to the PR description.", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "As a comment or a commit?", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "A commit.", delayMs: 800, kind: "speech" },
			],
			// variant 1 — interpreting the review
			[
				{ speaker: "A", text: "{petName} sat on my keyboard for three full minutes today.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "What's the consensus?", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "Mostly ffffffffffffff. I'm reading it as 'needs more thought'.", delayMs: 2000, kind: "speech" },
				{ speaker: "pet", text: "*is satisfied with this interpretation*", delayMs: 1500, kind: "thought" },
			],
			// variant 2 — the review is cited in a meeting
			[
				{ speaker: "A", text: "I referenced {petName}'s review in the architecture meeting.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Please tell me you're joking.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "'The reviewer flagged concerns in section 4, represented here as semicolons.'", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "Did anyone ask who the reviewer was?", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "I said 'a domain expert who prefers anonymity'.", delayMs: 1800, kind: "speech" },
			],
			// variant 3 — {petName} is now official reviewer
			[
				{ speaker: "A", text: "I've added {petName} to the CODEOWNERS file.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "As a joke.", delayMs: 800, kind: "speech" },
				{ speaker: "A", text: "As a reviewer for the session domain.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "That's a real file.", delayMs: 800, kind: "speech" },
				{ speaker: "A", text: "Their feedback is consistent and they're always available.", delayMs: 1500, kind: "speech" },
				{ speaker: "pet", text: "*sits on the keyboard in acknowledgement*", delayMs: 1500, kind: "thought" },
			],
		],
	},

	// ── 13. The Scope Creep Handshake ───────────────────────────────────
	{
		id: "joke:scope-creep-handshake",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 85000,
		tags: ["running-joke", "tech", "product"],
		maxEscalation: 3,
		callbackChance: 0.10,
		callbackLines: [
			"*reads ticket* 'Minor tweak.' Sure. We've heard that before.",
			"I timed it. Forty-three minutes from 'small change' to 'full redesign'.",
			"The scope has creeped. We proceed.",
		],
		variants: [
			// variant 0 — first acknowledgement
			[
				{ speaker: "A", text: "The ticket said 'small UI tweak'. It's now a full redesign.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Classic scope creep.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "And yet here I am, resizing the entire component tree.", delayMs: 1800, kind: "speech" },
				{ speaker: "B", text: "We've all been there.", delayMs: 1000, kind: "speech" },
			],
			// variant 1 — they see it coming
			[
				{ speaker: "B", text: "New ticket just dropped. 'Minor tweak to the form.'", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "I give it two hours before it's a full page rebuild.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "I give it ninety minutes.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "Deal.", delayMs: 800, kind: "speech" },
			],
			// variant 2 — they've made peace with it
			[
				{ speaker: "A", text: "It was a full page rebuild. Seventy minutes.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "You win. Buy me a coffee.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "At least the form is nice now.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "The scope giveth and the scope taketh.", delayMs: 1200, kind: "speech" },
			],
		],
	},

	// ── 14. The 'Works on My Machine' Shrine ───────────────────────────
	{
		id: "joke:works-on-my-machine",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 75000,
		tags: ["running-joke", "tech", "debugging"],
		maxEscalation: 3,
		callbackChance: 0.13,
		callbackLines: [
			"Works on my machine. Ship it.",
			"My machine is the canonical environment now.",
			"The shrine has been consulted.",
		],
		variants: [
			// variant 0 — original offence
			[
				{ speaker: "A", text: "It works on my machine. That's all I have.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "It fails on every other machine.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "Then perhaps those machines are wrong.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "There are seventeen other machines.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "Seventeen suspicious machines.", delayMs: 1000, kind: "thought" },
			],
			// variant 1 — they build a meme around it
			[
				{ speaker: "B", text: "I made a 'Works On My Machine' certificate. I'm printing yours.", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "For the wall?", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "For the wall.", delayMs: 800, kind: "speech" },
				{ speaker: "A", text: "Finally, recognition.", delayMs: 1200, kind: "thought" },
			],
			// variant 2 — the shrine
			[
				{ speaker: "A", text: "I've set up a small shrine around my laptop. Candle, post-its, a rubber duck.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "For the 'Works on My Machine' energy.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "For the energy.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "Does it help?", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "It still only works on my machine. But the vibes are immaculate.", delayMs: 2000, kind: "speech" },
			],
		],
	},

	// ── 15. The Infinite Refactor ───────────────────────────────────────
	{
		id: "joke:infinite-refactor",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 95000,
		tags: ["running-joke", "tech", "perfectionism"],
		maxEscalation: 3,
		callbackChance: 0.08,
		callbackLines: [
			"Don't ask about the refactor. Just... don't.",
			"The branch has its own branch now. That's all I'll say.",
			"I heard the refactor branch is now older than the feature.",
		],
		variants: [
			// variant 0 — day one of the refactor
			[
				{ speaker: "A", text: "I'm doing a quick refactor. Should be done by end of day.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Famous last words.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "It's genuinely small this time.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I'll check back in a week.", delayMs: 1000, kind: "speech" },
			],
			// variant 1 — META-AWARENESS: A realizes the pattern
			[
				{ speaker: "B", text: "How's the refactor?", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "I — okay. I'm going to say something and I need you to not react.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "...go on.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "I think this is the same refactor from last month. I just keep finding new layers.", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "You've been refactoring the same thing for a month?", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "I don't know how to stop. Every time I fix one thing I see another thing.", delayMs: 1800, kind: "speech" },
			],
			// variant 2 — META-AWARENESS: they try to break the cycle
			[
				{ speaker: "A", text: "I'm closing the refactor branch. Right now. It's done.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Really?", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "I merged it. It's over. I'm free.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "How do you feel?", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "...I already see something I could improve in the merge commit.", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "Step away from the keyboard.", delayMs: 1000, kind: "speech" },
			],
		],
	},
];
