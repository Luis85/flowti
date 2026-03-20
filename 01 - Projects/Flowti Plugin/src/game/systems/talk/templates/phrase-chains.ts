/**
 * phrase-chains.ts — Multi-step thought sequences for richer inner monologue.
 *
 * Each chain plays out over 2-3 bubbles with timed pauses between them,
 * creating little narrative moments that make agents feel more alive.
 */

export interface PhraseChain {
	readonly id: string;
	readonly trigger: "idle" | "working" | "thinking" | "break" | "any";
	readonly weight: number;
	readonly steps: readonly { text: string; delayMs: number; kind: "thought" | "speech" }[];
}

export const PHRASE_CHAINS: readonly PhraseChain[] = [
	// --- Working chains ---
	{
		id: "working-what-if",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Hmm, what if...", delayMs: 3000, kind: "thought" },
			{ text: "No wait, that won't work", delayMs: 3000, kind: "thought" },
			{ text: "Actually... maybe it will", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-typo-debug",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Okay let me trace this...", delayMs: 4000, kind: "thought" },
			{ text: "Wait. WAIT.", delayMs: 2000, kind: "thought" },
			{ text: "It was a typo. OF COURSE it was a typo", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-almost-there",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "Almost there...", delayMs: 3000, kind: "thought" },
			{ text: "One more test...", delayMs: 2000, kind: "thought" },
			{ text: "YES. Green!", delayMs: 0, kind: "speech" },
		],
	},
	{
		id: "working-stack-overflow",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Let me just check one thing online...", delayMs: 4000, kind: "thought" },
			{ text: "Okay that answer is from 2014 but it has 847 upvotes", delayMs: 3000, kind: "thought" },
			{ text: "It worked. I'm not proud but it worked", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-refactor-spiral",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "I'll just clean up this one function real quick", delayMs: 4000, kind: "thought" },
			{ text: "...and this one depends on that one so...", delayMs: 3000, kind: "thought" },
			{ text: "I've been refactoring for two hours. Send help", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-naming-struggle",
		trigger: "working",
		weight: 2,
		steps: [
			{ text: "What should I call this variable...", delayMs: 3000, kind: "thought" },
			{ text: "temp? data? thing? No, be professional", delayMs: 3000, kind: "thought" },
			{ text: "processedItemResultFinal2. Nailed it", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-pr-review",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Reviewing this PR...", delayMs: 3000, kind: "thought" },
			{ text: "Oh. Oh no. They nested five ternaries", delayMs: 2000, kind: "thought" },
			{ text: "I'm going to need a bigger comment box", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "working-git-history",
		trigger: "working",
		weight: 1,
		steps: [
			{ text: "Who wrote this?", delayMs: 3000, kind: "thought" },
			{ text: "git blame says...", delayMs: 2000, kind: "thought" },
			{ text: "Oh. It was me. Six months ago. Wonderful", delayMs: 0, kind: "thought" },
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
			{ text: "I need a whiteboard. And probably a nap", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-shower-thought",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "You know what the real problem is?", delayMs: 3000, kind: "thought" },
			{ text: "We're solving the wrong problem entirely", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-complexity",
		trigger: "thinking",
		weight: 1,
		steps: [
			{ text: "Simple solution: 30 minutes", delayMs: 3000, kind: "thought" },
			{ text: "Proper solution: 3 days", delayMs: 3000, kind: "thought" },
			{ text: "We both know which one I'm picking. And regretting later", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "thinking-rubber-duck",
		trigger: "thinking",
		weight: 2,
		steps: [
			{ text: "Okay rubber duck, here's the situation...", delayMs: 3000, kind: "thought" },
			{ text: "And then the user clicks... oh", delayMs: 2000, kind: "thought" },
			{ text: "I just solved it by explaining it. Classic", delayMs: 0, kind: "thought" },
		],
	},

	// --- Idle chains ---
	{
		id: "idle-productive",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "I should do something productive", delayMs: 3000, kind: "thought" },
			{ text: "Like organize my desk", delayMs: 3000, kind: "thought" },
			{ text: "Tomorrow. Definitely tomorrow", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-existential",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "What if all code is just... organized electricity?", delayMs: 3000, kind: "thought" },
			{ text: "And we're just electricity organizers?", delayMs: 3000, kind: "thought" },
			{ text: "I need more caffeine", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-notification-check",
		trigger: "idle",
		weight: 2,
		steps: [
			{ text: "Let me check my notifications...", delayMs: 3000, kind: "thought" },
			{ text: "247 unread. 243 of them are bot messages", delayMs: 2000, kind: "thought" },
			{ text: "I'm going to mark all as read and pretend I processed them", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-side-project",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "I have this idea for a side project...", delayMs: 3000, kind: "thought" },
			{ text: "It'll only take a weekend", delayMs: 2000, kind: "thought" },
			{ text: "Famous last words. Every single time", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "idle-keyboard-sounds",
		trigger: "idle",
		weight: 1,
		steps: [
			{ text: "Maybe I should get a mechanical keyboard", delayMs: 3000, kind: "thought" },
			{ text: "Cherry MX Browns? Blues? Reds?", delayMs: 3000, kind: "thought" },
			{ text: "My coworkers would actually murder me if I got Blues", delayMs: 0, kind: "thought" },
		],
	},

	// --- Break chains ---
	{
		id: "break-stretching",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Stretching...", delayMs: 2000, kind: "thought" },
			{ text: "Oh that's better", delayMs: 2000, kind: "speech" },
			{ text: "My spine says thank you", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-coffee-quest",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Coffee run", delayMs: 3000, kind: "thought" },
			{ text: "The good machine is taken. Of course it is", delayMs: 3000, kind: "thought" },
			{ text: "Vending machine coffee it is. Desperate times", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-window-stare",
		trigger: "break",
		weight: 2,
		steps: [
			{ text: "Looking out the window for a bit...", delayMs: 3000, kind: "thought" },
			{ text: "Oh right, weather exists. And sunlight", delayMs: 2000, kind: "thought" },
			{ text: "I should go outside more. After this sprint", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-snack-debate",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Healthy snack or junk food?", delayMs: 3000, kind: "thought" },
			{ text: "I had fruit yesterday so technically I'm ahead", delayMs: 2000, kind: "thought" },
			{ text: "Chips it is", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "break-posture-check",
		trigger: "break",
		weight: 1,
		steps: [
			{ text: "Posture check...", delayMs: 2000, kind: "thought" },
			{ text: "I was sitting like a pretzel. How long was I like that?", delayMs: 0, kind: "thought" },
		],
	},

	// --- Any chains ---
	{
		id: "any-imposter",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "Everyone else seems to know what they're doing", delayMs: 3000, kind: "thought" },
			{ text: "Wait, they probably think the same thing", delayMs: 3000, kind: "thought" },
			{ text: "We're all just winging it. That's oddly comforting", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-meeting-recovery",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "That meeting could have been an email", delayMs: 3000, kind: "thought" },
			{ text: "Actually, it could have been a Slack message", delayMs: 2000, kind: "thought" },
			{ text: "Actually, it could have just... not happened", delayMs: 0, kind: "thought" },
		],
	},
	{
		id: "any-time-perception",
		trigger: "any",
		weight: 1,
		steps: [
			{ text: "What time is it?", delayMs: 2000, kind: "thought" },
			{ text: "HOW is it already 4pm?!", delayMs: 0, kind: "speech" },
		],
	},
	{
		id: "any-deploy-prayer",
		trigger: "any",
		weight: 2,
		steps: [
			{ text: "Deploying...", delayMs: 4000, kind: "thought" },
			{ text: "Please work please work please work", delayMs: 3000, kind: "thought" },
			{ text: "It's up. Nothing is on fire. We celebrate", delayMs: 0, kind: "speech" },
		],
	},
];
