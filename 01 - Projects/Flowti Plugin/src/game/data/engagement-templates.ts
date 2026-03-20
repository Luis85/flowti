/**
 * engagement-templates.ts — Director engagement line templates by tier.
 *
 * Tier 1 (ambient): agent thinking-aloud lines using {variables}.
 * Tier 2 (nudge): agent addressing the director directly.
 * Tier 3 (offer): agent proactively offering an action.
 *
 * interpolateTemplate replaces {key} placeholders with values from vars.
 * Unknown keys are left as-is.
 */

/** A single engagement template string. */
export interface EngagementTemplate {
	readonly text: string;
	/** Domain hint — used to rank this template for domain-matched agents. */
	readonly domain?: string;
}

/** Tier 1: ambient thinking-aloud lines. Agent is unaware it's being observed. */
export const TIER1_TEMPLATES: readonly EngagementTemplate[] = [
	{ text: "Still working through the {task} angle..." },
	{ text: "This {domain} problem is trickier than it looked." },
	{ text: "Feeling a bit {mood_adj} today, but making progress." },
	{ text: "The {task} piece is almost there." },
	{ text: "My {domain} instincts say this approach is right." },
	{ text: "Should probably double-check the {task} assumptions." },
	{ text: "If I frame it differently, the {task} path is clearer." },
	{ text: "One more pass at {task} should do it." },
	{ text: "I keep coming back to the same {domain} pattern." },
	{ text: "Feeling {mood_adj} — the hard part is behind us." },
	{ text: "The {task} is further along than it seemed." },
	{ text: "Classic {domain} tradeoff right here." },
	{ text: "Wait... did I already handle the edge case in {task}?" },
	{ text: "Okay, so if the {domain} layer does this, then {task} just falls into place." },
	{ text: "It's quiet in here. Good quiet. Thinking quiet." },
	{ text: "Is it Friday already? No. Okay. Back to {task}." },
	{ text: "Rubber duck says my {domain} approach is fine. Rubber duck is wise." },
	{ text: "I wonder if anyone else hit this same wall on {task}." },
	{ text: "Three cups of coffee deep. {task} is starting to make sense." },
	{ text: "That {domain} abstraction is either genius or madness. Time will tell." },
	{ text: "There's an elegance to {task} when you look at it sideways." },
	{ text: "The sun just moved. How long have I been staring at {task}?" },
	{ text: "I keep second-guessing the {domain} choice but the tests pass. Trust the tests." },
	{ text: "Almost forgot about that {domain} constraint. That would've been fun to debug later." },
	{ text: "Humming to myself. Good sign. Means {task} is flowing." },
];

/** Tier 2: nudge lines — agent addresses the director directly. */
export const TIER2_TEMPLATES: readonly EngagementTemplate[] = [
	{ text: "Hey, you around? I have a question about {task}." },
	{ text: "Could use a second opinion on this {domain} decision." },
	{ text: "Wanted to flag something on {task} when you have a moment." },
	{ text: "I'm at a decision point — quick question about {task}." },
	{ text: "Not blocking, but curious about direction on {task}." },
	{ text: "Ready for a quick sync whenever you are." },
	{ text: "I've been thinking about {task}. Does my approach sound right?" },
	{ text: "Can you sanity-check my {domain} reasoning real quick?" },
	{ text: "Two paths forward on {task} — your call on which." },
	{ text: "Just wanted to keep you in the loop on {task}." },
	{ text: "No rush, but I found something interesting in {domain}. Worth a look." },
	{ text: "Quick update: {task} is moving, but I have a question about scope." },
	{ text: "Hey — still there? Haven't heard from you in a bit." },
	{ text: "I'm about to make a call on {task}. Want to weigh in first?" },
	{ text: "Something doesn't feel right about the {domain} direction. Got a minute?" },
	{ text: "Sharing a win — the {task} approach is working better than expected." },
	{ text: "Want me to walk you through where {task} stands?" },
	{ text: "I found a shortcut on {domain} but it has tradeoffs. Thoughts?" },
	{ text: "If you're swamped I can decide on {task} myself. Just say the word." },
	{ text: "I wrote up some notes on {task}. Want me to share them?" },
	{ text: "The {domain} side is looking good. Wanted you to know before I move on." },
	{ text: "Poking my head in — anything urgent before I dive back into {task}?" },
	{ text: "I could go either way on {task}. Flip a coin or give me guidance?" },
	{ text: "Between you and me, I think {domain} needs more attention than we planned." },
];

/** Tier 3: offer lines — agent proactively proposes an action. */
export const TIER3_TEMPLATES: readonly EngagementTemplate[] = [
	{ text: "I could run a quick {domain} check if that helps." },
	{ text: "Want me to kick off the {task} now? I have capacity." },
	{ text: "I can have a {task} draft ready in a few minutes." },
	{ text: "Should I go ahead and start the {domain} work?" },
	{ text: "I have bandwidth — want me to tackle {task} next?" },
	{ text: "I could generate a report on {task} if useful." },
	{ text: "Ready to run {task} — just say the word." },
	{ text: "I'll start on {task} unless you'd rather hold off." },
	{ text: "I can handle {task} right now if you'd like." },
	{ text: "Offering to take {task} off your plate — interested?" },
	{ text: "The {domain} tests haven't been run in a while. Want me to kick them off?" },
	{ text: "I could do a quick code review on the {domain} changes before we merge." },
	{ text: "Nothing on my queue. I'll pick up {task} if no one objects." },
	{ text: "I noticed the {domain} docs are stale. I can update them while it's quiet." },
	{ text: "The backlog has a {task} item that looks ready. Want me to grab it?" },
	{ text: "I could organize the {domain} files — they're getting a bit scattered." },
	{ text: "If we want {task} done by end of day, I should start now. Green light?" },
	{ text: "I can spike on {domain} for an hour and report back. Low risk, high info." },
	{ text: "Let me put together a summary of where {task} stands. Won't take long." },
	{ text: "I'm going to refactor the {domain} utilities unless someone stops me." },
	{ text: "The {task} has a few loose ends. I can tie them up right now." },
	{ text: "I'll run the full {domain} suite and flag anything that breaks." },
	{ text: "Want me to pair with someone on {task}? Two heads, fewer bugs." },
	{ text: "I can prototype the {domain} approach in an hour. Want a proof of concept?" },
];

/**
 * Replace {key} placeholders in a template string with values from vars.
 * Keys not present in vars are left unchanged (e.g. "{unknown}" stays).
 */
export function interpolateTemplate(
	template: string,
	vars: Readonly<Record<string, string>>,
): string {
	return template.replace(/\{(\w+)\}/g, (match, key: string) => {
		return Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match;
	});
}
