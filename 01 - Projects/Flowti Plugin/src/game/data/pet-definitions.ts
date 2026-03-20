/**
 * pet-definitions.ts — Office pet type definitions and behavior parameters.
 */

export interface PetDefinition {
	readonly type: string;
	readonly label: string;
	readonly spriteCharacter: string;  // Ninja Adventure character name for sprite loading
	readonly scale: number;            // display scale (smaller than agents)
	readonly speed: number;            // movement speed multiplier
	readonly behaviors: {
		readonly sleepChance: number;      // per-second chance to start sleeping
		readonly wanderRadius: number;     // how far from home position
		readonly followChance: number;     // per-second chance to follow nearest agent
		readonly interactRadius: number;   // how close to trigger agent reaction
		readonly needsEffect: Partial<{ energy: number; social: number; focus: number; morale: number }>;
	};
	readonly phrases: readonly string[];  // what agents say when they notice the pet
}

export const PET_DEFINITIONS: readonly PetDefinition[] = [
	{
		type: "cat",
		label: "Office Cat",
		spriteCharacter: "LionBoy",
		scale: 0.6,
		speed: 0.4,
		behaviors: {
			sleepChance: 0.008,
			wanderRadius: 120,
			followChance: 0.001,
			interactRadius: 50,
			needsEffect: { morale: 5, focus: -2 },
		},
		phrases: [
			"The cat's judging my code again",
			"Did the cat just walk across my keyboard?",
			"Excuse me, that's my chair",
			"The cat has claimed the warmest spot in the office",
			"I swear the cat understands our standups",
			"Cat nap goals, honestly",
			"The cat just sat on my laptop. Meeting cancelled I guess",
			"Psspsspss... come here little one",
			"The cat approves of this code. I can tell by the purring",
			"Who brought a cat to the office? Because thank you",
			"The debugging cat has spoken. The bug is in line 42",
			"That cat has better work-life balance than any of us",
		],
	},
	{
		type: "dog",
		label: "Office Dog",
		spriteCharacter: "Lion",
		scale: 0.6,
		speed: 0.6,
		behaviors: {
			sleepChance: 0.003,
			wanderRadius: 180,
			followChance: 0.005,
			interactRadius: 60,
			needsEffect: { morale: 3, social: 2 },
		},
		phrases: [
			"Who's a good boy? WHO'S A GOOD BOY?",
			"The dog is making rounds. Morale officer on duty",
			"Tail wagging detected. Productivity increasing",
			"The dog just brought me a toy. I'm honored",
			"Best coworker. Zero opinions on my PR, maximum enthusiasm",
			"The dog doesn't care about code quality. The dog just loves us",
			"Good boy! Yes you are! Sorry, where was I?",
			"Office dog tax: 5 minutes of petting per hour",
			"The dog sensed I was stressed. Now I have a warm lap",
			"Meeting agenda: 1) Pet the dog. 2) Everything else",
			"The dog's commute is zero minutes and I'm jealous",
			"Therapy dog doing therapy. Insurance should cover this",
		],
	},
	{
		type: "bird",
		label: "Office Bird",
		spriteCharacter: "MaskFrog",
		scale: 0.5,
		speed: 0.3,
		behaviors: {
			sleepChance: 0.005,
			wanderRadius: 80,
			followChance: 0.0005,
			interactRadius: 40,
			needsEffect: { morale: 2, focus: 1 },
		},
		phrases: [
			"The bird is chirping. Nature's notification sound",
			"Little bird, big personality",
			"The bird just flew to a new perch. Room with a view",
			"Chirp chirp. Agreed, little friend",
			"The bird is the only one who sings during standup",
			"That bird has seen things. Build things",
			"Ambient bird sounds: better than any lo-fi playlist",
			"The bird is watching the code review. Harsh critic",
			"Tweet tweet. The original tweet. Before Twitter ruined it",
			"The bird understands microservices. It's all about the perch",
		],
	},
	{
		type: "fish",
		label: "Office Fish Tank",
		spriteCharacter: "",  // Canvas-drawn, no sprite
		scale: 1.0,
		speed: 0,
		behaviors: {
			sleepChance: 0,
			wanderRadius: 0,
			followChance: 0,
			interactRadius: 60,
			needsEffect: { focus: 3, morale: 1 },
		},
		phrases: [
			"Watching the fish is my debugging technique",
			"The fish don't care about deadlines. Wise",
			"I could stare at this tank for hours. And I have",
			"The fish have no opinions about tabs vs spaces. Ideal coworkers",
			"Meditation by fish tank. Very zen. Very productive",
			"Fish are basically screensavers but alive",
			"The bubbles are hypnotic. Where was I?",
			"Fun fact: the fish have never broken a build",
			"Aquarium therapy. Cheaper than actual therapy",
			"The fish tank is the most stable system in this office",
		],
	},
];

export function getPetDefinition(type: string): PetDefinition | undefined {
	return PET_DEFINITIONS.find((p) => p.type === type);
}
