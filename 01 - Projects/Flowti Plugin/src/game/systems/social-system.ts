/**
 * social-system.ts — Proximity conversation detection between related agents.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

import type { BrainState } from "../brain/brain-types.js";

export interface SocialAgent {
	readonly socialRadius: number;
	readonly personality: readonly string[];
	readonly domain: string;
	readonly relationships: readonly { target: string; type: string }[];
}

interface SocialEntry extends SocialAgent {
	proximityTimers: Map<string, number>;
}

const PROXIMITY_THRESHOLD_MS = 4000;
const PAIR_COOLDOWN_MS = 60000;
const IDLE_STATES: readonly BrainState[] = ["idle", "on-break", "waiting"];

type ConversationCallback = (agentA: string, agentB: string, lineA: string, lineB: string) => void;

const CONVERSATION_LINES: Record<string, readonly string[]> = {
	engineering: [
		"The build looks good today.", "Have you seen the latest test results?", "This architecture is clean.",
		"The pipeline is green.", "That refactor paid off.", "Coverage is looking solid.", "Clean commit history.",
		"Types are catching things early.", "The linter is happy.", "That's a nice abstraction.",
		"I love when the tests just pass.", "This module is getting tight.", "Zero warnings. Beautiful.",
		"The dependency graph is clean.", "That PR review was thorough.", "Good naming on that function.",
		"I refactored that whole module yesterday.", "The error handling is solid here.",
		"Immutability saves lives.", "Pure functions, pure joy.", "That was a one-line fix. The best kind.",
		"I think we can simplify this.", "The compiler is our friend.",
	],
	design: [
		"The flow feels intuitive now.", "I love how this looks.", "Users will appreciate this.",
		"Nice color choices.", "The spacing feels right.", "Good hierarchy here.", "This layout breathes.",
		"The micro-interactions are smooth.", "Accessibility is on point.", "Elegant solution.",
		"The grid is singing.", "That transition is buttery.", "Whitespace is doing the work here.",
		"The typography is crisp.", "Good contrast ratio.", "Responsive and clean.",
		"I sketched three versions before landing on this.", "The icon set is cohesive.",
		"Design system tokens are paying off.", "This feels delightful to use.",
		"Less chrome, more content.", "The animation timing is just right.",
	],
	product: [
		"The roadmap is shaping up.", "Good progress on the scope.", "Let's review the backlog.",
		"The metrics look promising.", "Stakeholders will like this.", "Priorities are clear now.",
		"The acceptance criteria are tight.", "That scope decision was the right call.",
		"User feedback confirmed our hypothesis.", "The MVP is well-scoped.",
		"That feature flag approach is smart.", "Data is telling a clear story.",
		"The iteration goal is crisp.", "Good alignment across the board.",
		"Let's not overthink this one.", "Ship, measure, iterate.",
		"The customer journey is mapped.", "That's a strong value proposition.",
	],
	management: [
		"Schedule looks on track.", "The team is in good shape.", "Risk register is clean.",
		"Delivery cadence is steady.", "Good velocity this iteration.", "Dependencies are resolved.",
		"The standup was efficient today.", "No impediments on the board.",
		"Resource allocation is balanced.", "The burndown looks healthy.",
		"Retro items are getting actioned.", "Communication is flowing well.",
		"Everyone knows their priorities.", "Capacity is well-distributed.",
		"Stakeholder update went smoothly.", "The process is serving us well.",
		"That was a productive planning session.", "Cross-team alignment is solid.",
	],
	quality: [
		"Test coverage is solid.", "No regressions so far.", "Edge cases are covered.",
		"The test strategy is working.", "Found an interesting edge case.",
		"All green in CI.", "The flaky test is finally fixed.", "Mutation testing found a gap.",
		"Boundary conditions checked.", "The test pyramid is balanced.",
		"Integration tests are fast now.", "That was a sneaky bug. Good catch.",
		"Exploratory testing uncovered something.", "The test data is realistic.",
		"Contract tests are passing.", "Performance benchmarks are stable.",
	],
	operations: [
		"Systems nominal.", "Dashboard is all green.", "Uptime looking good.",
		"The deploy went smooth.", "Monitoring is catching things early.",
		"Alert noise is down this week.", "The runbook worked perfectly.",
		"Auto-scaling kicked in right on time.", "Logs are clean.",
		"Incident response was fast.", "The recovery was seamless.",
		"Infrastructure costs are down.", "SSL certs are all current.",
	],
	orchestration: [
		"Everything is humming along.", "The workflow is smooth.", "Good coordination today.",
		"Systems are in sync.", "No blockers anywhere.", "All agents are productive.",
		"The handoffs are seamless.", "Integration points are solid.",
		"Parallel workstreams are converging.", "Dependencies are resolved upstream.",
		"The pipeline is flowing.", "Everyone's in their groove.",
	],
	analysis: [
		"The data tells a clear story.", "Interesting trend here.", "The numbers check out.",
		"Statistical significance achieved.", "The cohort analysis is revealing.",
		"Outliers explained.", "The model is converging.", "Good signal-to-noise ratio.",
		"The dashboard is updated.", "Correlation confirmed with causation.",
	],
	general: [
		"How's it going?", "Good to see you.", "Making progress!", "Nice work today.",
		"What are you working on?", "Coffee break?", "Anything I can help with?",
		"The team is cooking.", "Good energy today.", "This is a good day.",
		"Lunch soon?", "Taking a breather.", "What a morning.", "Almost there.",
		"The vibes are right.", "Productive session.", "I needed that stretch.",
		"Good chat.", "Let's keep this momentum.", "Feeling focused.",
		"Hey, nice to see a friendly face.", "Quick break, then back at it.",
		"We're making real progress here.", "The office is buzzing today.",
		"I appreciate you.", "Teamwork makes the dream work.",
		"Solid effort all around.", "Couldn't do it without the team.",
		"Another day, another commit.", "Living the dream.",
		"Did someone say snacks?", "My brain needs fuel.",
		"That was satisfying.", "Time flies when you're in the zone.",
		"What a crew we've got.", "Everyone's bringing their A-game.",
	],
};

export class SocialSystem {
	private readonly entries = new Map<string, SocialEntry>();
	private readonly pairCooldowns = new Map<string, number>();
	private callback: ConversationCallback | null = null;

	onConversation(cb: ConversationCallback): void {
		this.callback = cb;
	}

	register(name: string, agent: SocialAgent): void {
		this.entries.set(name, { ...agent, proximityTimers: new Map() });
	}

	unregister(name: string): void {
		this.entries.delete(name);
	}

	update(
		deltaMs: number,
		getPosition: (name: string) => { x: number; y: number },
		getState: (name: string) => BrainState,
	): void {
		// Decrement pair cooldowns
		for (const [key, remaining] of this.pairCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.pairCooldowns.delete(key);
			else this.pairCooldowns.set(key, updated);
		}

		const names = [...this.entries.keys()];
		for (let i = 0; i < names.length; i++) {
			const nameA = names[i];
			const entryA = this.entries.get(nameA)!;
			if (!IDLE_STATES.includes(getState(nameA))) continue;
			const posA = getPosition(nameA);

			for (let j = i + 1; j < names.length; j++) {
				const nameB = names[j];
				const entryB = this.entries.get(nameB)!;
				if (!IDLE_STATES.includes(getState(nameB))) continue;

				const pairKey = `${nameA}|${nameB}`;
				if (this.pairCooldowns.has(pairKey)) continue;

				const posB = getPosition(nameB);
				const dx = posA.x - posB.x;
				const dy = posA.y - posB.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				const maxRadius = Math.max(entryA.socialRadius, entryB.socialRadius);

				if (dist > maxRadius) {
					entryA.proximityTimers.delete(nameB);
					continue;
				}

				const timer = (entryA.proximityTimers.get(nameB) ?? 0) + deltaMs;
				entryA.proximityTimers.set(nameB, timer);

				if (timer >= PROXIMITY_THRESHOLD_MS) {
					entryA.proximityTimers.delete(nameB);
					this.pairCooldowns.set(pairKey, PAIR_COOLDOWN_MS);

					const lineA = this.pickLine(entryA.domain, entryA.personality);
					const lineB = this.pickLine(entryB.domain, entryB.personality);
					this.callback?.(nameA, nameB, lineA, lineB);
				}
			}
		}
	}

	private pickLine(domain: string, personality: readonly string[]): string {
		// 20% chance to use a personality quote
		if (personality.length > 0 && Math.random() < 0.2) {
			return personality[Math.floor(Math.random() * personality.length)];
		}
		// Use domain-specific lines, fall back to general
		const pool = CONVERSATION_LINES[domain] ?? CONVERSATION_LINES["general"];
		return pool[Math.floor(Math.random() * pool.length)];
	}
}
