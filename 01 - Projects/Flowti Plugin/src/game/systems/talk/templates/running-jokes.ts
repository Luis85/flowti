/**
 * running-jokes.ts — Escalating running jokes for the agent world.
 *
 * Each joke has 3–5 variants that escalate with repetition: the first encounter
 * plays it straight, subsequent encounters grow increasingly self-aware, and the
 * final variant fully breaks the fourth wall — characters acknowledge the bit.
 */

import type { RunningJoke } from "../conversation-types.js";

export const RUNNING_JOKES: readonly RunningJoke[] = [
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
			"And then what happened?",
			"Still waiting on the ending, just so you know.",
			"You never did finish that story.",
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
			"'fix stuff' is always available as a fallback.",
			"The commit will outlive us all. Choose wisely.",
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
			"The good machine is free. Move.",
			"I heard footsteps — I ran.",
			"It was the good machine. We both know what we did.",
		],
		variants: [
			// variant 0 — first race
			[
				{ speaker: "A", text: "Are you — are you going to the coffee machine?", delayMs: 0, kind: "question" },
				{ speaker: "B", text: "The good one? Yes.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "I was going to the good one.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "Then we have a problem.", delayMs: 1000, kind: "speech" },
			],
			// variant 1 — escalating competitive awareness
			[
				{ speaker: "A", text: "I saw you stand up. I stood up faster.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "I walked faster.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "I took the shortcut past the server rack.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I got there first.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "I'm aware.", delayMs: 800, kind: "thought" },
			],
			// variant 2 — pre-emptive strategy
			[
				{ speaker: "A", text: "I've started getting up every time you look tired.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "As a prevention strategy.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "As a prevention strategy.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "I respect it.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "I've started taking the stairs to confuse you.", delayMs: 1500, kind: "speech" },
			],
			// variant 3 — fully meta standoff
			[
				{ speaker: "A", text: "We're both standing next to our chairs. Neither of us has moved.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "First one to sit down loses the machine.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "This is what our careers have become.", delayMs: 1500, kind: "thought" },
				{ speaker: "B", text: "Mine tastes better under pressure anyway.", delayMs: 1500, kind: "speech" },
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
			"Did you do the ritual?",
			"The deploy gods demand respect.",
			"No ritual, no uptime. That's just how it works.",
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
			// variant 1 — ritual expands
			[
				{ speaker: "A", text: "I added a new step. I tap the server rack three times.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "Why three?", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "Two didn't feel right. Four was excessive.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "You understand this is fully irrational.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "The uptime speaks for itself.", delayMs: 800, kind: "speech" },
			],
			// variant 2 — whole team has adopted it
			[
				{ speaker: "A", text: "I noticed {agentB} tapped the rack before the deploy.", delayMs: 0, kind: "speech" },
				{ speaker: "B", text: "I didn't — it was an accident.", delayMs: 1200, kind: "speech" },
				{ speaker: "A", text: "Three times.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "...", delayMs: 600, kind: "thought" },
				{ speaker: "B", text: "The rack has good energy. That's all I'm saying.", delayMs: 1500, kind: "speech" },
			],
		],
	},

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
			"It was just one small addition.",
			"The ticket said 'minor tweak'. It was not minor.",
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
			"Still refactoring?",
			"The refactor will be done soon. It's always almost done.",
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
			// variant 1 — a week later
			[
				{ speaker: "B", text: "How's the refactor?", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "I found some deeply concerning structural issues while I was in there.", delayMs: 1500, kind: "speech" },
				{ speaker: "B", text: "So it's grown.", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "It's found its true scope.", delayMs: 1200, kind: "speech" },
			],
			// variant 2 — the refactor has outlived the feature
			[
				{ speaker: "B", text: "The feature you were refactoring shipped two weeks ago.", delayMs: 0, kind: "speech" },
				{ speaker: "A", text: "I know.", delayMs: 800, kind: "speech" },
				{ speaker: "B", text: "You're refactoring something that's already in production.", delayMs: 1500, kind: "speech" },
				{ speaker: "A", text: "I'm improving it retroactively.", delayMs: 1200, kind: "speech" },
				{ speaker: "B", text: "Is that something you can do?", delayMs: 1000, kind: "speech" },
				{ speaker: "A", text: "Watch me.", delayMs: 600, kind: "speech" },
			],
		],
	},
];
