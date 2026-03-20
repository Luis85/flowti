/**
 * milestone-definitions.ts — Milestone triggers and reaction templates.
 */

export interface MilestoneDefinition {
	readonly id: string;
	readonly label: string;
	readonly reactions: readonly string[];  // bubble text variants, supports {name} interpolation
}

export const MILESTONES: readonly MilestoneDefinition[] = [
	{
		id: "first-day", label: "First Day",
		reactions: [
			"New here! Taking it all in",
			"Day one. Everything is shiny and slightly terrifying",
			"I found my desk. That counts as productivity, right?",
			"Fresh start energy. Let's see how long it lasts",
		],
	},
	{
		id: "first-friend", label: "First Friend",
		reactions: [
			"I think {name} and I really click",
			"{name} gets my humor. That's rare around here",
			"Found my person in this office. It's {name}",
			"{name} and I just get each other. Instant bond",
			"Finally someone who laughs at my jokes. Thanks, {name}",
		],
	},
	{
		id: "best-friend", label: "Best Friend",
		reactions: [
			"{name} gets me. That's rare",
			"{name} is the reason I don't mind Mondays",
			"If {name} ever leaves, I'm going with them",
			"We finish each other's... pull requests. It's a {name} thing",
		],
	},
	{
		id: "first-rivalry", label: "First Rivalry",
		reactions: [
			"{name} and I disagree on everything",
			"Tabs vs spaces? {name} chose wrong. Obviously",
			"{name} pushes me to be better. I'll never admit that to their face",
			"If {name} says left, I say right. It's our thing now",
			"Respect to {name}, but they're wrong and I have a whiteboard to prove it",
		],
	},
	{
		id: "coffee-regular", label: "Coffee Regular",
		reactions: [
			"The barista knows my order. Wait, there's no barista",
			"I've memorized the exact sound the coffee machine makes when it's ready",
			"Tenth cup this week. The machine and I have an understanding",
			"I should name the coffee machine. We've been through a lot together",
		],
	},
	{
		id: "social-butterfly", label: "Social Butterfly",
		reactions: [
			"I've talked to everyone about everything",
			"No stranger left behind. That's my policy",
			"I know everyone's name, team, and coffee order. It just happens",
			"If there's a conversation happening, I will find it",
			"Connecting people is my unpaid side hustle",
		],
	},
	{
		id: "work-streak-5", label: "5-Day Streak",
		reactions: [
			"Five days strong. I'm in the zone",
			"Five in a row. The rhythm is real",
			"Haven't broken the chain in five days. Momentum is everything",
			"Day five and I'm still standing. Barely. But standing",
		],
	},
	{
		id: "work-streak-10", label: "10-Day Streak",
		reactions: [
			"Double digits. Don't jinx it",
			"Ten days of showing up. Not bad for someone who hits snooze six times",
			"Day ten. I think I've entered a flow state that has its own weather system",
			"Ten-day streak. I'm afraid to take a break now",
			"Double digits! Someone bake me a cake",
		],
	},
	{
		id: "survivor", label: "Survivor",
		reactions: [
			"I've seen things. Build things",
			"Survived the great refactor of... well, all of them",
			"Still here. Still shipping. That's the job",
			"I've outlasted three roadmaps and a complete rewrite",
		],
	},
	{
		id: "early-adopter", label: "Early Adopter",
		reactions: [
			"Been here since the early days",
			"I remember when this was just a folder and a dream",
			"OG member. The badge is invisible but I feel it",
			"Early adopter perks: stories nobody else has",
		],
	},
	{
		id: "veteran", label: "Veteran",
		reactions: [
			"I remember when this office was empty",
			"Back in my day, we deployed manually. Uphill. Both ways",
			"I've been here long enough to see patterns repeat. And that's okay",
			"Veteran status unlocked. The institutional knowledge lives in my head",
			"I've seen teams form, ship, and celebrate. Best part of the job",
		],
	},
	{
		id: "peacemaker", label: "Peacemaker",
		reactions: [
			"We worked it out. Growth is real",
			"Turns out we wanted the same thing, just said it differently",
			"Conflict resolved. My blood pressure thanks me",
			"Every disagreement is just a feature request in disguise",
		],
	},
	{
		id: "night-owl-champion", label: "Night Owl Champion",
		reactions: [
			"Someone has to close up",
			"Last one out, first one to see the sunrise from the wrong direction",
			"The office at midnight is a different world. It's my world",
			"Night owl champion, reporting for duty. Again. Still",
		],
	},
	{
		id: "team-player", label: "Team Player",
		reactions: [
			"Every standup, every retro. I show up",
			"I don't do solo wins. We ship together or not at all",
			"Being reliable isn't glamorous, but it's everything",
			"Team player badge earned. It's the one I'm most proud of",
			"Show up, help out, follow through. That's the whole formula",
		],
	},
	{
		id: "green-thumb", label: "Green Thumb",
		reactions: [
			"I'm emotionally attached to this plant now",
			"The plant is thriving. I'm thriving. We're in this together",
			"Started with one desk plant. Now I have a biome",
			"My plant grew a new leaf and I told everyone about it. Twice",
		],
	},
];

export function getMilestone(id: string): MilestoneDefinition | undefined {
	return MILESTONES.find((m) => m.id === id);
}
