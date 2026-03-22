/**
 * narrative-system.ts — Collects story beats during a day cycle and composes
 * them into markdown narratives for vault persistence.
 *
 * Beats are recorded as game events occur. At end-of-cycle, the system groups
 * them by narrative phase, applies templates, and writes a markdown file.
 */

import {
	NARRATIVE_TEMPLATES,
	PHASE_TRANSITIONS,
	DAY_PHASE_TO_NARRATIVE,
	OFFLINE_TEMPLATES,
} from "../data/narrative-templates.js";
import type { DayPhase } from "../data/day-phase-config.js";

// ── Types ────────────────────────────────────────────────────────────

export interface StoryBeat {
	readonly timestamp: number;
	readonly phase: string;
	readonly category: "task" | "social" | "need" | "economy" | "pet" | "ritual";
	readonly actors: readonly string[];
	readonly event: string;
	readonly detail: Record<string, unknown>;
}

export interface NarrativeDeps {
	readonly writeFile: (path: string, content: string) => void;
	readonly narrativeDir: string;
	readonly currentDate: () => string;
}

interface OfflineResults {
	readonly cyclesSimulated: number;
	readonly agentResults: ReadonlyArray<{
		readonly name: string;
		readonly tasksCompleted: number;
		readonly xpEarned: number;
		readonly leveledUp: boolean;
		readonly currentLevel: number;
	}>;
}

// ── Significance ordering ────────────────────────────────────────────

const SIGNIFICANCE_ORDER: Record<string, number> = {
	headline: 0,
	detail: 1,
	color: 2,
};

// ── Helpers ──────────────────────────────────────────────────────────

function interpolate(template: string, vars: Record<string, unknown>): string {
	return template.replace(/\$\{(\w+)\}/g, (_match, key: string) => {
		const val = vars[key];
		return val !== undefined ? String(val) : `\${${key}}`;
	});
}

function pickRandom<T>(items: readonly T[]): T {
	return items[Math.floor(Math.random() * items.length)];
}

// ── Narrative Phase Order ────────────────────────────────────────────

const PHASE_ORDER = ["Morning", "Lunch", "Afternoon", "Wind-Down", "Evening"];

// ── NarrativeSystem ──────────────────────────────────────────────────

export class NarrativeSystem {
	private beats: StoryBeat[] = [];
	private readonly deps: NarrativeDeps;

	constructor(deps: NarrativeDeps) {
		this.deps = deps;
	}

	recordBeat(beat: StoryBeat): void {
		this.beats.push(beat);
	}

	getCurrentBeats(): readonly StoryBeat[] {
		return [...this.beats];
	}

	composeCycleNarrative(cycleNumber: number): string {
		const date = this.deps.currentDate();
		const grouped = this.groupByNarrativePhase();
		const allAgents = this.collectAgents();
		const headlines = this.collectHeadlines();

		const sections: string[] = [];

		// YAML frontmatter
		sections.push(this.buildFrontmatter(date, cycleNumber, allAgents, headlines));

		// Phase sections in order
		for (const phase of PHASE_ORDER) {
			const phaseBeats = grouped.get(phase);
			if (!phaseBeats || phaseBeats.length === 0) continue;

			sections.push(`## ${phase}\n`);

			// Phase transition text
			const transition = PHASE_TRANSITIONS.find(t => t.phase === phase);
			if (transition) {
				sections.push(`*${pickRandom(transition.templates)}*\n`);
			}

			// Sort: headlines first, then details, then color
			const sorted = [...phaseBeats].sort((a, b) => {
				const sigA = this.getSignificance(a);
				const sigB = this.getSignificance(b);
				return (SIGNIFICANCE_ORDER[sigA] ?? 2) - (SIGNIFICANCE_ORDER[sigB] ?? 2);
			});

			// Render each beat
			for (const beat of sorted) {
				const rendered = this.renderBeat(beat);
				if (rendered) {
					sections.push(rendered);
				}
			}

			sections.push("");
		}

		// Summary footer
		sections.push(`---\n`);
		sections.push(`*Day ${cycleNumber} complete. ${this.beats.length} event${this.beats.length === 1 ? "" : "s"} recorded.*\n`);

		return sections.join("\n");
	}

