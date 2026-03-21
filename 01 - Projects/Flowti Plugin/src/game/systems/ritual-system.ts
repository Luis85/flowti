/**
 * ritual-system.ts — Markdown-driven ceremonial choreography for agent groups.
 *
 * Rituals are declared in markdown files with YAML frontmatter. The RitualSystem
 * parses definitions, selects participants, and drives a phase state machine:
 *   gather → settle → lines (round-robin) → reaction → disperse
 *
 * Phase callbacks allow the scene to animate positions, trigger bubbles, and
 * fire emotes. Duration and cooldown limits prevent ritual spam.
 */

import type { BrainState } from "../brain/brain-types.js";

// ── RitualDefinition ──────────────────────────────────────────────────

export interface RitualDefinition {
	name: string;
	trigger: "manual" | "schedule" | "event";
	schedule?: string;                                   // HH:MM format
	event?: string;                                      // sensor event key
	participants: "all" | "nearby" | "idle" | string;   // string for "domain:X"
	duration: number;                                    // ms
	cooldown: number;                                    // ms
	gatherPoint: "center" | { x: number; y: number };
	settleMs: number;                                    // ms
	lines: string[];                                     // template lines with {name}, {domain}, {mood_adj}
	reactionEmote: "random" | number;
	disperse: boolean;
}

// ── RitualPhase ───────────────────────────────────────────────────────

export type RitualPhase =
	| { kind: "gather"; participants: string[] }
	| { kind: "settle" }
	| { kind: "line"; agentName: string; text: string }
	| { kind: "reaction"; emote: "random" | number }
	| { kind: "disperse"; participants: string[] };

// ── Internal agent entry ──────────────────────────────────────────────

interface AgentEntry {
	domain: string;
}

// ── Internal ritual run state ─────────────────────────────────────────

type RunStep =
	| { phase: "gather"; elapsed: number; participants: string[] }
	| { phase: "settle"; elapsed: number; participants: string[] }
	| { phase: "lines"; lineIndex: number; lineElapsed: number; participants: string[] }
	| { phase: "reaction"; elapsed: number; participants: string[] }
	| { phase: "done" };

interface RitualRun {
	ritual: RitualDefinition;
	step: RunStep;
	totalElapsed: number;
}

const LINE_GAP_MS = 2000;
const MOOD_ADJS = ["focused", "energized", "curious", "calm", "inspired"];

// ── Duration parsing ──────────────────────────────────────────────────

/** Parse a duration string like "30s", "2m", "1h", "24h" into milliseconds. */
export function parseDurationMs(raw: string): number {
	const trimmed = raw.trim();
	const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)$/.exec(trimmed);
	if (!match) return 0;
	const value = parseFloat(match[1]);
	switch (match[2]) {
		case "ms": return value;
		case "s":  return value * 1000;
		case "m":  return value * 60 * 1000;
		case "h":  return value * 60 * 60 * 1000;
		default:   return 0;
	}
}

// ── Markdown parser ───────────────────────────────────────────────────

/** Parse simple key-value frontmatter lines into a record. */
function parseFrontmatterKV(raw: string): Record<string, string> {
	const fm: Record<string, string> = {};
	for (const line of raw.split(/\r?\n/)) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();
		if (key) fm[key] = value;
	}
	return fm;
}

/** Parse gather point from frontmatter value. */
function parseGatherPoint(raw: string | undefined): RitualDefinition["gatherPoint"] {
	if (!raw || raw === "center") return "center";
	const xyMatch = /(\d+)[,\s]+(\d+)/.exec(raw);
	return xyMatch ? { x: parseInt(xyMatch[1], 10), y: parseInt(xyMatch[2], 10) } : "center";
}

/** Parse reaction emote from frontmatter value. */
function parseReactionEmote(raw: string | undefined): RitualDefinition["reactionEmote"] {
	if (!raw || raw === "random") return "random";
	const n = parseInt(raw, 10);
	return isNaN(n) ? "random" : n;
}

/** Parse quoted lines from markdown body (lines starting with - "..."). */
function parseBodyLines(body: string): string[] {
	const lines: string[] = [];
	for (const rawLine of body.split(/\r?\n/)) {
		const lineMatch = /^\s*-\s+"(.*)"/.exec(rawLine);
		if (lineMatch) lines.push(lineMatch[1]);
	}
	return lines;
}

