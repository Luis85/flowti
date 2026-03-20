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
