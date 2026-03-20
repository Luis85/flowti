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
];
