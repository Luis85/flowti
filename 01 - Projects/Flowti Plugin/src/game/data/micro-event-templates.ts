/**
 * micro-event-templates.ts — Phrase templates for world micro-events.
 *
 * Every spoken or thought bubble during a micro-event draws from these pools.
 * Add phrases here to extend what agents say during events — no engine changes needed.
 */

export interface EventTemplate {
	readonly text: string;
	readonly weight: number;
}

// ── Standup ──────────────────────────────────────────────────────────

export const STANDUP_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Quick status update...", weight: 1 },
	{ text: "Yesterday I worked on the {domain} stuff", weight: 2 },
	{ text: "No blockers on my end", weight: 1 },
	{ text: "Making progress on my task", weight: 1 },
	{ text: "I'm about 70% through this one", weight: 1 },
	{ text: "Need to sync with someone on this later", weight: 1 },
	{ text: "Same as yesterday but with more coffee", weight: 2 },
	{ text: "Actually ahead of schedule for once", weight: 2 },
	{ text: "Still debugging that tricky issue", weight: 1 },
	{ text: "I'll wrap this up today, hopefully", weight: 1 },
	{ text: "Pair session helped a lot yesterday", weight: 1 },
	{ text: "Reviewing PRs this morning, then back to coding", weight: 1 },
	{ text: "The tests are finally cooperating", weight: 2 },
	{ text: "Let's keep it short — lots to do today", weight: 1 },
	{ text: "Good momentum, let's keep it going", weight: 1 },
];

// ── Deploy success ───────────────────────────────────────────────────

export const DEPLOY_SUCCESS_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Deploy is green! Ship it!", weight: 2 },
	{ text: "We're live! Nice work everyone", weight: 2 },
	{ text: "Smooth deploy. Love to see it", weight: 1 },
	{ text: "Green across the board. Beautiful", weight: 1 },
	{ text: "Deployed without a hitch!", weight: 2 },
	{ text: "Another successful ship day", weight: 1 },
	{ text: "Zero rollbacks. That's the dream", weight: 2 },
	{ text: "CI/CD came through. Chef's kiss", weight: 1 },
	{ text: "Celebration-worthy deploy right there", weight: 1 },
	{ text: "And it's live! Time for a victory lap", weight: 2 },
	{ text: "Clean deploy. The pipeline gods are pleased", weight: 2 },
	{ text: "Ship it and forget it. Wait no — monitor it", weight: 1 },
];

// ── End of day ───────────────────────────────────────────────────────

export const END_OF_DAY_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Wrapping up for the day...", weight: 1 },
	{ text: "Good day's work. Time to wind down", weight: 1 },
	{ text: "Pushing my last commit before EOD", weight: 2 },
	{ text: "See everyone tomorrow!", weight: 1 },
	{ text: "Logging off. Don't break anything while I'm gone", weight: 2 },
	{ text: "That was a productive cycle", weight: 1 },
	{ text: "Done for the day. Brain is officially off", weight: 2 },
	{ text: "Tomorrow's problem is tomorrow's problem", weight: 1 },
	{ text: "Calling it. Good work today, team", weight: 1 },
	{ text: "One more look at the board... nope, I'm done", weight: 2 },
	{ text: "Save, commit, close laptop. In that order", weight: 1 },
	{ text: "Time flies when you're shipping features", weight: 1 },
];

// ── Eureka moment ────────────────────────────────────────────────────

export const EUREKA_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Wait... I've got it!", weight: 2 },
	{ text: "OH. That's it. That's the solution!", weight: 2 },
	{ text: "Everything just clicked!", weight: 2 },
	{ text: "I can't believe I didn't see it sooner", weight: 1 },
	{ text: "The answer was right in front of me", weight: 1 },
	{ text: "YES! This is going to work", weight: 2 },
	{ text: "Breakthrough! The pieces fit!", weight: 2 },
	{ text: "Lightbulb moment. Hold on, let me write this down", weight: 1 },
	{ text: "I just had the best idea", weight: 1 },
	{ text: "It all makes sense now", weight: 2 },
	{ text: "Why didn't I think of this earlier?!", weight: 1 },
	{ text: "THIS is the approach. I can feel it", weight: 2 },
];

// ── Build break ──────────────────────────────────────────────────────

export const BUILD_BREAK_REACTION_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Uh oh...", weight: 1 },
	{ text: "Something broke", weight: 1 },
	{ text: "That doesn't look right", weight: 1 },
	{ text: "Who pushed?", weight: 2 },
	{ text: "The build is red", weight: 1 },
	{ text: "Not again...", weight: 2 },
	{ text: "Checking the logs...", weight: 1 },
	{ text: "Deep breaths everyone", weight: 1 },
	{ text: "This is fine. Everything is fine", weight: 2 },
	{ text: "I had a bad feeling about that last merge", weight: 1 },
	{ text: "Alert alert alert", weight: 1 },
	{ text: "Hold all deploys", weight: 2 },
];

