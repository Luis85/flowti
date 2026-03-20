/**
 * quirk-definitions.ts — 15 agent quirks with attribute filters, overrides, and phrase pools.
 */

export interface QuirkOverrides {
	readonly socialRadiusMultiplier?: number;
	readonly idleResistanceMultiplier?: number;
	readonly moveSpeedMultiplier?: number;
	readonly coffeeAttractionMultiplier?: number;
	readonly conversationRateMultiplier?: number;
}

export interface QuirkDefinition {
	readonly id: string;
	readonly label: string;
	readonly filter: (attrs: Record<string, number>, domain: string) => boolean;
	readonly overrides: QuirkOverrides;
	readonly phrases: readonly string[];
}

export const QUIRK_DEFINITIONS: readonly QuirkDefinition[] = [
	{
		id: "pacer", label: "Pacer",
		filter: (a) => (a.dex ?? 0) > 13,
		overrides: { moveSpeedMultiplier: 1.2 },
		phrases: [
			"Can't sit still when I'm thinking",
			"Pacing helps me process",
			"Walking loop number... I've lost count",
			"My step counter loves me",
			"Ideas flow better when my feet move",
			"Sorry, I pace when I'm excited about a problem",
			"Left wall, right wall, left wall... solution!",
			"I wore a track in the carpet and I'm not sorry",
			"Sitting is for people who already have the answer",
			"My best ideas happen between step 200 and 300",
			"If I stop moving, the thought disappears",
			"Hold on, let me do another lap before I respond",
			"They should put a treadmill in the meeting room",
			"I think in footsteps, not bullet points",
		],
	},
	{
		id: "doodler", label: "Doodler",
		filter: (a, d) => (a.cha ?? 0) > 12 && (d === "design" || d === "product"),
		overrides: {},
		phrases: [
			"Let me sketch this out",
			"Doodles are just ideas in disguise",
			"My whiteboard time is sacred",
			"Drawing helps me think",
			"Another masterpiece on the whiteboard",
			"Wait, let me draw it — words won't do this justice",
			"I see architecture in spirals and boxes",
			"That meeting was productive — look at these margin doodles",
			"If I can't draw it, I don't understand it yet",
			"My notebook is 80% sketches, 20% actual notes",
			"Tiny cubes when I'm bored, flowcharts when I'm focused",
			"The whiteboard marker is mightier than the keyboard",
			"Abstract shapes now, brilliant idea in five minutes",
			"I accidentally turned the standup notes into a mural",
			"Give me a blank surface and I'll give you a solution",
		],
	},
	{
		id: "coffee-addict", label: "Coffee Addict",
		filter: (a) => (a.con ?? 0) < 8,
		overrides: { coffeeAttractionMultiplier: 2.0 },
		phrases: [
			"Coffee. Now.",
			"I run on caffeine and deadlines",
			"Third cup and counting",
			"Decaf is a lie",
			"The coffee machine is my best friend",
			"Just one more cup",
			"I don't have a problem, I have a solution — it's coffee",
			"Don't talk to me until I've had my flat white",
			"Cup number four and I can finally see the code",
			"Tea? We don't do that here",
			"I can hear the coffee machine from three rooms away",
			"My blood type is espresso",
			"The best debugging tool is a fresh pour-over",
			"Somebody emptied the pot and didn't refill it. Unforgivable",
			"I keep a backup mug in my drawer. Trust issues",
		],
	},
	{
		id: "early-bird", label: "Early Bird",
		filter: (a) => (a.wis ?? 0) > 14,
		overrides: {},
		phrases: [
			"First one in, best parking spot",
			"Morning is my superpower",
			"Love the quiet before everyone arrives",
			"Early start, early finish",
			"The dawn shift hits different",
			"Got three things done before anyone else logged on",
			"Sunrise from the office window — never gets old",
			"I don't set alarms, I just wake up ready",
			"The 6am commit is the purest commit",
			"Morning people don't brag. Okay, we brag a little",
			"By the time you're having coffee, I'm having lunch",
			"The empty office at 7am is my cathedral",
			"Everyone asks how I do it. The secret is going to bed at 9",
			"I love greeting people as they trickle in at ten",
		],
	},
	{
		id: "night-owl", label: "Night Owl",
		filter: (a) => (a.int ?? 0) > 14,
		overrides: {},
		phrases: [
			"Just getting warmed up",
			"The best code is written after dark",
			"Everyone's leaving already?",
			"Quiet office, peak productivity",
			"Night shift energy",
			"One more function and I'll go home. Probably",
			"Midnight commits hit different",
			"The building is empty and I've never been more focused",
			"Morning people will never understand second wind",
			"Stars are out, bugs are getting squashed",
			"I peak when the sun sets. I am what I am",
			"Left at 2am, back by 11. It's called balance",
			"The cleaning crew and I are on a first-name basis",
			"Dark mode isn't just for my editor, it's a lifestyle",
		],
	},
	{
		id: "neat-freak", label: "Neat Freak",
		filter: (a, d) => (a.wis ?? 0) > 12 && d === "quality",
		overrides: {},
		phrases: [
			"This desk needs organizing",
			"Everything in its place",
			"A clean workspace is a clean mind",
			"Who left this mess?",
			"Tidying up before I can focus",
			"Aligned my monitors to the pixel. Worth it",
			"That whiteboard has three-day-old notes on it. Erasing now",
			"Messy desk, messy code. I said what I said",
			"I labeled the label maker. No regrets",
			"Clean code, clean desk, clean conscience",
			"I reorganized the shared drive. You're welcome",
			"Cables should never touch the floor. Ever",
			"If your pen cup isn't sorted by color, are you even trying?",
			"I get the same satisfaction from a tidy repo and a tidy drawer",
			"Someone moved my stapler and I will find out who",
		],
	},
	{
		id: "fidgeter", label: "Fidgeter",
		filter: (a) => (a.dex ?? 0) > 14 && (a.con ?? 0) < 10,
		overrides: { idleResistanceMultiplier: 0.6 },
		phrases: [
			"Can't. Stay. Still.",
			"Restless energy today",
			"My leg has a mind of its own",
			"Fidgeting is thinking in motion",
			"Sorry, just restless",
			"I've been clicking this pen for 20 minutes. Nobody's stopped me",
			"Spinning in the chair helps me think. Definitely",
			"If I stop bouncing my leg, I stop having ideas",
			"Sorry about the pen clicking — I genuinely can't help it",
			"My hands need something to do or my brain shuts off",
			"I channel the restless energy into keystrokes. Mostly",
			"Sat still for three minutes. New personal record",
			"The stress ball didn't survive the sprint. RIP",
			"Every meeting I attend sounds like a percussion solo",
		],
	},
	{
		id: "snacker", label: "Snacker",
		filter: () => true,
		overrides: {},
		phrases: [
			"Snack break!",
			"Is it too early for snacks? Never",
			"Thinking is hungry work",
			"The snack table is calling me",
			"Brain food is still food",
			"I have a drawer. The drawer has layers. Each layer is snacks",
			"Almonds for focus, gummy bears for celebration",
			"Want some? I always bring extra",
			"Elevenses, second lunch, afternoon nibble — it's a schedule",
			"My best code review comments happen mid-crunch",
			"I budget for snacks the way others budget for tools",
			"If there are donuts in the kitchen, I already know",
			"The vending machine and I have a standing appointment",
			"Crunchy snacks for hard problems, chewy snacks for design work",
		],
	},
	{
		id: "social-butterfly", label: "Social Butterfly",
		filter: (a) => (a.cha ?? 0) > 15,
		overrides: { socialRadiusMultiplier: 1.5, conversationRateMultiplier: 2.0 },
		phrases: [
			"Hey, what's everyone up to?",
			"Let's chat!",
			"I know everyone here",
			"Networking is just making friends",
			"The more the merrier",
			"Who wants to grab coffee?",
			"Oh you haven't met? Let me introduce you two",
			"I heard the most interesting thing at lunch today",
			"Planning the team outing — who's in?",
			"I remembered your birthday. And your dog's birthday",
			"Nobody eats lunch alone on my watch",
			"Quick hallway chat turned into a 30-minute brainstorm. Love that",
			"I know what every team is working on. It just comes up naturally",
			"Wholesome gossip only: did you hear about the new hire's cool hobby?",
		],
	},
	{
		id: "hermit", label: "Hermit",
		filter: (a) => (a.cha ?? 0) < 7,
		overrides: { socialRadiusMultiplier: 0.7, conversationRateMultiplier: 0.5 },
		phrases: [
			"Need some space",
			"Headphones on means leave me alone",
			"Quiet corner, please",
			"Socializing is exhausting",
			"Alone time is productive time",
			"Found the perfect empty meeting room. Not sharing the location",
			"I already socialized today. That was the standup",
			"Recharging my people battery — check back in an hour",
			"Two conversations in a row? That's my weekly limit",
			"I'm not antisocial, I'm selectively social",
			"The best pair programming partner is no partner",
			"If I could Slack from a cave, I would",
			"Love my team. From a comfortable distance",
			"Do not disturb means do not disturb",
		],
	},
	{
		id: "rubber-ducker", label: "Rubber Ducker",
		filter: (a, d) => (a.int ?? 0) > 12 && d === "engineering",
		overrides: {},
		phrases: [
			"Okay, let me explain this to myself",
			"So the problem is... wait, I get it now",
			"Talking it through... almost there",
			"Dear rubber duck, consider the following",
			"If I explain it out loud, I'll find the bug",
			"So the function takes a — oh. OH. That's the bug",
			"I was two sentences into explaining it and the answer appeared",
			"Shh, I'm having a conversation with nobody. It's working",
			"You see, the state flows from — never mind, fixed it",
			"My debugging process is 90% monologue, 10% typing",
			"I need to say the wrong thing out loud before I see the right thing",
			"And then it passes the object to — wait, it doesn't. Found it",
			"The duck doesn't judge. The duck just listens",
			"Explaining code to the void is a legitimate engineering practice",
		],
	},
	{
		id: "music-lover", label: "Music Lover",
		filter: () => true,
		overrides: {},
		phrases: [
			"This playlist is fire",
			"Music makes the code flow",
			"Need new song recommendations",
			"Headphones are my productivity tool",
			"The right beat for the right task",
			"Lo-fi for refactoring, metal for debugging",
			"I curated a 7-hour focus playlist. It's a masterpiece",
			"Was I drumming on the desk again? Sorry. Not sorry",
			"I match the BPM to the build time",
			"Caught myself humming in the standup. Nobody mentioned it. Respect",
			"The drop hit right when the tests went green. Perfection",
			"My commit messages would make great song titles",
			"I have a playlist called 'Deploy Day Anthems'. It slaps",
			"If the music stops, the code stops. Those are the rules",
		],
	},
	{
		id: "plant-parent", label: "Plant Parent",
		filter: () => true,
		overrides: {},
		phrases: [
			"How's my little green friend today?",
			"Plants make everything better",
			"Time to check on my desk plant",
			"Growing code and growing plants",
			"This one's looking healthy",
			"I named the fern Gerald. We're close",
			"Wednesday is watering day. No exceptions",
			"New leaf! That's better than a passing test suite",
			"I talk to my plant during code reviews. Gerald is a good listener",
			"Nurturing a codebase and nurturing a succulent are the same skill",
			"Someone put their coffee cup near Gerald. We had words",
			"I moved the plant closer to the window. Growth optimization",
			"Gerald survived the weekend. Relief is an understatement",
			"My plant is thriving. My code is thriving. Coincidence? No",
		],
	},
	{
		id: "whiteboard-warrior", label: "Whiteboard Warrior",
		filter: (a, d) => (a.cha ?? 0) > 12 && (d === "management" || d === "orchestration"),
		overrides: {},
		phrases: [
			"To the whiteboard!",
			"Let me draw this out for everyone",
			"Whiteboard sessions are my cardio",
			"The diagram will make it clear",
			"This calls for a visual",
			"Blue for architecture, red for risk, green for go. System",
			"Whoever erased my diagram owes me 45 minutes",
			"Digital boards are fine. But the marker squeaks and that's half the magic",
			"I drew a perfect box on the first try. Career highlight",
			"The flowchart has 14 nodes now. It started as 'a quick sketch'",
			"Every problem is one diagram away from being solved",
			"I go through two markers a week. Worth every cent",
			"Step back, squint at the board, nod slowly. That's the process",
			"If it's not on the whiteboard, did we really discuss it?",
		],
	},
	{
		id: "stretcher", label: "Stretcher",
		filter: (a) => (a.con ?? 0) > 12,
		overrides: {},
		phrases: [
			"Time to stretch",
			"My back will thank me later",
			"Stand up, stretch, sit back down",
			"Ergonomics are self-care",
			"Quick stretch break",
			"That shoulder roll? Chef's kiss. I needed that",
			"You've been sitting for two hours. Don't make me come over there",
			"I set a 45-minute stretch timer. It's the law",
			"My neck just made a sound and I'm choosing to ignore it",
			"Touch your toes. Just try. I'll wait",
			"I have opinions about monitor height and I'm not afraid to share them",
			"One good hamstring stretch and I'm a new person",
			"Invited the whole team to desk yoga. Two people came. Progress",
			"My chiropractor says I'm their favorite patient. That's not a compliment",
		],
	},
];

