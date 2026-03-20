/**
 * huddle-templates.ts — Group conversation line templates for cluster events.
 *
 * These are used when the SocialSystem detects a cluster of agents and
 * triggers a huddle. Templates support {domain} and {mood_adj} variables.
 */

/** A single huddle template line. */
export interface HuddleTemplate {
	readonly text: string;
}

/** Pool of huddle line templates for group conversations. */
export const HUDDLE_TEMPLATES: readonly HuddleTemplate[] = [
	{ text: "Anyone else notice the {domain} issue from earlier?" },
	{ text: "I'm {mood_adj} about how the {domain} work is shaping up." },
	{ text: "Should we do a quick {domain} alignment before we split up?" },
	{ text: "Glad we're all here — the {domain} side has been a lot." },
	{ text: "Quick show of hands: who's feeling {mood_adj} on {domain}?" },
	{ text: "We should probably sync on {domain} before end of day." },
	{ text: "Between all of us, the {domain} coverage looks solid." },
	{ text: "I'm {mood_adj} — feels like {domain} is finally clicking." },
	{ text: "Can we carve out five minutes for a {domain} check-in?" },
	{ text: "Good energy in here. Let's keep the {domain} momentum going." },
	{ text: "Alright team, where are we on {domain}? Quick round-robin." },
	{ text: "Before we scatter — any blockers on {domain}? Speak now." },
	{ text: "This is the most {mood_adj} standup we've had in weeks." },
	{ text: "Okay, who wants to go first? Don't all volunteer at once." },
	{ text: "Shoutout to whoever fixed that {domain} thing. Seriously." },
	{ text: "I know everyone's {mood_adj} but we need five minutes on {domain}." },
	{ text: "Is it just me or are these huddles actually useful now?" },
	{ text: "Sprint's halfway done. {domain} status — go." },
	{ text: "Anyone need help? I'm looking at you, {domain} team." },
	{ text: "Let's celebrate — the {domain} milestone is done. For real this time." },
	{ text: "I'm sensing some {mood_adj} vibes. Everything okay on {domain}?" },
	{ text: "Hot take: {domain} is ahead of schedule. Prove me wrong." },
	{ text: "Three things: {domain} progress, blockers, and who's getting lunch." },
	{ text: "We keep having this {domain} meeting and it keeps being necessary." },
	{ text: "Everyone looks {mood_adj} today. Must be the {domain} progress." },
	{ text: "Last huddle of the day. Make it count. {domain} updates?" },
	{ text: "Can we skip the pleasantries and talk {domain}? I'm {mood_adj} and focused." },
	{ text: "The {domain} board is green. When's the last time that happened?" },
	{ text: "I'll keep this short — {domain} is on track. We're good. High fives." },
	{ text: "Who's carrying the {domain} weight this sprint? Let's spread it around." },
];
