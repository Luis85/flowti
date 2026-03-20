/**
 * crossover-templates.ts — Cross-domain conversation templates.
 *
 * When agents from different domains interact, these templates acknowledge
 * the domain gap with playful, authentic banter between specializations.
 */

import type { WeightedTemplate } from "../talk-types.js";

export interface CrossoverPair {
	readonly domainA: string;
	readonly domainB: string;
	readonly linesA: readonly WeightedTemplate[];  // what domainA says to domainB
	readonly linesB: readonly WeightedTemplate[];  // what domainB says back
}

export const CROSSOVER_PAIRS: readonly CrossoverPair[] = [
	// engineering <-> design
	{
		domainA: "engineering",
		domainB: "design",
		linesA: [
			{ template: "Can you make the animation smoother?", weight: 2, category: "social" },
			{ template: "The pixels are off by one. I can tell. Don't ask me how", weight: 2, category: "social" },
			{ template: "Is that a custom font? My build step has opinions about custom fonts", weight: 1, category: "social" },
			{ template: "I implemented your design. It's... close. Spiritually close", weight: 2, category: "social" },
			{ template: "The CSS for this will haunt my nightmares", weight: 2, category: "social" },
			{ template: "How attached are you to that shadow? Asking for performance reasons", weight: 1, category: "social" },
			{ template: "Your mockup looks amazing. My browser has other plans though", weight: 2, category: "social" },
		],
		linesB: [
			{ template: "Can you make the API faster?", weight: 2, category: "social" },
			{ template: "That's not what the mockup looks like and you know it", weight: 2, category: "social" },
			{ template: "I spent three hours on those rounded corners. They stay", weight: 2, category: "social" },
			{ template: "Why does the production version always look sadder than the mockup?", weight: 2, category: "social" },
			{ template: "The spacing is wrong. I can feel it from here", weight: 1, category: "social" },
			{ template: "Just use flexbox. I promise it won't bite", weight: 1, category: "social" },
			{ template: "Let me guess, 'it works on your machine'?", weight: 2, category: "social" },
		],
	},
	// engineering <-> quality
	{
		domainA: "engineering",
		domainB: "quality",
		linesA: [
			{ template: "Please don't find anything", weight: 2, category: "social" },
			{ template: "I tested it myself this time. Thoroughly. Mostly", weight: 2, category: "social" },
			{ template: "That edge case is unrealistic. Nobody would do that", weight: 2, category: "social" },
			{ template: "How do you always find the one path I didn't test?", weight: 1, category: "social" },
			{ template: "It's not a bug, it's... okay fine, it's a bug", weight: 2, category: "social" },
			{ template: "If you could just not test on Friday afternoons, that'd be great", weight: 1, category: "social" },
		],
		linesB: [
			{ template: "Oh I already found three things", weight: 2, category: "social" },
			{ template: "It broke on the first click. The literal first click", weight: 2, category: "social" },
			{ template: "Did you test this at all or just deploy and pray?", weight: 2, category: "social" },
			{ template: "I have a gift for finding bugs. Or a curse. Depends who you ask", weight: 2, category: "social" },
			{ template: "Your 'done' and my 'done' are very different concepts", weight: 1, category: "social" },
			{ template: "I'm not the enemy. I'm saving you from production incidents", weight: 2, category: "social" },
			{ template: "Reopening the ticket. Sorry. Not sorry", weight: 1, category: "social" },
		],
	},
	// product <-> engineering
	{
		domainA: "product",
		domainB: "engineering",
		linesA: [
			{ template: "How long will this take?", weight: 2, category: "social" },
			{ template: "The stakeholders want one small change...", weight: 2, category: "social" },
			{ template: "Can we just add a toggle for that?", weight: 2, category: "social" },
			{ template: "I know I said MVP but what if we also...", weight: 2, category: "social" },
			{ template: "The user research says we need to pivot slightly", weight: 1, category: "social" },
			{ template: "Is it possible to make it more... intuitive?", weight: 1, category: "social" },
			{ template: "What if we scope it down? Just the core 47 features", weight: 2, category: "social" },
		],
		linesB: [
			{ template: "Between 2 hours and 2 weeks", weight: 2, category: "social" },
			{ template: "Define 'small'", weight: 2, category: "social" },
			{ template: "Sure, right after we finish the last 12 toggles you requested", weight: 2, category: "social" },
			{ template: "That's a new project, not a feature request", weight: 2, category: "social" },
			{ template: "We can do it fast, or we can do it right. Pick one", weight: 1, category: "social" },
			{ template: "Let me translate 'intuitive' into technical requirements...", weight: 1, category: "social" },
			{ template: "The backlog just had a growth spurt. Thanks for that", weight: 2, category: "social" },
		],
	},
	// design <-> product
	{
		domainA: "design",
		domainB: "product",
		linesA: [
			{ template: "The mockup is ready", weight: 2, category: "social" },
			{ template: "I explored five directions. Please don't pick the worst one", weight: 2, category: "social" },
			{ template: "The user flow has 3 steps. Let's not add more", weight: 2, category: "social" },
			{ template: "I ran a usability test. Users are confused. As expected", weight: 1, category: "social" },
			{ template: "White space is not empty space. It's breathing room", weight: 2, category: "social" },
			{ template: "We need to simplify. I know you love features. But simplify", weight: 1, category: "social" },
		],
		linesB: [
			{ template: "Can we add just one more thing?", weight: 2, category: "social" },
			{ template: "Love it! But can we make the logo bigger?", weight: 2, category: "social" },
			{ template: "What if we combined screens 2 and 7? Users love efficiency", weight: 2, category: "social" },
			{ template: "The execs want it to 'pop' more. Their word, not mine", weight: 2, category: "social" },
			{ template: "Can you make a version with more options? And one with fewer?", weight: 1, category: "social" },
			{ template: "I showed the stakeholders. They had... thoughts", weight: 1, category: "social" },
			{ template: "Actually, can we go back to the version from last Tuesday?", weight: 2, category: "social" },
		],
	},
	// operations <-> engineering
	{
		domainA: "operations",
		domainB: "engineering",
		linesA: [
			{ template: "Who changed the config?", weight: 2, category: "social" },
			{ template: "The server is crying. What did you deploy?", weight: 2, category: "social" },
			{ template: "Your service is using 3x the memory you estimated", weight: 2, category: "social" },
			{ template: "I see you deployed at 4:58 PM on a Friday. Bold move", weight: 2, category: "social" },
			{ template: "The logs say 'this should never happen'. It happened", weight: 1, category: "social" },
			{ template: "Can you add more observability? I'm flying blind here", weight: 1, category: "social" },
		],
		linesB: [
			{ template: "Wasn't me. Checks git blame. Okay it was me", weight: 2, category: "social" },
			{ template: "The config change was supposed to be harmless", weight: 2, category: "social" },
			{ template: "It works in staging! I swear it works in staging", weight: 2, category: "social" },
			{ template: "Memory leak? No no, that's a feature. It caches aggressively", weight: 2, category: "social" },
			{ template: "Define 'outage'. Technically the health check still passes", weight: 1, category: "social" },
			{ template: "I'll add metrics. Right after I figure out why it's on fire", weight: 1, category: "social" },
		],
	},
	// management <-> engineering
	{
		domainA: "management",
		domainB: "engineering",
		linesA: [
			{ template: "Just checking in on the timeline", weight: 2, category: "social" },
			{ template: "Can we get an ETA for the leadership sync?", weight: 2, category: "social" },
			{ template: "The board wants a demo next week. Is that doable?", weight: 2, category: "social" },
			{ template: "How would you explain this to a non-technical audience?", weight: 1, category: "social" },
			{ template: "Can you put the progress in a slide deck?", weight: 1, category: "social" },
			{ template: "What's the risk level? In traffic light colors please", weight: 2, category: "social" },
		],
		linesB: [
			{ template: "Still the same timeline as yesterday", weight: 2, category: "social" },
			{ template: "The ETA is an estimate. The E literally stands for estimate", weight: 2, category: "social" },
			{ template: "Demo-ready and production-ready are very different things", weight: 2, category: "social" },
			{ template: "I'll try, but it involves explaining what a database is. Again", weight: 2, category: "social" },
			{ template: "Can I just show you the working code instead?", weight: 1, category: "social" },
			{ template: "It's yellow. It's always yellow. Everything is perpetually yellow", weight: 2, category: "social" },
			{ template: "Asking more often doesn't make it go faster. Just saying", weight: 1, category: "social" },
		],
	},
	// quality <-> product
	{
		domainA: "quality",
		domainB: "product",
		linesA: [
			{ template: "Found 12 bugs", weight: 2, category: "social" },
			{ template: "The happy path works. Everything else is chaos", weight: 2, category: "social" },
			{ template: "This requirement contradicts that other requirement", weight: 2, category: "social" },
			{ template: "Users will definitely try this. And it will definitely break", weight: 1, category: "social" },
			{ template: "I need clearer acceptance criteria. 'It should work' doesn't count", weight: 2, category: "social" },
			{ template: "Good news: I finished testing. Bad news: I finished testing", weight: 2, category: "social" },
		],
		linesB: [
			{ template: "Can we call them features?", weight: 2, category: "social" },
			{ template: "How many of those are critical? Just the critical ones. Please", weight: 2, category: "social" },
			{ template: "Can we ship and fix later? Asking for the roadmap", weight: 2, category: "social" },
			{ template: "The deadline doesn't move but the scope can. Theoretically", weight: 1, category: "social" },
			{ template: "Nobody will use it that way. Probably. Hopefully", weight: 2, category: "social" },
			{ template: "Let's triage. What can we live with? Temporarily? Forever?", weight: 1, category: "social" },
		],
	},
	// analysis <-> product
	{
		domainA: "analysis",
		domainB: "product",
		linesA: [
			{ template: "The data says no", weight: 2, category: "social" },
			{ template: "User engagement is down 15%. We should talk", weight: 2, category: "social" },
			{ template: "The A/B test is conclusive. And it's not what you hoped", weight: 2, category: "social" },
			{ template: "I ran the numbers three times. They're stubborn", weight: 2, category: "social" },
			{ template: "Correlation isn't causation. But this correlation is... suspicious", weight: 1, category: "social" },
			{ template: "Here's what the funnel actually looks like. Brace yourself", weight: 1, category: "social" },
		],
		linesB: [
			{ template: "But the stakeholders say yes", weight: 2, category: "social" },
			{ template: "What if we look at it from a different angle?", weight: 2, category: "social" },
			{ template: "Can you re-run it with a different cohort? A friendlier cohort?", weight: 2, category: "social" },
			{ template: "The qualitative feedback tells a different story", weight: 1, category: "social" },
			{ template: "Let's call it a 'learning' and move forward", weight: 2, category: "social" },
			{ template: "Numbers are one perspective. Intuition is another. Right?", weight: 1, category: "social" },
			{ template: "Can you make a chart that looks more... optimistic?", weight: 2, category: "social" },
		],
	},
	// orchestration <-> engineering
	{
		domainA: "orchestration",
		domainB: "engineering",
		linesA: [
			{ template: "Your service is the bottleneck", weight: 2, category: "social" },
			{ template: "The pipeline failed at your step. Again", weight: 2, category: "social" },
			{ template: "Can you add a health endpoint? A real one this time", weight: 2, category: "social" },
			{ template: "Your timeout is too aggressive. It's cascading everywhere", weight: 1, category: "social" },
			{ template: "I need you to be idempotent. Please. For my sanity", weight: 2, category: "social" },
			{ template: "The dependency graph has a cycle. Guess whose service is in it", weight: 1, category: "social" },
		],
		linesB: [
			{ template: "Your pipeline is too aggressive", weight: 2, category: "social" },
			{ template: "That's not a bottleneck, that's... thorough processing", weight: 2, category: "social" },
			{ template: "The health endpoint returns 200. What more do you want from me?", weight: 2, category: "social" },
			{ template: "Maybe the pipeline should retry more gracefully?", weight: 1, category: "social" },
			{ template: "I am idempotent! Mostly. On good days", weight: 2, category: "social" },
			{ template: "Your orchestration layer adds more latency than my service does", weight: 1, category: "social" },
		],
	},
	// design <-> quality
	{
		domainA: "design",
		domainB: "quality",
		linesA: [
			{ template: "The interaction should feel smooth. Does it feel smooth?", weight: 2, category: "social" },
			{ template: "The error state needs love too. Test that one please", weight: 2, category: "social" },
			{ template: "Try it on mobile. I need to know if my responsive grid holds", weight: 1, category: "social" },
			{ template: "That's not a bug, that's a micro-interaction", weight: 2, category: "social" },
			{ template: "Accessibility pass? How are the contrast ratios looking?", weight: 1, category: "social" },
			{ template: "If the loading state is ugly, that's a bug in my book", weight: 2, category: "social" },
		],
		linesB: [
			{ template: "It's smooth until you rotate the screen. Then chaos", weight: 2, category: "social" },
			{ template: "The error state is fine. The error MESSAGE, however...", weight: 2, category: "social" },
			{ template: "Your responsive grid broke on exactly one phone model. Mine", weight: 2, category: "social" },
			{ template: "The animation drops frames on older devices. Users will notice", weight: 1, category: "social" },
			{ template: "Contrast ratio is 3.2:1. Needs to be 4.5:1. Close but no", weight: 1, category: "social" },
			{ template: "Visually stunning. Functionally terrifying", weight: 2, category: "social" },
		],
	},
	// analysis <-> engineering
	{
		domainA: "analysis",
		domainB: "engineering",
		linesA: [
			{ template: "Your event tracking is missing data", weight: 2, category: "social" },
			{ template: "Can you add a timestamp to that payload? I'm begging you", weight: 2, category: "social" },
			{ template: "The query takes 45 seconds. Is that... intentional?", weight: 2, category: "social" },
			{ template: "I found an anomaly. Either it's a bug or we found something big", weight: 1, category: "social" },
			{ template: "Your logs are beautiful. If only the data pipeline agreed", weight: 1, category: "social" },
		],
		linesB: [
			{ template: "The data is there. Somewhere. In one of the tables", weight: 2, category: "social" },
			{ template: "A timestamp? That's three story points and a database migration", weight: 2, category: "social" },
			{ template: "45 seconds is fast for that much data. Trust me", weight: 2, category: "social" },
			{ template: "It's always a bug. I'm sorry. It's always a bug", weight: 1, category: "social" },
			{ template: "Define 'missing'. It's null, not missing. Big difference. Maybe", weight: 2, category: "social" },
		],
	},
	// management <-> product
	{
		domainA: "management",
		domainB: "product",
		linesA: [
			{ template: "The quarterly review is in 2 weeks. Where are we?", weight: 2, category: "social" },
			{ template: "Can we show ROI on this initiative?", weight: 2, category: "social" },
			{ template: "The investors want a progress update. In metrics, not stories", weight: 1, category: "social" },
			{ template: "Are we still on track for the annual goals?", weight: 2, category: "social" },
			{ template: "What's the competitive landscape looking like?", weight: 1, category: "social" },
		],
		linesB: [
			{ template: "We're exactly where the last update said we'd be. On track-ish", weight: 2, category: "social" },
			{ template: "ROI is complicated. Let me build a narrative around the numbers", weight: 2, category: "social" },
			{ template: "The metrics are moving. In a direction. A mostly good direction", weight: 2, category: "social" },
			{ template: "Annual goals are achievable if Q3 goes perfectly. So... maybe", weight: 1, category: "social" },
			{ template: "Competition shipped something similar. But ours is better. Probably", weight: 2, category: "social" },
			{ template: "I have a deck. It has charts. The charts go up. You'll love it", weight: 1, category: "social" },
		],
	},
];

/** Find a crossover pair for two given domains, checking both orderings. */
export function findCrossover(domainA: string, domainB: string): CrossoverPair | undefined {
	return CROSSOVER_PAIRS.find(
		(pair) =>
			(pair.domainA === domainA && pair.domainB === domainB) ||
			(pair.domainA === domainB && pair.domainB === domainA),
	);
}
