/**
 * running-jokes.ts — Escalating running jokes for the agent world.
 *
 * Each joke has 3–5 variants that escalate with repetition: the first encounter
 * plays it straight, subsequent encounters grow increasingly self-aware, and the
 * final variant fully breaks the fourth wall — characters acknowledge the bit.
 */

import type { RunningJoke } from "../conversation-types.js";
import { RUNNING_JOKES_EXTRA } from "./running-jokes-extra.js";

const RUNNING_JOKES_CORE: readonly RunningJoke[] = [
	// ── 1. Tabs vs Spaces ───────────────────────────────────────────────
	{
		id: "joke:tabs-vs-spaces",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 90000,
		tags: ["running-joke", "tech", "debate"],
		maxEscalation: 4,
		callbackChance: 0.12,
		callbackLines: [
			"*glances at your indentation* Noted.",
			"I'm saying nothing. I'm saying absolutely nothing.",
			"This conversation will not end well for one of us.",
		],
		variants: [
			// variant 0 — genuine first debate
			[
				{ speaker: "A", text: "Tabs. Final answer. Every time.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Spaces. Consistent rendering across every editor.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "Tabs are a single character. Spaces are padding crimes.", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "And yet — your PR diff looks like a checkerboard.", delayMs: 1800, kind: "speech" },
				{ speaker: "A", text: "...", delayMs: 1200, kind: "thought" },
			],
			// variant 1 — resigned ritual
			[
				{ speaker: "A", text: "Tabs.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Spaces.", delayMs: 800, kind: "speech" },
				{ speaker: "A", text: "We're doing this again.", delayMs: 600, kind: "thought" },
				{ speaker: "B", text: "Apparently.", delayMs: 600, kind: "thought" },
				{ speaker: "A", text: "Tabs.", delayMs: 1000, kind: "speech" },
				{ speaker: "B", text: "Spaces.", delayMs: 800, kind: "speech" },
			],
			// variant 2 — one holds up a sign
			[
				{ speaker: "A", text: "Don't say it.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "...", delayMs: 800, kind: "thought" },
				{ speaker: "B", text: "*holds up a handwritten sign that reads SPACES*", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "I KNEW you had that ready.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I've had it ready for weeks.", delayMs: 1000, kind: "speech" },
			],
			// variant 3 — fully meta acknowledgement
			[
				{ speaker: "A", text: "You know what, let's just skip to the sign.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "*produces sign without hesitation*", delayMs: 600, kind: "speech" },
				{ speaker: "A", text: "*produces counter-sign: TABS WITH LOVE*", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "This is who we are now.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "This is who we are now.", delayMs: 600, kind: "speech" },
			],
		],
	},

	// ── 2. Unfinished Story ─────────────────────────────────────────────
	{
		id: "joke:unfinished-story",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 75000,
		tags: ["running-joke", "social", "narrative"],
		maxEscalation: 4,
		callbackChance: 0.10,
		callbackLines: [
			"Three hats. The dog had THREE hats. And you never explained why.",
			"Still waiting on the ending, just so you know.",
			"You never did finish that story. The dog, the vest, the market...",
		],
		variants: [
			// variant 0 — first interruption
			[
				{ speaker: "A", text: "Okay so you won't believe this — last weekend I was—", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Oh! Did you see the deploy went green?", delayMs: 2000, kind: "speech" },
				{ speaker: "A", text: "Yeah — anyway, so I was at the market and—", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "Sorry, my build just failed, hold that thought!", delayMs: 2500, kind: "speech" },
				{ speaker: "A", text: "*stares into distance*", delayMs: 1000, kind: "thought" },
			],
			// variant 1 — second attempt, still interrupted
			[
				{ speaker: "A", text: "Okay I'm going to finish my story from yesterday.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Go ahead, I'm listening.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "So I was at the market, and there was this—", delayMs: 1800, kind: "speech" },
				{ speaker: "B", text: "WAIT — is that the new Copilot update?", delayMs: 2200, kind: "speech" },
				{ speaker: "A", text: "...", delayMs: 800, kind: "thought" },
			],
			// variant 2 — finishing attempt, nobody listening
			[
				{ speaker: "A", text: "THE MARKET. The story. Right now. Pay attention.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Yes. Fully here. Story time.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "There was a dog wearing a tiny vest, and he was selling— ...", delayMs: 2500, kind: "speech" },
				{ speaker: "A", text: "Are you asleep.", delayMs: 2000, kind: "question" },
				{ speaker: "B", text: "*snaps awake* Vest! Dog! Selling! Yes!", delayMs: 1200, kind: "speech" },
			],
			// variant 3 — finishes to an empty room
			[
				{ speaker: "A", text: "...and that's why the dog had three hats. The end.", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "*looks around*", delayMs: 1000, kind: "thought" },
				{ speaker: "A", text: "Nobody's here.", delayMs: 800, kind: "thought" },
				{ speaker: "A", text: "I finished the story and nobody's here.", delayMs: 1000, kind: "thought" },
			],
		],
	},

	// ── 3. Pet vs Cursor/Chair ──────────────────────────────────────────
	{
		id: "joke:pets-nemesis",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 80000,
		tags: ["running-joke", "pet", "conflict"],
		maxEscalation: 4,
		callbackChance: 0.08,
		callbackLines: [
			"Your cat is eyeing my chair again.",
			"The truce is holding — for now.",
			"*makes eye contact with the cat* We both know.",
		],
		variants: [
			// variant 0 — initial conflict
			[
				{ speaker: "A", text: "Your pet just knocked my cursor off the desk.", delayMs: 0, kind: "speech" },
				{ speaker: "pet", text: "*stares at {agentA}*", delayMs: 1200, kind: "thought" },
				{ speaker: "B", text: "That's strange, she usually ignores electronics.", delayMs: 2000, kind: "speech" },
				{ speaker: "A", text: "She didn't ignore it. She made deliberate eye contact first.", delayMs: 1800, kind: "speech" },
			],
			// variant 1 — avoidance and escalation
			[
				{ speaker: "A", text: "I moved my cursor to the other side of the desk.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "And?", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "She moved her nap spot to match.", delayMs: 1200, kind: "speech" },
				{ speaker: "pet", text: "*is unmoved by this conversation*", delayMs: 1500, kind: "thought" },
			],
			// variant 2 — uneasy peace
			[
				{ speaker: "A", text: "We've reached an agreement.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "You and {petName}?", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "I keep the cursor on the mat. She doesn't knock it over.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "A diplomatic breakthrough.", delayMs: 1000, kind: "speech" },
				{ speaker: "pet", text: "*watches with narrowed eyes*", delayMs: 1200, kind: "thought" },
			],
			// variant 3 — re-declared war
			[
				{ speaker: "A", text: "She knocked it over again.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "The truce...", delayMs: 800, kind: "thought" },
				{ speaker: "A", text: "The truce is over.", delayMs: 800, kind: "speech" },
				{ speaker: "pet", text: "*sits on the mat*", delayMs: 1500, kind: "thought" },
				{ speaker: "A", text: "She's sitting on the mat. That's — that's the agreed neutral zone.", delayMs: 1800, kind: "speech" },
				{ speaker: "B", text: "Maybe she wants to renegotiate.", delayMs: 1200, kind: "speech" },
			],
		],
	},

	// ── 4. Third-Person Narrator ────────────────────────────────────────
	{
		id: "joke:third-person-narrator",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 100000,
		tags: ["running-joke", "social", "meta"],
		maxEscalation: 4,
		callbackChance: 0.09,
		callbackLines: [
			"*narrates quietly to themselves*",
			"..and then {agentA} said something completely normal.",
			"The narrator was not available for comment.",
		],
		variants: [
			// variant 0 — caught narrating alone
			[
				{ speaker: "A", text: "...and {agentA} gazed out at the horizon, wondering if anyone would ever truly understand—", delayMs: 0, kind: "thought" },
				{ speaker: "B", text: "Are you... narrating yourself?", delayMs: 2500, kind: "speech" },
				{ speaker: "A", text: "{agentA} was suddenly, acutely, aware of {agentB}'s presence.", delayMs: 1500, kind: "thought" },
				{ speaker: "B", text: "Please stop.", delayMs: 1000, kind: "speech" },
			],
			// variant 1 — keeps doing it under pressure
			[
				{ speaker: "A", text: "{agentA} approached the task with characteristic focus.", delayMs: 0, kind: "thought" },
				{ speaker: "B", text: "We talked about this.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "{agentA} acknowledged the feedback but did not, in fact, stop.", delayMs: 1500, kind: "thought" },
				{ speaker: "B", text: "I can hear you doing it.", delayMs: 1000, kind: "speech" },
			],
			// variant 2 — recruits an accomplice
			[
				{ speaker: "A", text: "Hey, will you narrate me for a while? I need a break.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "What? No.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "Just the highlights.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "...", delayMs: 800, kind: "thought" },
				{ speaker: "B", text: "{agentA} waited, their expression a complex tapestry of hope.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "PERFECT. Do not stop.", delayMs: 1000, kind: "speech" },
			],
			// variant 3 — fully meta, both narrating
			[
				{ speaker: "A", text: "The two agents stood in comfortable silence—", delayMs: 0, kind: "thought" },
				{ speaker: "B", text: "—neither willing to admit they had become what they once mocked.", delayMs: 1800, kind: "thought" },
				{ speaker: "A", text: "Wait, are you narrating too?", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "{agentA} asked, surprised.", delayMs: 1000, kind: "thought" },
				{ speaker: "A", text: "{agentB} deflected with a question of their own.", delayMs: 1000, kind: "thought" },
				{ speaker: "B", text: "This is fine.", delayMs: 800, kind: "speech" },
			],
		],
	},

	// ── 5. Cursed Variable ──────────────────────────────────────────────
	{
		id: "joke:cursed-variable",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 70000,
		tags: ["running-joke", "tech", "cursed"],
		maxEscalation: 3,
		callbackChance: 0.15,
		callbackLines: [
			"x7 strikes again.",
			"I see x7 has made an appearance.",
			"Don't name it x7. I beg you.",
		],
		variants: [
			// variant 0 — first sighting
			[
				{ speaker: "A", text: "Why is this variable called x7?", delayMs: 0, kind: "question" },
				{ speaker: "B", text: "I have no idea. It's been there since the beginning.", delayMs: 1800, kind: "speech" },
				{ speaker: "A", text: "What does it do?", delayMs: 1200, kind: "question" },
				{ speaker: "B", text: "We don't rename x7.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "I'll just refactor it quickly—", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "Do NOT touch x7.", delayMs: 800, kind: "speech" },
			],
			// variant 1 — x7 spreads
			[
				{ speaker: "A", text: "I may have accidentally named something else x7.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "HOW.", delayMs: 800, kind: "speech" },
				{ speaker: "A", text: "My fingers just — it felt right in the moment.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "It spreads. It's spreading.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "The codebase calls to me.", delayMs: 1000, kind: "thought" },
			],
			// variant 2 — becomes team meme
			[
				{ speaker: "A", text: "I've started naming all my throwaway vars x7.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "It's a lifestyle now.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "It's a lifestyle now.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "x7 would be proud.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "x7 IS proud.", delayMs: 800, kind: "thought" },
			],
		],
	},

	// ── 6. Perfect Commit Message ───────────────────────────────────────
	{
		id: "joke:perfect-commit",
		tierRange: ["acquaintance", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 65000,
		tags: ["running-joke", "tech", "perfectionism"],
		maxEscalation: 3,
		callbackChance: 0.10,
		callbackLines: [
			"How's the commit message coming?",
			"I saw a 'fix stuff' in the log. I'm not saying it was yours but...",
			"The post-mortem team sends their regards.",
		],
		variants: [
			// variant 0 — agonizing over message
			[
				{ speaker: "A", text: "I've been staring at this commit message for ten minutes.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "What do you have so far?", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "'feat(auth): impl—' no. 'chore: refactor—' no. 'fix: things.'", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "Just write 'fix stuff' and move on.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "I will NOT.", delayMs: 1000, kind: "speech" },
			],
			// variant 1 — ships 'fix stuff'
			[
				{ speaker: "A", text: "I pushed it.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "What did you go with?", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "'fix stuff'.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "...", delayMs: 600, kind: "thought" },
				{ speaker: "A", text: "I ran out of will to live at 11:47pm.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "Understandable. Git blame will remember.", delayMs: 1500, kind: "speech" },
			],
			// variant 2 — deep regret
			[
				{ speaker: "A", text: "Someone cited my 'fix stuff' commit in a post-mortem.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "No.", delayMs: 800, kind: "speech" },
				{ speaker: "A", text: "Commit hash and everything. Projected on a screen.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "This is your legacy.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "I have to live with this.", delayMs: 1000, kind: "thought" },
			],
		],
	},

	// ── 7. Coffee Machine Rivalry ───────────────────────────────────────
	{
		id: "joke:coffee-machine-rivalry",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 2,
		cooldownMs: 60000,
		tags: ["running-joke", "social", "rivalry"],
		maxEscalation: 4,
		callbackChance: 0.12,
		callbackLines: [
			"*stands up for no reason, then sits back down* ...false alarm.",
			"I heard footsteps — I ran.",
			"Don't look at me like that. You know what this is about.",
		],
		variants: [
			// variant 0 — first race
			[
				{ speaker: "A", text: "Are you — are you going to the coffee machine?", delayMs: 0, kind: "question" },
				{ speaker: "B", text: "The good one? Yes.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "I was going to the good one.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "Then we have a problem.", delayMs: 1000, kind: "speech" },
			],
			// variant 1 — A develops countermeasures
			[
				{ speaker: "A", text: "I've started pre-making coffee at 9:02 before you even think about it.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "I switched to 8:58.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "You can't just move the goalposts.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I didn't move them. I arrived before them.", delayMs: 1000, kind: "speech" },
			],
			// variant 2 — REVERSAL: A catches themselves becoming what they mocked
			[
				{ speaker: "A", text: "I just — I just sprinted to the machine.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "I know. I watched.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "I used to judge people who did that.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "Welcome to my world. How does it feel?", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "The coffee is excellent.", delayMs: 1000, kind: "speech" },
			],
			// variant 3 — B has given up, A feels empty
			[
				{ speaker: "B", text: "I bought a French press. For my desk. The race is over.", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "You... what?", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "I don't need the good machine anymore.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "But I — then who am I racing?", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "Yourself, apparently.", delayMs: 1200, kind: "speech" },
			],
		],
	},

	// ── 8. Deploy Ritual ────────────────────────────────────────────────
	{
		id: "joke:deploy-ritual",
		tierRange: ["colleague", "best-friend"],
		trigger: "proximity",
		weight: 1,
		cooldownMs: 90000,
		tags: ["running-joke", "tech", "superstition"],
		maxEscalation: 3,
		callbackChance: 0.10,
		callbackLines: [
			"I saw someone new tapping the rack. It's spreading.",
			"The deploy gods demand respect.",
			"*taps desk twice* What? It's unrelated.",
		],
		variants: [
			// variant 0 — first superstition
			[
				{ speaker: "A", text: "I always turn my monitor off and on before a deploy.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "That does literally nothing.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "We've had zero major outages since I started doing it.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "That's correlation, not—", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "Zero outages.", delayMs: 800, kind: "speech" },
			],
			// variant 1 — CONTAGION: B has been infected
			[
				{ speaker: "B", text: "I tapped the rack before the deploy today.", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "YOU tapped the rack?", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I didn't plan to. My hand just — it felt right.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "It IS right. The rack has good energy.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I can't believe I'm saying this but... the deploy went perfectly.", delayMs: 1800, kind: "speech" },
			],
			// variant 2 — CONTAGION: it's spread to people they don't know
			[
				{ speaker: "A", text: "Someone from the other team asked me about the rack tapping.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "It's spreading?", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "They said they saw us and started doing it too. Their deploys have been clean for two weeks.", delayMs: 2000, kind: "speech" },
				{ speaker: "B", text: "We've created a religion.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "We've created infrastructure stability.", delayMs: 1200, kind: "speech" },
			],
		],
	},
];

export const RUNNING_JOKES: readonly RunningJoke[] = [...RUNNING_JOKES_CORE, ...RUNNING_JOKES_EXTRA];