	flushToVault(cycleNumber: number): void {
		if (this.beats.length === 0) return;

		const date = this.deps.currentDate();
		const content = this.composeCycleNarrative(cycleNumber);
		const path = `${this.deps.narrativeDir}/${date}-day-${cycleNumber}.md`;

		this.deps.writeFile(path, content);
		this.beats = [];
	}

	composeOfflineNarrative(results: OfflineResults): string {
		const sections: string[] = [];
		const count = results.cyclesSimulated;
		const plural = count === 1 ? "" : "s";

		// Condensed summary
		const condensedTemplate = pickRandom(OFFLINE_TEMPLATES.condensed);
		sections.push(interpolate(condensedTemplate, { count: String(count), plural }));
		sections.push("");

		// Per-agent summaries
		sections.push("### Agent Summary\n");
		for (const agent of results.agentResults) {
			sections.push(`- **${agent.name}**: ${agent.tasksCompleted} task${agent.tasksCompleted === 1 ? "" : "s"} completed, ${agent.xpEarned} XP earned`);
			if (agent.leveledUp) {
				sections.push(`  - Reached level ${agent.currentLevel}!`);
			}
		}

		sections.push("");

		// Highlights for level-ups
		const levelUps = results.agentResults.filter(a => a.leveledUp);
		if (levelUps.length > 0) {
			sections.push("### Highlights\n");
			for (const agent of levelUps) {
				const highlightTemplate = pickRandom(OFFLINE_TEMPLATES.highlight);
				sections.push(interpolate(highlightTemplate, {
					agent: agent.name,
					operation: `leveling up to level ${agent.currentLevel}`,
					domain: `reaching level ${agent.currentLevel}`,
				}));
			}
		}

		return sections.join("\n");
	}

	// ── Private helpers ──────────────────────────────────────────────

	private groupByNarrativePhase(): Map<string, StoryBeat[]> {
		const grouped = new Map<string, StoryBeat[]>();
		for (const beat of this.beats) {
			const narrativePhase = DAY_PHASE_TO_NARRATIVE[beat.phase as DayPhase] ?? "Morning";
			const existing = grouped.get(narrativePhase);
			if (existing) {
				existing.push(beat);
			} else {
				grouped.set(narrativePhase, [beat]);
			}
		}
		return grouped;
	}

	private getSignificance(beat: StoryBeat): string {
		const template = NARRATIVE_TEMPLATES.find(
			t => t.category === beat.category && t.event === beat.event,
		);
		return template?.significance ?? "color";
	}

	private renderBeat(beat: StoryBeat): string | null {
		const template = NARRATIVE_TEMPLATES.find(
			t => t.category === beat.category && t.event === beat.event,
		);
		if (!template) return null;

		const vars = beat.detail as Record<string, unknown>;
		const chosen = pickRandom(template.templates);
		return interpolate(chosen, vars);
	}

	private collectAgents(): string[] {
		const agents = new Set<string>();
		for (const beat of this.beats) {
			for (const actor of beat.actors) {
				agents.add(actor);
			}
		}
		return [...agents].sort();
	}

	private collectHeadlines(): string[] {
		const headlines: string[] = [];
		for (const beat of this.beats) {
			const template = NARRATIVE_TEMPLATES.find(
				t => t.category === beat.category && t.event === beat.event,
			);
			if (template?.significance === "headline") {
				const chosen = pickRandom(template.templates);
				headlines.push(interpolate(chosen, beat.detail as Record<string, unknown>));
			}
		}
		return headlines;
	}

	private buildFrontmatter(
		date: string,
		cycle: number,
		agents: string[],
		highlights: string[],
	): string {
		const lines: string[] = [];
		lines.push("---");
		lines.push("type: narrative");
		lines.push(`date: ${date}`);
		lines.push(`cycle: ${cycle}`);
		lines.push("offline: false");
		lines.push("agents:");
		for (const agent of agents) {
			lines.push(`  - ${agent}`);
		}
		lines.push("highlights:");
		if (highlights.length > 0) {
			for (const h of highlights) {
				const escaped = h.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
				lines.push(`  - "${escaped}"`);
			}
		} else {
			lines.push("  - \"A quiet day at the office.\"");
		}
		lines.push("---\n");
		return lines.join("\n");
	}
}