/** Random assignment probabilities for always-eligible quirks. */
const RANDOM_QUIRK_CHANCE: Record<string, number> = {
	snacker: 0.20,
	"music-lover": 0.25,
	"plant-parent": 0.15,
};

/** Get quirks an agent qualifies for based on attributes and domain. */
export function getEligibleQuirks(attrs: Record<string, number>, domain: string): QuirkDefinition[] {
	return QUIRK_DEFINITIONS.filter((q) => q.filter(attrs, domain));
}

/** Roll quirks for an agent. Returns 2-3 quirk IDs. */
export function rollQuirks(attrs: Record<string, number>, domain: string): string[] {
	const eligible = getEligibleQuirks(attrs, domain);
	const gated = eligible.filter((q) => !RANDOM_QUIRK_CHANCE[q.id]);
	const random = eligible.filter((q) => RANDOM_QUIRK_CHANCE[q.id]);

	const picked: string[] = [];

	// Pick 1-2 from attribute-gated (if available)
	const shuffledGated = [...gated].sort(() => Math.random() - 0.5);
	for (const q of shuffledGated) {
		if (picked.length >= 2) break;
		picked.push(q.id);
	}

	// Roll random quirks
	for (const q of random) {
		if (picked.length >= 3) break;
		if (Math.random() < (RANDOM_QUIRK_CHANCE[q.id] ?? 0)) {
			picked.push(q.id);
		}
	}

	// Ensure at least 2
	if (picked.length < 2) {
		const remaining = eligible.filter((q) => !picked.includes(q.id));
		const shuffled = [...remaining].sort(() => Math.random() - 0.5);
		for (const q of shuffled) {
			if (picked.length >= 2) break;
			picked.push(q.id);
		}
	}

	return picked.slice(0, 3);
}
