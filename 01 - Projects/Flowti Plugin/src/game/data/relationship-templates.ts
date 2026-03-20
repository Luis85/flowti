/**
 * relationship-templates.ts — Conversation templates per relationship tier.
 *
 * Each tier unlocks additional template pools that overlay the generic social pool.
 * Rival templates replace 30% of normal conversations with bickering.
 */

export interface RelationshipLine {
	readonly text: string;
	readonly weight: number;
}

export const BICKER_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Oh, you're a {opinionB} person? Interesting choice...", weight: 2 },
	{ text: "We are NOT having this debate again", weight: 2 },
	{ text: "I respect your opinion. I just think it's wrong", weight: 2 },
	{ text: "Agree to disagree. Heavily disagree", weight: 1 },
	{ text: "You say {opinionB}, I say {opinionA}. Let's call the whole thing off", weight: 1 },
	{ text: "I knew you'd say that", weight: 1 },
	{ text: "This is our hill and we're both dying on it", weight: 2 },
	{ text: "I've heard your argument. It's still wrong", weight: 1 },
	{ text: "You know what, let's talk about literally anything else", weight: 1 },
	{ text: "One day you'll see the light. Today is not that day", weight: 2 },
	{ text: "Can someone else weigh in? I need backup", weight: 1 },
	{ text: "The audacity of {opinionB}. The absolute audacity", weight: 2 },
];

export const COLLEAGUE_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Good working with you on that", weight: 1 },
	{ text: "Your {domain} perspective always helps", weight: 2 },
	{ text: "We make a solid team on {domain} stuff", weight: 1 },
	{ text: "I've learned a lot working alongside you", weight: 1 },
	{ text: "Your approach to {domain} is really effective", weight: 2 },
	{ text: "Glad we're on the same project", weight: 1 },
	{ text: "We should collaborate more often", weight: 1 },
	{ text: "You always bring good energy to the work", weight: 2 },
];

export const FRIEND_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Remember when we fixed that impossible bug together?", weight: 2 },
	{ text: "You're one of the good ones, you know that?", weight: 2 },
	{ text: "Lunch? Same spot?", weight: 1 },
	{ text: "I saved you a seat", weight: 1 },
	{ text: "You look like you need a break. Coffee's on me", weight: 2 },
	{ text: "Nobody gets my jokes like you do", weight: 1 },
	{ text: "We've been through some builds together", weight: 2 },
	{ text: "If I had to be stuck in a war room, I'd want you there", weight: 2 },
	{ text: "That inside joke from last week? Still funny", weight: 1 },
	{ text: "You and me vs the backlog. Let's go", weight: 1 },
	{ text: "Thanks for having my back in that meeting", weight: 2 },
	{ text: "I trust your judgment more than most", weight: 1 },
];

export const BEST_FRIEND_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "I was literally about to say the same thing", weight: 2 },
	{ text: "You finish my sentences and I'm not even mad", weight: 2 },
	{ text: "Ride or die, build or crash", weight: 2 },
	{ text: "I'd take a bullet for you. A metaphorical, code-related bullet", weight: 2 },
	{ text: "No one else would understand why that's funny", weight: 1 },
	{ text: "We don't even need to talk. We just know", weight: 1 },
	{ text: "Best partner in code I've ever had", weight: 2 },
	{ text: "If they ever split us up I'm quitting", weight: 2 },
	{ text: "Our vibe is immaculate and I will not apologize", weight: 1 },
	{ text: "Telepathic debugging session?", weight: 1 },
];

export const AGREEMENT_TEMPLATES: readonly RelationshipLine[] = [
	{ text: "Finally, someone with taste! {opinionA} all the way", weight: 2 },
	{ text: "You're a {opinionA} person too? Instant respect", weight: 2 },
	{ text: "I knew I liked you. {opinionA} is clearly the right choice", weight: 1 },
	{ text: "See? Great minds think alike. {opinionA} forever", weight: 1 },
	{ text: "{opinionA} gang rise up", weight: 2 },
	{ text: "We're on the same side and that matters", weight: 1 },
];

/** Get templates for a relationship tier. */
export function getTemplatesForTier(tier: string): readonly RelationshipLine[] {
	switch (tier) {
		case "rival": return BICKER_TEMPLATES;
		case "colleague": return COLLEAGUE_TEMPLATES;
		case "friend": return FRIEND_TEMPLATES;
		case "best-friend": return BEST_FRIEND_TEMPLATES;
		default: return [];
	}
}