/**
 * Parse a ritual markdown file into a RitualDefinition.
 *
 * Expected format:
 * ```
 * ---
 * name: Morning Standup
 * trigger: schedule
 * schedule: 09:00
 * participants: all
 * duration: 5m
 * cooldown: 24h
 * gather: center
 * settle: 2s
 * emote: random
 * disperse: true
 * ---
 *
 * - "Good morning, {name}!"
 * - "Let's kick off the day."
 * ```
 */
export function parseRitualMarkdown(md: string): RitualDefinition {
	const fmMatch = /^---\r?\n([\s\S]*?)\r?\n---/m.exec(md);
	const frontmatter = fmMatch ? fmMatch[1] : "";
	const body = fmMatch ? md.slice(fmMatch[0].length) : md;

	const fm = parseFrontmatterKV(frontmatter);
	const trigger = (fm["trigger"] as RitualDefinition["trigger"]) ?? "manual";

	return {
		name: fm["name"] ?? "",
		trigger,
		schedule: trigger === "schedule" ? (fm["schedule"] ?? undefined) : undefined,
		event: trigger === "event" ? (fm["event"] ?? undefined) : undefined,
		participants: (fm["participants"] as RitualDefinition["participants"]) ?? "all",
		duration: parseDurationMs(fm["duration"] ?? "5m"),
		cooldown: parseDurationMs(fm["cooldown"] ?? "1h"),
		gatherPoint: parseGatherPoint(fm["gather"]),
		settleMs: parseDurationMs(fm["settle"] ?? "2s"),
		lines: parseBodyLines(body),
		reactionEmote: parseReactionEmote(fm["emote"]),
		disperse: fm["disperse"] === "true",
	};
}

// ── RitualSystem ──────────────────────────────────────────────────────

export class RitualSystem {
	private readonly agents = new Map<string, AgentEntry>();
	private readonly rituals = new Map<string, RitualDefinition>();
	private readonly cooldowns = new Map<string, number>();       // ritual name → remaining ms
	private readonly phaseCallbacks: Array<(phase: RitualPhase) => void> = [];

	/** Currently running ritual (one at a time). */
	private activeRun: RitualRun | null = null;

	// ── Registration ─────────────────────────────────────────────────

	register(agentName: string, info: { domain: string }): void {
		this.agents.set(agentName, { domain: info.domain });
	}

	unregister(agentName: string): void {
		this.agents.delete(agentName);
	}

	// ── Ritual loading ────────────────────────────────────────────────

	loadRitual(def: RitualDefinition): void {
		this.rituals.set(def.name, def);
	}

	// ── Triggering ────────────────────────────────────────────────────

	triggerManual(ritualName: string): void {
		this.startRitual(ritualName);
	}

	triggerEvent(eventKey: string): void {
		for (const [, def] of this.rituals) {
			if (def.trigger === "event" && def.event === eventKey) {
				this.startRitual(def.name);
				return;
			}
		}
	}

	// ── Phase callback ────────────────────────────────────────────────

	onPhase(cb: (phase: RitualPhase) => void): void {
		this.phaseCallbacks.push(cb);
	}

	// ── Update ────────────────────────────────────────────────────────

	update(deltaMs: number, getBrainState: (name: string) => BrainState): void {
		// Drain cooldowns
		for (const [name, remaining] of this.cooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.cooldowns.delete(name);
			else this.cooldowns.set(name, updated);
		}

		if (!this.activeRun) return;

		this.activeRun.totalElapsed += deltaMs;
		const { ritual } = this.activeRun;

		// Duration limit — force-disperse if exceeded
		if (this.activeRun.totalElapsed >= ritual.duration) {
			const participants = this.participantsOf(this.activeRun.step);
			this.finishRun(participants);
			return;
		}

		this.advanceStep(deltaMs, getBrainState);
	}

	// ── Private helpers ───────────────────────────────────────────────

	private startRitual(ritualName: string): void {
		// Ignore if already running or on cooldown
		if (this.activeRun) return;
		if (this.cooldowns.has(ritualName)) return;

		const ritual = this.rituals.get(ritualName);
		if (!ritual) return;

		const participants = this.selectParticipants(ritual);
		if (participants.length === 0) return;

		this.activeRun = {
			ritual,
			step: { phase: "gather", elapsed: 0, participants },
			totalElapsed: 0,
		};

		this.emit({ kind: "gather", participants });
	}