export const BUILD_BREAK_RESOLVE_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Fixed it. We're back.", weight: 2 },
	{ text: "Crisis averted. Just a typo", weight: 2 },
	{ text: "Patched and pushed. Green again", weight: 1 },
	{ text: "Found it — one-liner fix", weight: 1 },
	{ text: "Build is back. That was a quick one", weight: 2 },
	{ text: "All clear. Carry on", weight: 1 },
	{ text: "Resolved. Let's pretend that didn't happen", weight: 2 },
	{ text: "Back to green. My heart rate is normalizing", weight: 2 },
	{ text: "Hotfix deployed. We're good", weight: 1 },
	{ text: "False alarm... well, real alarm, but it's fixed now", weight: 1 },
];

// ── Birthday ─────────────────────────────────────────────────────────

export const BIRTHDAY_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Wait, is that cake?!", weight: 2 },
	{ text: "Happy birthday to me? You shouldn't have!", weight: 2 },
	{ text: "Cake in the office! Best day ever", weight: 1 },
	{ text: "I love surprise celebrations!", weight: 1 },
	{ text: "Is this because I've been working so hard?", weight: 2 },
	{ text: "This makes up for that production bug last week", weight: 2 },
	{ text: "I'm not crying, you're crying", weight: 1 },
	{ text: "The team remembered! I'm touched", weight: 1 },
	{ text: "Cake solves everything, including my mood", weight: 2 },
	{ text: "Best surprise since that zero-bug release", weight: 1 },
];

// ── Power flicker ────────────────────────────────────────────────────

export const POWER_FLICKER_REACTION_TEMPLATES: readonly EventTemplate[] = [
	{ text: "?", weight: 1 },
	{ text: "Did the lights just flicker?", weight: 2 },
	{ text: "What was that?", weight: 1 },
	{ text: "Please tell me I didn't lose my work", weight: 2 },
	{ text: "Ctrl+S. Ctrl+S. Ctrl+S.", weight: 2 },
	{ text: "Ominous", weight: 1 },
	{ text: "That's not normal", weight: 1 },
	{ text: "My screen just blinked", weight: 1 },
];

export const POWER_FLICKER_RESOLVE_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Just a blip. All good", weight: 2 },
	{ text: "False alarm. Power's stable", weight: 1 },
	{ text: "Crisis averted. The server lives", weight: 2 },
	{ text: "Checked the UPS — we're fine", weight: 1 },
	{ text: "It was nothing. Probably. Hopefully", weight: 2 },
	{ text: "Back to normal. My heart isn't though", weight: 1 },
];

// ── New PR ───────────────────────────────────────────────────────────

export const NEW_PR_TEMPLATES: readonly EventTemplate[] = [
	{ text: "New PR ready for review", weight: 1 },
	{ text: "Just opened a PR — who's got eyes?", weight: 2 },
	{ text: "PR is up. Please be gentle", weight: 2 },
	{ text: "Ready for review. Pretty proud of this one", weight: 1 },
	{ text: "Opened a PR. It's smaller than it looks", weight: 2 },
	{ text: "Code review time! Fresh PR incoming", weight: 1 },
	{ text: "PR submitted. Now we wait", weight: 1 },
	{ text: "This one's ready. Clean diff, good tests", weight: 2 },
	{ text: "Just pushed — take a look when you can", weight: 1 },
	{ text: "Review requested. I promise it's not 500 lines", weight: 2 },
];

// ── Tea time ─────────────────────────────────────────────────────────

export const TEA_TIME_TEMPLATES: readonly EventTemplate[] = [
	{ text: "Afternoon caffeine run, anyone?", weight: 2 },
	{ text: "Coffee break! Who's in?", weight: 1 },
	{ text: "That's my cue for a tea refill", weight: 1 },
	{ text: "Need a warm beverage to power through the afternoon", weight: 1 },
	{ text: "Third cup? Fourth? I've lost count", weight: 2 },
	{ text: "The afternoon slump calls for reinforcements", weight: 2 },
	{ text: "Coffee machine, here I come", weight: 1 },
	{ text: "Hot beverage therapy session in progress", weight: 1 },
];

// ── Picker helper ────────────────────────────────────────────────────

/** Pick a random template from a pool using weighted selection. */
export function pickTemplate(pool: readonly EventTemplate[]): string {
	const totalWeight = pool.reduce((sum, t) => sum + t.weight, 0);
	let roll = Math.random() * totalWeight;
	for (const t of pool) {
		roll -= t.weight;
		if (roll <= 0) return t.text;
	}
	return pool[pool.length - 1].text;
}
