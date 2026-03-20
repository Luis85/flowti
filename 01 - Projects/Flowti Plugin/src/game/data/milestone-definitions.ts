/**
 * milestone-definitions.ts — Milestone triggers and reaction templates.
 */

export interface MilestoneDefinition {
	readonly id: string;
	readonly label: string;
	readonly reaction: string;  // bubble text, supports {name} interpolation
}

export const MILESTONES: readonly MilestoneDefinition[] = [
	{ id: "first-day",           label: "First Day",          reaction: "New here! Taking it all in" },
	{ id: "first-friend",        label: "First Friend",       reaction: "I think {name} and I really click" },
	{ id: "best-friend",         label: "Best Friend",        reaction: "{name} gets me. That's rare" },
	{ id: "first-rivalry",       label: "First Rivalry",      reaction: "{name} and I disagree on everything" },
	{ id: "coffee-regular",      label: "Coffee Regular",     reaction: "The barista knows my order. Wait, there's no barista" },
	{ id: "social-butterfly",    label: "Social Butterfly",   reaction: "I've talked to everyone about everything" },
	{ id: "work-streak-5",       label: "5-Day Streak",       reaction: "Five days strong. I'm in the zone" },
	{ id: "work-streak-10",      label: "10-Day Streak",      reaction: "Double digits. Don't jinx it" },
	{ id: "survivor",            label: "Survivor",           reaction: "I've seen things. Build things" },
	{ id: "early-adopter",       label: "Early Adopter",      reaction: "Been here since the early days" },
	{ id: "veteran",             label: "Veteran",            reaction: "I remember when this office was empty" },
	{ id: "peacemaker",          label: "Peacemaker",         reaction: "We worked it out. Growth is real" },
	{ id: "night-owl-champion",  label: "Night Owl Champion", reaction: "Someone has to close up" },
	{ id: "team-player",         label: "Team Player",        reaction: "Every standup, every retro. I show up" },
	{ id: "green-thumb",         label: "Green Thumb",        reaction: "I'm emotionally attached to this plant now" },
];

export function getMilestone(id: string): MilestoneDefinition | undefined {
	return MILESTONES.find((m) => m.id === id);
}
