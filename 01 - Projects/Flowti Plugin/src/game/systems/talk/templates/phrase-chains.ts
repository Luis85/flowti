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
