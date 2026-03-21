/**
 * phrase-chains-additional.ts — Additional multi-step thought sequences.
 *
 * Extended working, thinking, idle, break, and any trigger chains.
 */

import type { PhraseChain } from "./phrase-chains.js";

export const ADDITIONAL_PHRASE_CHAINS: readonly PhraseChain[] = [
	// --- Working chains (additional) ---
	{
		id: "working-console-log-archeology",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Why is 'HERE 3' printing in the console?", delayMs: 3000, kind: "thought" },
			{ text: "Where is HERE 1 and HERE 2?", delayMs: 3000, kind: "thought" },
			{ text: "They're mine. All three are mine", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-merge-conflict",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Pulling latest main...", delayMs: 3000, kind: "thought" },
			{ text: "47 merge conflicts", delayMs: 2000, kind: "thought" },
			{ text: "I'll just rewrite the whole file. Faster", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-css-centering",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Just need to center this div", delayMs: 3000, kind: "thought" },
			{ text: "flexbox? grid? absolute position?", delayMs: 3000, kind: "thought" },
			{ text: "It's 2026 and centering is still an adventure", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-eureka-moment",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "What if I flip the logic entirely...", delayMs: 3000, kind: "thought" },
			{ text: "Oh. OH.", delayMs: 2000, kind: "thought" },
			{ text: "That's beautiful. I'm a genius", delayMs: 0, kind: "speech" },
		],
	},
	{
		id: "working-regex-pain",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "I need a regex for this", delayMs: 3000, kind: "thought" },
			{ text: "/^(?:(?!pattern).)*$/gm ...right?", delayMs: 4000, kind: "thought" },
			{ text: "Now I have two problems", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-test-green-to-red",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "All 47 tests passing!", delayMs: 3000, kind: "speech" },
			{ text: "Let me just add one tiny change...", delayMs: 3000, kind: "thought" },
			{ text: "12 tests failing. HOW", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-dependency-rabbit-hole",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "This package needs an update", delayMs: 3000, kind: "thought" },
			{ text: "Which needs a peer dep update", delayMs: 3000, kind: "thought" },
			{ text: "Which needs Node 22. And a prayer", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-copy-paste-shame",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "I'll just copy this from the other file", delayMs: 3000, kind: "thought" },
			{ text: "Okay and adapt it slightly...", delayMs: 2000, kind: "thought" },
			{ text: "This is a future refactor. I promise", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-off-by-one",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Array index out of bounds?!", delayMs: 3000, kind: "thought" },
			{ text: "Is it <= or < ...", delayMs: 2000, kind: "thought" },
			{ text: "Off by one. The eternal enemy", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-commit-message-art",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Time to write a commit message", delayMs: 3000, kind: "thought" },
			{ text: "'fix stuff' ... no, be descriptive", delayMs: 3000, kind: "thought" },
			{ text: "'fix: resolve edge case in data pipeline'", delayMs: 2000, kind: "thought" },
			{ text: "Shakespeare would be proud", delayMs: 0, kind: "thought" },
		],
	},

	// --- Thinking chains (additional) ---
	{
		id: "thinking-premature-optimization",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "I could optimize this to run 2ms faster", delayMs: 3000, kind: "thought" },
			{ text: "It runs once a day", delayMs: 2000, kind: "thought" },
			{ text: "Knuth is staring at me disapprovingly", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-abstractions-deep",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "We need an abstraction for this", delayMs: 3000, kind: "thought" },
			{ text: "An AbstractFactoryProviderManager?", delayMs: 3000, kind: "thought" },
			{ text: "Sometimes a function is just a function", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-scope-creep-realization",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "This was supposed to be a small feature", delayMs: 3000, kind: "thought" },
			{ text: "But if we also handle edge case X...", delayMs: 3000, kind: "thought" },
			{ text: "I just designed a whole new system. Oops", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-technical-debt-negotiation",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "We really need to address this tech debt", delayMs: 3000, kind: "thought" },
			{ text: "But the deadline is next week...", delayMs: 3000, kind: "thought" },
			{ text: "Future me is going to hate present me", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-yak-shave-spiral",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "To fix bug A, I need to update module B", delayMs: 3000, kind: "thought" },
			{ text: "But module B depends on config C...", delayMs: 3000, kind: "thought" },
			{ text: "And config C needs a migration. Classic yak shave", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-naming-philosophy",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "Is it a Service? A Manager? A Handler?", delayMs: 3000, kind: "thought" },
			{ text: "What's the difference, really?", delayMs: 3000, kind: "thought" },
			{ text: "Naming things: one of two hard problems", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-monolith-vs-micro",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "Should this be a microservice?", delayMs: 3000, kind: "thought" },
			{ text: "Or would that just be a distributed monolith?", delayMs: 3000, kind: "thought" },
			{ text: "The answer is always 'it depends'", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-documentation-epiphany",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Why didn't past me document this?", delayMs: 3000, kind: "thought" },
			{ text: "Oh wait, there IS documentation", delayMs: 2000, kind: "thought" },
			{ text: "It's completely wrong. Somehow worse", delayMs: 0, kind: "thought" },
		],
	},

	// --- Idle chains (additional) ---
	{
		id: "idle-keyboard-fidget",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "Spinning pen around my fingers...", delayMs: 2000, kind: "thought" },
			{ text: "Dropped it", delayMs: 2000, kind: "thought" },
			{ text: "Under the desk. Of course", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-wiki-rabbit-hole",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Let me just look up one thing...", delayMs: 3000, kind: "thought" },
			{ text: "How did I get to the history of lighthouses?", delayMs: 3000, kind: "thought" },
			{ text: "45 minutes gone. Worth it though", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-new-language-fantasy",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Maybe I should learn Rust", delayMs: 3000, kind: "thought" },
			{ text: "Or Go. Or Zig. Or that new one...", delayMs: 3000, kind: "thought" },
			{ text: "I'll add it to the list of 12 I'm 'learning'", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-desk-ecosystem",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "My desk has three empty mugs", delayMs: 2000, kind: "thought" },
			{ text: "And a snack wrapper graveyard", delayMs: 2000, kind: "thought" },
			{ text: "It's an ecosystem at this point", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-startup-idea",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "What if there was an app that...", delayMs: 3000, kind: "thought" },
			{ text: "Wait, that already exists", delayMs: 2000, kind: "thought" },
			{ text: "Okay but mine would be different. Somehow", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-music-shuffle",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "Skip. Skip. Skip. Skip.", delayMs: 3000, kind: "thought" },
			{ text: "I have 2000 songs and hate all of them right now", delayMs: 3000, kind: "thought" },
			{ text: "Back to the same album I always play", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-monitor-count",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Do I need a third monitor?", delayMs: 3000, kind: "thought" },
			{ text: "I barely use the second one", delayMs: 2000, kind: "thought" },
			{ text: "Yes. The answer is always yes", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-email-dread",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "I should check my email", delayMs: 3000, kind: "thought" },
			{ text: "...", delayMs: 2000, kind: "thought" },
			{ text: "I'll check it after lunch", delayMs: 0, kind: "thought" },
		],
	},

	// --- Break chains (additional) ---
	{
		id: "break-walk-realization",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Going for a short walk...", delayMs: 3000, kind: "thought" },
			{ text: "Wait, I just thought of the solution", delayMs: 2000, kind: "thought" },
			{ text: "Why does walking fix everything?", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-lunch-decision-paralysis",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "What should I eat?", delayMs: 3000, kind: "thought" },
			{ text: "I've been staring at the menu for 10 minutes", delayMs: 3000, kind: "thought" },
			{ text: "Same thing as yesterday. Decision made", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-eye-strain",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "My eyes are so tired", delayMs: 2000, kind: "thought" },
			{ text: "20-20-20 rule: look 20 feet away for 20 seconds", delayMs: 3000, kind: "thought" },
			{ text: "That wall is definitely not 20 feet away but close enough", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-hydration-quest",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Time to refill the water bottle", delayMs: 2000, kind: "thought" },
			{ text: "First water since... this morning?", delayMs: 2000, kind: "thought" },
			{ text: "My kidneys just sent a thank you note", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-fresh-air",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Stepping outside for a minute", delayMs: 3000, kind: "thought" },
			{ text: "Oh wow the sky is pretty today", delayMs: 3000, kind: "speech" },
			{ text: "Okay I'm recharged. Back to the cave", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-micro-nap-temptation",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Just gonna rest my eyes for five minutes", delayMs: 4000, kind: "thought" },
			{ text: "Zzz...", delayMs: 3000, kind: "thought" },
			{ text: "That was 25 minutes. Power nap achieved", delayMs: 0, kind: "thought" },
		],
	},

	// --- Any chains (additional) ---
	{
		id: "any-documentation-vow",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "I'm going to document everything this time", delayMs: 3000, kind: "thought" },
			{ text: "Every function. Every decision", delayMs: 2000, kind: "thought" },
			{ text: "...starting next sprint", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-standup-rehearsal",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "What did I do yesterday?", delayMs: 3000, kind: "thought" },
			{ text: "I... refactored? No, that was Monday", delayMs: 3000, kind: "thought" },
			{ text: "I'll just say 'continued working on the ticket'", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-rubber-duck-conversation",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "Talking to myself again", delayMs: 2000, kind: "thought" },
			{ text: "At least I give good advice", delayMs: 2000, kind: "thought" },
			{ text: "And I'm an excellent listener", delayMs: 0, kind: "speech" },
		],
	},
	{
		id: "any-version-number-grief",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "We're on version 3.7.42-beta.2", delayMs: 3000, kind: "thought" },
			{ text: "Semantic versioning is more art than science", delayMs: 3000, kind: "thought" },
			{ text: "Should we just call it v4 and start fresh?", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-timezone-math",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "If it's 3pm here, what time is it for them?", delayMs: 3000, kind: "thought" },
			{ text: "Carry the one... subtract daylight savings...", delayMs: 3000, kind: "thought" },
			{ text: "I'll just ask what time works for them", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-friday-deploy-temptation",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "It's a small change, I could deploy today...", delayMs: 3000, kind: "thought" },
			{ text: "But it's Friday", delayMs: 2000, kind: "thought" },
			{ text: "Monday it is. I choose peace", delayMs: 0, kind: "thought" },
		],
	},
];
