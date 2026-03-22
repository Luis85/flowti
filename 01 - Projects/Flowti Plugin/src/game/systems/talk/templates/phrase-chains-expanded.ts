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
			{ text: "How do I explain this to someone who hasn't been in the trenches?", delayMs: 3000, kind: "thought" },
			{ text: "Step 1: Omit the three rewrites, the 2am epiphany, and the crying.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-api-design",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Designing the endpoint shape...", delayMs: 3000, kind: "thought" },
			{ text: "GET or POST? Query param or body? Singular or plural?", delayMs: 3000, kind: "thought" },
			{ text: "REST is 'simple' they said. 'It's just HTTP' they said.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-code-review-feedback",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Reading through the review comments...", delayMs: 3000, kind: "thought" },
			{ text: "'Nit: spacing.' 'Nit: naming.' 'Nit: why does this exist.'", delayMs: 3000, kind: "thought" },
			{ text: "Fourteen nits later I am humbler, wiser, and slightly annoyed.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-dependency-upgrades",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Running npm audit... deep breath...", delayMs: 4000, kind: "thought" },
			{ text: "87 vulnerabilities. 84 are in dev deps nobody uses. 3 are terrifying.", delayMs: 3000, kind: "thought" },
			{ text: "Upgraded three packages. Broke the build. Downgraded two. Build still broken.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-performance-optimization",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Profiling this render loop...", delayMs: 3000, kind: "thought" },
			{ text: "Found it. One function: 400ms. In a loop. Called 60 times per second.", delayMs: 2000, kind: "thought" },
			{ text: "It was re-sorting on every frame. Every. Single. Frame. For six months.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-merge-conflict",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Pulling latest... merge conflict. Of course.", delayMs: 3000, kind: "thought" },
			{ text: "Both sides changed the same 12 lines. In different directions.", delayMs: 3000, kind: "thought" },
			{ text: "Resolved. I think. The tests will tell me if I'm wrong. They always do.", delayMs: 0, kind: "thought" },
		],
	},

	// --- Thinking chains (second expansion) ---
	{
		id: "thinking-design-patterns",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Strategy pattern? Observer? Visitor? Abstract factory factory?", delayMs: 3000, kind: "thought" },
			{ text: "Maybe I just need an if statement and some courage", delayMs: 2000, kind: "thought" },
			{ text: "The Gang of Four would be disappointed. But the code would ship.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-user-empathy",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Let me think like a user for a second...", delayMs: 3000, kind: "thought" },
			{ text: "If I saw this error I'd close the tab, clear my cookies, and blame my wifi", delayMs: 3000, kind: "thought" },
			{ text: "Rewriting the whole error flow. Nobody deserves 'Error: undefined is not a function.'", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-technical-interviews",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "Why do interviews ask about inverting binary trees?", delayMs: 3000, kind: "thought" },
			{ text: "I've never once done that at work. I HAVE untangled a 900-line useEffect.", delayMs: 3000, kind: "thought" },
			{ text: "There's no LeetCode problem for 'fix the build at 11pm.' Should be.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-career-growth",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Should I specialize deeper or go broader?", delayMs: 3000, kind: "thought" },
			{ text: "T-shaped, Pi-shaped, Comb-shaped...", delayMs: 3000, kind: "thought" },
			{ text: "I'm shaped like a question mark. Curvy, confused, and ending in a dot.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-scope-creep",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "The ticket said 'small UI tweak.'", delayMs: 3000, kind: "thought" },
			{ text: "Three days later I've rewritten the state management layer.", delayMs: 3000, kind: "thought" },
			{ text: "Scope creep didn't creep. It sprinted. Past me. Waving.", delayMs: 0, kind: "thought" },
		],
	},

	// --- Idle chains (second expansion) ---
	{
		id: "idle-weekend-plans",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "What am I doing this weekend?", delayMs: 3000, kind: "thought" },
			{ text: "Hiking? Cooking? Finally finishing that side project from 2023?", delayMs: 2000, kind: "thought" },
			{ text: "Friday night me will choose 'couch.' Friday night me always chooses couch.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-home-improvement",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "I really should fix that shelf...", delayMs: 3000, kind: "thought" },
			{ text: "And the leaky faucet. And the door that doesn't close right.", delayMs: 3000, kind: "thought" },
			{ text: "My apartment has a worse backlog than my sprint board. And no standup.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-learning-new-things",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "I should learn that new framework everyone's talking about", delayMs: 3000, kind: "thought" },
			{ text: "Watched the intro video. Bookmarked the docs. Starred the repo.", delayMs: 2000, kind: "thought" },
			{ text: "That's basically mastery. Adding it to my LinkedIn.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-nostalgia",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Remember when websites had visitor counters and guestbooks?", delayMs: 3000, kind: "thought" },
			{ text: "And animated cursor trails. And 'under construction' GIFs.", delayMs: 3000, kind: "thought" },
			{ text: "We had less. It was better. I will not elaborate.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-git-log-browsing",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Browsing old commit messages...", delayMs: 3000, kind: "thought" },
			{ text: "'fix.' 'fix again.' 'please work.' 'WORK.' 'actually fix.'", delayMs: 3000, kind: "thought" },
			{ text: "A five-act tragedy in commit history. Author: me.", delayMs: 0, kind: "thought" },
		],
	},

	// --- Break chains (second expansion) ---
	{
		id: "break-tea-time",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Tea break. The civilized choice.", delayMs: 3000, kind: "thought" },
			{ text: "Earl Grey? Green? Whatever's left in the drawer?", delayMs: 2000, kind: "thought" },
			{ text: "Mystery tea it is. Could be chamomile. Could be from 2019. Adventure.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-quick-exercise",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Ten push-ups. Just ten. I can do ten. Definitely.", delayMs: 3000, kind: "thought" },
			{ text: "Made it to six. And a half. The half counts.", delayMs: 2000, kind: "thought" },
			{ text: "Seven tomorrow. Growth mindset.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-phone-scrolling",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Just a quick scroll through my phone...", delayMs: 3000, kind: "thought" },
			{ text: "Seventeen reels later I know how to tile a bathroom and make sourdough", delayMs: 2000, kind: "thought" },
			{ text: "Useful? No. Time well spent? Also no. Doing it again tomorrow? Absolutely.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-existential-walk",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Going for a short walk to clear my head...", delayMs: 3000, kind: "thought" },
			{ text: "Solved the bug at step 47. Brain needed movement, not monitors.", delayMs: 2000, kind: "thought" },
			{ text: "Back at the desk. Forgot the solution. Walking again.", delayMs: 0, kind: "thought" },
		],
	},

	// --- Any chains (second expansion) ---
	{
		id: "any-email-management",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Inbox zero is a myth. Like clean code. And 'quick syncs.'", delayMs: 3000, kind: "thought" },
			{ text: "Inbox 340 is my reality. Most of them are automated. I hope.", delayMs: 2000, kind: "thought" },
			{ text: "Selected all. Archived. Fresh start. Will last until lunch.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-meeting-prep",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Meeting in five minutes. Let me prep...", delayMs: 3000, kind: "thought" },
			{ text: "What's the agenda? Who called this? Is this the one I declined?", delayMs: 2000, kind: "thought" },
			{ text: "Reading the agenda as they introduce me. Multitasking at its finest.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-slack-dynamics",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "Twelve channels. All unread. All apparently critical.", delayMs: 3000, kind: "thought" },
			{ text: "Someone tagged me in a thread from Wednesday. It's about a decision already made.", delayMs: 3000, kind: "thought" },
			{ text: "Reacted with a thumbs up. The universal 'I was not consulted but fine.'", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-end-of-day-wind-down",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Wrapping up for the day... just one more commit...", delayMs: 3000, kind: "thought" },
			{ text: "Okay one more. And this test. And that lint warning.", delayMs: 3000, kind: "thought" },
			{ text: "It's been 90 minutes since 'wrapping up.' I live here now.", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-ci-pipeline",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "CI running... step 4 of 11...", delayMs: 4000, kind: "thought" },
			{ text: "Failed on lint. One trailing space. ONE. On line 247.", delayMs: 3000, kind: "thought" },
			{ text: "Fixed. Pushed. Waiting again. The pipeline is my real manager.", delayMs: 0, kind: "thought" },
		],
	},
];
