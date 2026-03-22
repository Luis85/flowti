/**
 * phrase-chains-core.ts — Core multi-step thought sequences.
 *
 * Working, thinking, idle, break, and any trigger chains
 * that create little narrative moments.
 */

import type { PhraseChain } from "./phrase-chains.js";

export const CORE_PHRASE_CHAINS: readonly PhraseChain[] = [
	// --- Working chains ---
	{
		id: "working-what-if",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Hmm, what if I flip the condition...", delayMs: 3000, kind: "thought" },
			{ text: "No wait, that breaks the other branch", delayMs: 3000, kind: "thought" },
			{ text: "Actually... no... actually YES. That's it.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-typo-debug",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Okay let me trace this from the entry point...", delayMs: 4000, kind: "thought" },
			{ text: "...through the middleware... past the validator... into the—", delayMs: 3000, kind: "thought" },
			{ text: "It was a typo. On line 4. I've been debugging for an hour.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-almost-there",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Almost there... one more assertion...", delayMs: 3000, kind: "thought" },
			{ text: "Running the suite...", delayMs: 2000, kind: "thought" },
			{ text: "GREEN. ALL GREEN. Don't touch ANYTHING.", delayMs: 0, kind: "speech" },
		],
	},
	{
		id: "working-stack-overflow",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Let me just check one thing online...", delayMs: 4000, kind: "thought" },
			{ text: "This answer is from 2014 but it has 847 upvotes and a mass of gold badges", delayMs: 3000, kind: "thought" },
			{ text: "It worked. The code is ancient. I am not proud. We move on.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-refactor-spiral",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "I'll just clean up this one function real quick", delayMs: 4000, kind: "thought" },
			{ text: "...which calls this one... which depends on that module... which...", delayMs: 3000, kind: "thought" },
			{ text: "I've been refactoring for two hours. The original bug is still there.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-naming-struggle",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "What should I call this variable...", delayMs: 3000, kind: "thought" },
			{ text: "temp? data? thing? result? processedData? No. Be professional.", delayMs: 3000, kind: "thought" },
			{ text: "finalResultDataProcessedV2_REAL. Ship it.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-pr-review",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Reviewing this PR... 47 files changed...", delayMs: 3000, kind: "thought" },
			{ text: "Oh. Oh no. They nested five ternaries inside a template literal", delayMs: 2000, kind: "thought" },
			{ text: "Comment drafted. Deleted. Redrafted. More diplomatic this time.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-git-history",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Who wrote this cursed function?", delayMs: 3000, kind: "thought" },
			{ text: "git blame says...", delayMs: 2000, kind: "thought" },
			{ text: "Me. Six months ago. Commit message: 'quick fix.' Outstanding.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-green-red",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Tests are green. Feature works. Pushing to staging.", delayMs: 3000, kind: "thought" },
			{ text: "Wait. The test was green but the feature was broken.", delayMs: 3000, kind: "thought" },
			{ text: "The test was asserting the wrong thing. Classic.", delayMs: 0, kind: "thought" },
		],
	},

	// --- Thinking chains ---
	{
		id: "thinking-architecture",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "If we restructure the data layer...", delayMs: 4000, kind: "thought" },
			{ text: "Then the API becomes much cleaner...", delayMs: 3000, kind: "thought" },
			{ text: "I need a whiteboard. And three days. And probably a nap first.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-shower-thought",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "You know what the real problem is?", delayMs: 3000, kind: "thought" },
			{ text: "We've been solving the wrong problem for two sprints", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-complexity",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "Quick hack: 30 minutes. Proper solution: 3 days.", delayMs: 3000, kind: "thought" },
			{ text: "The quick hack becomes permanent in 3... 2... 1...", delayMs: 3000, kind: "thought" },
			{ text: "We both know which one I'm picking. Future me can deal with it.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-rubber-duck",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Okay rubber duck, here's the situation...", delayMs: 3000, kind: "thought" },
			{ text: "So the user clicks submit, and then we... oh.", delayMs: 2000, kind: "thought" },
			{ text: "I literally solved it by explaining it out loud. Every. Single. Time.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-pushed-to-main",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "Wait. Which branch am I on?", delayMs: 2000, kind: "thought" },
			{ text: "...main. I'm on main. I just pushed to main.", delayMs: 2000, kind: "thought" },
			{ text: "Force push to undo? Revert commit? Flee the country?", delayMs: 0, kind: "thought" },
		],
	},

	// --- Idle chains ---
	{
		id: "idle-productive",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "I should do something productive", delayMs: 3000, kind: "thought" },
			{ text: "Like clear my PR backlog. Or organize my tabs. All 73 of them.", delayMs: 3000, kind: "thought" },
			{ text: "Tomorrow. Definitely tomorrow.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-existential",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "What if all code is just... organized electricity?", delayMs: 3000, kind: "thought" },
			{ text: "And bugs are just electricity having opinions?", delayMs: 3000, kind: "thought" },
			{ text: "I need more caffeine. Or less. Hard to tell.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-notification-check",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "Let me check my notifications...", delayMs: 3000, kind: "thought" },
			{ text: "247 unread. 243 are Dependabot. 3 are 'sounds good.' 1 is my own message.", delayMs: 2000, kind: "thought" },
			{ text: "Marking all as read. Inbox zero achieved. Spiritually.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-side-project",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "I have this idea for a side project...", delayMs: 3000, kind: "thought" },
			{ text: "Just a weekend project. Simple. Minimal scope.", delayMs: 2000, kind: "thought" },
			{ text: "...and that's how my last three abandoned repos started.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-keyboard-sounds",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Maybe I should get a mechanical keyboard", delayMs: 3000, kind: "thought" },
			{ text: "Cherry MX Browns? Blues? Reds? Topre?", delayMs: 3000, kind: "thought" },
			{ text: "Three hours deep in a keyboard forum. I don't even remember the original task.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-tab-archaeology",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "I have... 94 tabs open. In three windows.", delayMs: 3000, kind: "thought" },
			{ text: "This one is from last Tuesday. Why was I reading about Byzantine fault tolerance?", delayMs: 3000, kind: "thought" },
			{ text: "Closing nothing. Every tab is critical. Somehow.", delayMs: 0, kind: "thought" },
		],
	},

	// --- Break chains ---
	{
		id: "break-stretching",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Stretching...", delayMs: 2000, kind: "thought" },
			{ text: "Something in my back just went *pop*", delayMs: 2000, kind: "speech" },
			{ text: "Either that fixed it or ended it. We'll see.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-coffee-quest",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Coffee run. This is not optional.", delayMs: 3000, kind: "thought" },
			{ text: "The good machine is taken. Someone's making a latte. A LATTE. At 3pm.", delayMs: 3000, kind: "thought" },
			{ text: "Vending machine it is. I've accepted my fate.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-window-stare",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Looking out the window for a bit...", delayMs: 3000, kind: "thought" },
			{ text: "Oh right, weather. Sunlight. The outside world. People walking dogs.", delayMs: 2000, kind: "thought" },
			{ text: "I should go outside more. After this sprint. And the next one.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-snack-debate",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Healthy snack or junk food? The eternal question.", delayMs: 3000, kind: "thought" },
			{ text: "I had an apple on Monday so technically I'm ahead on health", delayMs: 2000, kind: "thought" },
			{ text: "Chips it is. The apple was ambitious.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-posture-check",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Posture check...", delayMs: 2000, kind: "thought" },
			{ text: "I was sitting like a folded lawn chair. How long have I been like this?", delayMs: 0, kind: "thought" },
		],
	},

	// --- Any chains ---
	{
		id: "any-imposter",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "Everyone else seems to know exactly what they're doing", delayMs: 3000, kind: "thought" },
			{ text: "Wait, the senior dev just Googled 'how to center a div'", delayMs: 3000, kind: "thought" },
			{ text: "We're all just winging it. That's oddly comforting.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-meeting-recovery",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "That meeting could have been an email", delayMs: 3000, kind: "thought" },
			{ text: "Actually, it could have been a Slack message", delayMs: 2000, kind: "thought" },
			{ text: "Actually, it could have been a mutual agreement to not have it", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-time-perception",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "What time is it? Quick glance...", delayMs: 2000, kind: "thought" },
			{ text: "HOW is it already 4pm?! I've eaten nothing. I've done... things?", delayMs: 0, kind: "speech" },
		],
	},
	{
		id: "any-deploy-prayer",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Deploying to production. On a Friday. Against all advice.", delayMs: 4000, kind: "thought" },
			{ text: "Please work please work please work please work", delayMs: 3000, kind: "thought" },
			{ text: "It's up. Nothing is on fire. Yet. We celebrate cautiously.", delayMs: 0, kind: "speech" },
		],
	},
	{
		id: "any-wrong-branch",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "Nice. That's a solid chunk of work. Time to commit.", delayMs: 3000, kind: "thought" },
			{ text: "git status... wait. What branch is this?", delayMs: 2000, kind: "thought" },
			{ text: "Wrong branch. Two hours on the wrong branch. Beautiful.", delayMs: 0, kind: "thought" },
		],
	},
];