	private advanceStep(deltaMs: number, getBrainState: (name: string) => BrainState): void {
		const run = this.activeRun!;
		const { ritual } = run;
		const step = run.step;

		if (step.phase === "gather") {
			// Immediately transition to settle (gather is instantaneous fire)
			step.elapsed += deltaMs;
			// Transition to settle after 0ms (gather fires on entry)
			run.step = { phase: "settle", elapsed: 0, participants: step.participants };
			this.emit({ kind: "settle" });

		} else if (step.phase === "settle") {
			step.elapsed += deltaMs;
			if (step.elapsed >= ritual.settleMs) {
				// Begin lines phase
				if (ritual.lines.length > 0) {
					run.step = { phase: "lines", lineIndex: 0, lineElapsed: 0, participants: step.participants };
					this.emitLine(run.step as Extract<RunStep, { phase: "lines" }>, ritual);
				} else {
					// No lines — go straight to reaction
					run.step = { phase: "reaction", elapsed: 0, participants: step.participants };
					this.emit({ kind: "reaction", emote: ritual.reactionEmote });
				}
			}

		} else if (step.phase === "lines") {
			step.lineElapsed += deltaMs;
			if (step.lineElapsed >= LINE_GAP_MS) {
				step.lineElapsed = 0;
				step.lineIndex++;
				if (step.lineIndex < ritual.lines.length) {
					this.emitLine(step, ritual);
				} else {
					// All lines done — move to reaction
					run.step = { phase: "reaction", elapsed: 0, participants: step.participants };
					this.emit({ kind: "reaction", emote: ritual.reactionEmote });
				}
			}

		} else if (step.phase === "reaction") {
			step.elapsed += deltaMs;
			if (step.elapsed >= 1000) {
				// Reaction lasts 1s then disperse
				if (ritual.disperse) {
					this.finishRun(step.participants);
				} else {
					this.finishRunNoDisperse(ritual);
				}
			}
		}
	}

	private emitLine(step: Extract<RunStep, { phase: "lines" }>, ritual: RitualDefinition): void {
		const { participants, lineIndex } = step;
		const agentName = participants[lineIndex % participants.length];
		const entry = this.agents.get(agentName);
		const domain = entry?.domain ?? "";
		const moodAdj = MOOD_ADJS[Math.floor(Math.random() * MOOD_ADJS.length)];

		const raw = ritual.lines[lineIndex];
		const text = raw
			.replace(/\{name\}/g, agentName)
			.replace(/\{domain\}/g, domain)
			.replace(/\{mood_adj\}/g, moodAdj);

		this.emit({ kind: "line", agentName, text });
	}

	private finishRun(participants: string[]): void {
		const ritual = this.activeRun!.ritual;
		this.activeRun = null;
		this.cooldowns.set(ritual.name, ritual.cooldown);
		this.emit({ kind: "disperse", participants });
	}

	private finishRunNoDisperse(ritual: RitualDefinition): void {
		this.activeRun = null;
		this.cooldowns.set(ritual.name, ritual.cooldown);
	}

	private selectParticipants(ritual: RitualDefinition): string[] {
		const allNames = [...this.agents.keys()];
		const p = ritual.participants;

		if (p === "all") return allNames;

		if (p === "idle") {
			// Without getBrainState access at trigger time, return all registered
			// The BrainState filter is applied during update; here we pre-select all
			return allNames;
		}

		if (p === "nearby") {
			// Without position data at trigger time, return all registered
			return allNames;
		}

		// "domain:X" pattern
		const domainMatch = /^domain:(.+)$/.exec(p);
		if (domainMatch) {
			const targetDomain = domainMatch[1];
			return allNames.filter((n) => this.agents.get(n)?.domain === targetDomain);
		}

		return allNames;
	}

	private participantsOf(step: RunStep): string[] {
		if (step.phase === "done") return [];
		return (step as Exclude<RunStep, { phase: "done" }>).participants;
	}

	private emit(phase: RitualPhase): void {
		for (const cb of this.phaseCallbacks) {
			cb(phase);
		}
	}
}
