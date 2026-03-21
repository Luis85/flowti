/**
 * phrase-chains-expanded.ts — Second expansion of multi-step thought sequences.
 *
 * Additional working, thinking, idle, break, and any trigger chains.
 */

import type { PhraseChain } from "./phrase-chains.js";

export const EXPANDED_PHRASE_CHAINS: readonly PhraseChain[] = [
	// --- Working chains (second expansion) ---
	{
		id: "working-documentation-writing",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Time to write the docs for this...", delayMs: 3000, kind: "thought" },
			{ text: "How do I explain this to someone who hasn't lost sleep over it?", delayMs: 3000, kind: "thought" },
			{ text: "Step 1: don't mention the three rewrites", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-api-design",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Designing the endpoint shape...", delayMs: 3000, kind: "thought" },
			{ text: "GET or POST? Query param or body?", delayMs: 3000, kind: "thought" },
			{ text: "REST is 'simple' they said", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-code-review-feedback",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Reading through the review comments...", delayMs: 3000, kind: "thought" },
			{ text: "'Nit: spacing.' 'Nit: naming.' 'Nit: existence.'", delayMs: 3000, kind: "thought" },
			{ text: "Fourteen nits later I am a better person", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-dependency-upgrades",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Running npm audit...", delayMs: 4000, kind: "thought" },
			{ text: "87 vulnerabilities. 84 are in dev deps", delayMs: 3000, kind: "thought" },
			{ text: "Upgraded three packages. Broke the build", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-performance-optimization",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Profiling this render loop...", delayMs: 3000, kind: "thought" },
			{ text: "Found it. One function taking 400ms", delayMs: 2000, kind: "thought" },
			{ text: "It was re-sorting on every frame. Every. Frame", delayMs: 0, kind: "thought" },
		],
	},

	// --- Thinking chains (second expansion) ---
	{
		id: "thinking-design-patterns",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Strategy pattern? Observer? Visitor?", delayMs: 3000, kind: "thought" },
			{ text: "Maybe I just need an if statement", delayMs: 2000, kind: "thought" },
			{ text: "The Gang of Four would be disappointed", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-user-empathy",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Let me think like a user for a second...", delayMs: 3000, kind: "thought" },
			{ text: "If I saw this error I'd close the tab", delayMs: 3000, kind: "thought" },
			{ text: "Rewriting the whole error flow. Users deserve better", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-technical-interviews",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "Why do interviews ask about linked lists?", delayMs: 3000, kind: "thought" },
			{ text: "I've never once reversed one at work", delayMs: 3000, kind: "thought" },
			{ text: "Unless you count reversing career decisions", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-career-growth",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Should I specialize deeper or go broader?", delayMs: 3000, kind: "thought" },
			{ text: "T-shaped, Pi-shaped, Comb-shaped...", delayMs: 3000, kind: "thought" },
			{ text: "I'm shaped like a question mark honestly", delayMs: 0, kind: "thought" },
		],
	},

	// --- Idle chains (second expansion) ---
	{
		id: "idle-weekend-plans",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "What am I doing this weekend?", delayMs: 3000, kind: "thought" },
			{ text: "Hiking? Cooking? Binge-watching?", delayMs: 2000, kind: "thought" },
			{ text: "All three sound great until Friday night hits", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-home-improvement",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "I really should fix that shelf...", delayMs: 3000, kind: "thought" },
			{ text: "And the leaky faucet. And the door hinge", delayMs: 3000, kind: "thought" },
			{ text: "My home has a worse backlog than my sprint board", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-learning-new-things",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "I should take that online course I bookmarked", delayMs: 3000, kind: "thought" },
			{ text: "Which one? I've bookmarked forty-seven", delayMs: 2000, kind: "thought" },
			{ text: "Bookmarking is basically the same as learning", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-nostalgia",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Remember when websites had marquee tags?", delayMs: 3000, kind: "thought" },
			{ text: "And animated GIF backgrounds. And hit counters", delayMs: 3000, kind: "thought" },
			{ text: "Peak web design. We'll never top that era", delayMs: 0, kind: "thought" },
		],
	},

	// --- Break chains (second expansion) ---
	{
		id: "break-tea-time",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Tea break. The civilized choice", delayMs: 3000, kind: "thought" },
			{ text: "Earl Grey? Green? Chamomile?", delayMs: 2000, kind: "thought" },
			{ text: "Went with whatever bag was closest. That's the way", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-quick-exercise",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Ten push-ups. Just ten. I can do ten", delayMs: 3000, kind: "thought" },
			{ text: "Made it to six", delayMs: 2000, kind: "thought" },
			{ text: "Six is basically ten. Rounding up", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-phone-scrolling",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Just a quick scroll through my phone...", delayMs: 3000, kind: "thought" },
			{ text: "Seventeen reels later I know how to tile a bathroom", delayMs: 2000, kind: "thought" },
			{ text: "Useful? No. Entertaining? Absolutely", delayMs: 0, kind: "thought" },
		],
	},

	// --- Any chains (second expansion) ---
	{
		id: "any-email-management",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Inbox zero is a myth", delayMs: 3000, kind: "thought" },
			{ text: "Inbox 340 is my reality", delayMs: 2000, kind: "thought" },
			{ text: "Archived everything. Fresh start. Until tomorrow", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-meeting-prep",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Meeting in five minutes. Let me prep...", delayMs: 3000, kind: "thought" },
			{ text: "What was this meeting about again?", delayMs: 2000, kind: "thought" },
			{ text: "Reading the agenda as it starts. Multitasking", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-slack-dynamics",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "Twelve channels. All unread. All urgent apparently", delayMs: 3000, kind: "thought" },
			{ text: "Someone tagged me in a thread from three days ago", delayMs: 3000, kind: "thought" },
			{ text: "Reacted with a thumbs up. Problem solved", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-end-of-day-wind-down",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Wrapping up for the day...", delayMs: 3000, kind: "thought" },
			{ text: "Just one more thing. Okay, one more", delayMs: 3000, kind: "thought" },
			{ text: "It's been forty minutes since 'wrapping up'", delayMs: 0, kind: "thought" },
		],
	},
];
