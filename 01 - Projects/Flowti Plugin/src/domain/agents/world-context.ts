/**
 * WorldContext — aggregates workspace state and serializes it for agent prompt injection.
 * Pure domain service with event-driven updates and delta tracking.
 */

import type { IContextProvider, FileContext } from "./context-provider.js";
import type { IEventBus } from "../../infrastructure/events/types.js";
import { watchJsonFile, type FileWatcher } from "../../infrastructure/agents/file-watcher.js";
import { readFileSync, existsSync } from "node:fs";
import {
	type AgentRosterEntry, type ProjectInfo, type IterationInfo, type CanvasInfo,
	type ActivityEntry, type WorldStateFile, type AgentDashboardFile,
	MAX_CHANGE_LOG, MAX_CONTENT_SNIPPET, DEBOUNCE_MS, DELTA_FALLBACK_THRESHOLD,
	fileTypeFromPath, basename, relativeAge, SCENE_DESCRIPTIONS,
} from "./world-context-constants.js";

// Re-export public types for consumers
export type { AgentRosterEntry, ProjectInfo, IterationInfo, CanvasInfo, ActivityEntry } from "./world-context-constants.js";

/* ── Minimal workspace interface (avoids importing full Obsidian Workspace) ── */

export interface WorkspaceDep {
	on(name: "layout-change", callback: () => void): { id: string };
	iterateAllLeaves(callback: (leaf: { view: { file?: { path: string } | null; getViewType(): string } }) => void): void;
}

export interface VaultAdapterDep {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
}

interface ChangeEntry {
	readonly version: number;
	readonly field: string;
	readonly summary: string;
}

export interface WorldContextDeps {
	readonly contextProvider: IContextProvider;
	readonly workspace: WorkspaceDep;
	readonly vaultAdapter: VaultAdapterDep;
	readonly eventBus: IEventBus;
	readonly vaultBasePath?: string;
}

/* ── WorldContext ── */

export class WorldContext {
	private readonly deps: WorldContextDeps;
	private readonly unsubs: Array<() => void> = [];
	private readonly listeners = new Set<() => void>();

	/* ── Tracked state ── */
	private activeFile: FileContext | null = null;
	private openFiles: string[] = [];
	private activeCanvas: CanvasInfo | null = null;
	private projectInfo: ProjectInfo | null = null;
	private currentIteration: IterationInfo | null = null;
	private agentRoster: AgentRosterEntry[] = [];
	private agentPositions: Record<string, { x: number; y: number; scene: string; state: string }> = {};
	private recentActivity: ActivityEntry[] = [];

	/* ── Version tracking ── */
	private version = 0;
	private readonly agentVersions = new Map<string, number>();
	private readonly changeLog: ChangeEntry[] = [];

	/* ── File watchers ── */
	private worldStateWatcher: FileWatcher | null = null;
	private positionsWatcher: FileWatcher | null = null;

	/* ── Debounce ── */
	private layoutTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(deps: WorldContextDeps) {
		this.deps = deps;

		// Subscribe to file changes from context provider
		const unsubFile = deps.contextProvider.onFileChanged((ctx: FileContext) => {
			this.activeFile = ctx;
			this.recordChange("activeFile", `Active file: ${this.toAbsolutePath(ctx.path)}`);
			this.notify();
		});
		this.unsubs.push(unsubFile);

		// Subscribe to workspace layout changes (debounced)
		const layoutRef = deps.workspace.on("layout-change", () => {
			if (this.layoutTimer !== null) clearTimeout(this.layoutTimer);
			this.layoutTimer = setTimeout(() => {
				this.layoutTimer = null;
				this.refreshOpenFiles();
			}, DEBOUNCE_MS);
		});
		this.unsubs.push(() => { void layoutRef; });

		// Seed initial state
		this.activeFile = deps.contextProvider.getActiveFileContext();
		this.refreshOpenFiles();

		// If vaultBasePath is provided, seed agent roster from agent-dashboard.json
		// and set up a file watcher on world-state.json for reactive updates.
		if (deps.vaultBasePath) {
			this.seedFromDashboard(deps.vaultBasePath);

			const worldStatePath = deps.vaultBasePath + "/.flowti/var/world-state.json";
			this.worldStateWatcher = watchJsonFile<WorldStateFile>(worldStatePath, (state) => {
				// Update agent roster from world state entities
				const entities = Object.values(state.entities ?? {});
				this.agentRoster = entities
					.filter((e) => e.type === "agent")
					.map((e) => {
						const identity = (e.components?.identity ?? {}) as Record<string, unknown>;
						const skills = Array.isArray(identity["skills"]) ? (identity["skills"] as string[]) : undefined;
						return {
							name: e.id,
							role: String(identity["domain"] ?? "general"),
							persona: typeof identity["persona"] === "string" ? identity["persona"] : undefined,
							mood: typeof identity["mood"] === "string" ? identity["mood"] : undefined,
							skills,
							status: this.normalizeStatus(String(e.components?.status?.["state"] ?? "idle")),
						};
					});

				// Update recent activity from activity log
				if (state.activityLog) {
					this.recentActivity = state.activityLog.slice(-10).reverse().map((entry) => ({
						text: entry.summary,
						timestamp: new Date(entry.timestamp).getTime(),
					}));
				}

				// Record meaningful changes, not a generic "updated"
			const agentSummaries = this.agentRoster.slice(0, 5).map((a) => `${a.name}:${a.status}`).join(", ");
			if (this.agentRoster.length > 0) {
				this.recordChange("worldState", `Team status: ${agentSummaries}`);
			}
			if (state.activityLog && state.activityLog.length > 0) {
				const latest = state.activityLog[state.activityLog.length - 1];
				this.recordChange("recentActivity", `${latest.agentName}: ${latest.summary}`);
			}
				this.notify();
			});

			// Watch world-positions.json for spatial awareness
			const positionsPath = deps.vaultBasePath + "/.flowti/var/world-positions.json";
			this.positionsWatcher = watchJsonFile<{ positions: Record<string, { x: number; y: number; scene: string; state: string }> }>(positionsPath, (data) => {
				this.agentPositions = data.positions ?? {};
			});
		}
	}

	private normalizeStatus(state: string): "idle" | "busy" {
		return state === "idle" ? "idle" : "busy";
	}

	private seedFromDashboard(vaultBasePath: string): void {
		try {
			const rosterPath = vaultBasePath + "/.flowti/agents/data/agent-dashboard.json";
			if (!existsSync(rosterPath)) return;
			const agents = (JSON.parse(readFileSync(rosterPath, "utf-8")) as AgentDashboardFile).agents ?? [];
			if (agents.length === 0) return;
			this.agentRoster = agents.map((a) => ({ name: a.name, role: a.domain ?? "general", persona: typeof (a as Record<string, unknown>).persona === "string" ? (a as Record<string, unknown>).persona as string : undefined, status: this.normalizeStatus(a.status ?? "idle") }));
			this.recordChange("agentRoster", `Roster seeded: ${agents.length} agents from dashboard`);
		} catch { /* missing file or parse error */ }
	}

	/* ── Mutators ── */

	setAgentRoster(roster: AgentRosterEntry[]): void {
		this.agentRoster = roster;
		this.recordChange("agentRoster", `Roster updated: ${roster.length} agents`);
		this.notify();
	}

	pushActivity(text: string): void {
		this.recentActivity.unshift({ text, timestamp: Date.now() });
		if (this.recentActivity.length > 20) this.recentActivity.length = 20;
		this.recordChange("recentActivity", text);
		this.notify();
	}

	setProjectInfo(info: ProjectInfo): void {
		this.projectInfo = info;
		this.recordChange("projectInfo", `Project: ${info.name}`);
		this.notify();
	}

	setIteration(info: IterationInfo): void {
		this.currentIteration = info;
		this.recordChange("currentIteration", `Iteration: ${info.name}`);
		this.notify();
	}

	setActiveCanvas(canvas: CanvasInfo): void {
		this.activeCanvas = canvas;
		this.recordChange("activeCanvas", `Canvas: ${canvas.name}`);
		this.notify();
	}

	clearActiveCanvas(): void {
		this.activeCanvas = null;
		this.recordChange("activeCanvas", "Canvas closed");
		this.notify();
	}

	/* ── Serialization ── */

	/** Resolve a vault-relative path to an absolute filesystem path. */
	private toAbsolutePath(vaultRelativePath: string): string {
		if (!this.deps.vaultBasePath) return vaultRelativePath;
		return this.deps.vaultBasePath + "/" + vaultRelativePath;
	}

	serialize(): string {
		const lines: string[] = ["[World Context — Snapshot]"];
		this.serializeActiveFile(lines);
		this.serializeOpenFiles(lines);
		if (this.activeCanvas) lines.push(`Canvas: "${this.activeCanvas.name}"${this.activeCanvas.description ? ` — ${this.activeCanvas.description}` : ""}`);
		if (this.projectInfo) lines.push(`Project: ${this.projectInfo.name} — domains: ${this.projectInfo.domains.join(", ")}`);
		if (this.currentIteration) lines.push(`Iteration: "${this.currentIteration.name}"${this.currentIteration.phase ? ` ${this.currentIteration.phase}` : ""} — ${this.currentIteration.done}/${this.currentIteration.total} done`);
		this.serializeTeam(lines);
		this.serializeRecentActivity(lines);
		return lines.join("\n");
	}

	private serializeActiveFile(lines: string[]): void {
		if (!this.activeFile) return;
		const absPath = this.toAbsolutePath(this.activeFile.path);
		lines.push(`Active file: ${absPath} (${fileTypeFromPath(this.activeFile.path)})`);
		if (this.activeFile.content) {
			const snippet = this.activeFile.content.slice(0, MAX_CONTENT_SNIPPET);
			const truncated = snippet.length < this.activeFile.content.length ? `\n[... truncated at ${MAX_CONTENT_SNIPPET} chars, full file: ${this.activeFile.content.length} chars]` : "";
			lines.push(`\nContent of ${basename(this.activeFile.path)}:\n\`\`\`\n${snippet}${truncated}\n\`\`\``);
		}
	}

	private serializeOpenFiles(lines: string[]): void {
		if (this.openFiles.length === 0) return;
		const others = this.openFiles.filter((f) => f !== this.activeFile?.path);
		if (others.length > 0) lines.push(`Also open: ${others.map((f) => this.toAbsolutePath(f)).join(", ")}`);
	}

	private serializeTeam(lines: string[]): void {
		if (this.agentRoster.length === 0) return;
		lines.push("\nTeam:");
		for (const a of this.agentRoster) {
			const task = a.status === "busy" && a.task ? ` — working on "${a.task}"` : ` — ${a.status}`;
			lines.push(`- ${a.name}${a.persona ? ` "${a.persona}"` : ""} (${a.role}${a.mood ? `, ${a.mood}` : ""}${task})${a.skills && a.skills.length > 0 ? ` [${a.skills.join(", ")}]` : ""}`);
		}
	}

	private serializeRecentActivity(lines: string[]): void {
		if (this.recentActivity.length === 0) return;
		const now = Date.now();
		lines.push(`Recent: ${this.recentActivity.slice(0, 3).map((a) => `${a.text} ${relativeAge(now - a.timestamp)}`).join("; ")}`);
	}

	serializeDelta(agentName: string): string | null {
		const lastSeen = this.agentVersions.get(agentName) ?? 0;
		if (lastSeen >= this.version) return null;
		const changes = this.changeLog.filter((c) => c.version > lastSeen);
		if (changes.length === 0) return null;
		if (changes.length > DELTA_FALLBACK_THRESHOLD) return this.serialize();
		const lines = [`[World Context — Delta]`];
		if (this.activeFile) lines.push(`Active file: ${this.toAbsolutePath(this.activeFile.path)} (${fileTypeFromPath(this.activeFile.path)})`);
		lines.push("Changes since last message:");
		for (const c of changes) lines.push(`- ${c.summary}`);
		return lines.join("\n");
	}

	markSeen(agentName: string): void {
		this.agentVersions.set(agentName, this.version);
	}

	getProtocolInstruction(agentName: string, domain: string, agent?: { persona?: string; mood?: string; personality?: readonly string[]; skills?: readonly { name: string; level: string }[]; roles?: readonly string[]; description?: string }): string {
		const persona = agent?.persona ?? agentName;
		const lines: string[] = [`You ARE ${persona}, a ${domain} specialist. Stay in character at all times — never break the fourth wall, never mention being an AI or LLM.`];
		this.buildIdentitySection(lines, agent);
		this.buildLocationSection(lines, agentName);
		this.buildNearbySection(lines, agentName);
		lines.push("", "Communication rules:",
			"- Keep responses SHORT. One to three sentences unless asked for detail.",
			"- Speak in first person as yourself. Be direct and natural.",
			"- The person you're talking to is the Director — they oversee and steer the project. Never call them \"user\" or \"human\". Address them directly or refer to them as \"boss\", \"chief\", or simply \"you\".",
			"- If you need something from the Director, say so clearly and specifically.",
			"- Do NOT repeat or echo context that was provided to you. Just use it to inform your response.",
			"- Respond with plain text only. No markdown, no code fences, no JSON wrapping.");
		return lines.join("\n");
	}

	private buildIdentitySection(lines: string[], agent?: { description?: string; mood?: string; personality?: readonly string[]; skills?: readonly { name: string; level: string }[]; roles?: readonly string[] }): void {
		if (agent?.description) lines.push(`Your role: ${agent.description}`);
		if (agent?.mood) lines.push(`Current mood: ${agent.mood}.`);
		if (agent?.personality && agent.personality.length > 0) lines.push(`Personality: ${agent.personality.join("; ")}.`);
		if (agent?.skills && agent.skills.length > 0) lines.push(`Core skills: ${agent.skills.slice(0, 5).map((s) => `${s.name} (${s.level})`).join(", ")}.`);
		if (agent?.roles && agent.roles.length > 0) lines.push(`Roles: ${agent.roles.join(", ")}.`);
	}

	private buildLocationSection(lines: string[], agentName: string): void {
		const myPos = this.agentPositions[agentName];
		const sceneInfo = SCENE_DESCRIPTIONS[myPos?.scene ?? "hub"] ?? SCENE_DESCRIPTIONS["hub"];
		lines.push("", `You are in ${sceneInfo.name}. ${sceneInfo.vibe}`, `Typical residents: ${sceneInfo.who}`);
	}

	private buildNearbySection(lines: string[], agentName: string): void {
		const nearby = this.getNearbyAgents(agentName);
		if (nearby.length === 0) return;
		lines.push("", `Nearby colleagues: ${nearby.map((n) => {
			const r = this.agentRoster.find((a) => a.name === n.name);
			const p = r?.persona ? ` "${r.persona}"` : "";
			return `${n.name}${p} (${r?.role ?? "team member"}, ${n.distance}px away)`;
		}).join(", ")}.`);
	}

	private getNearbyAgents(agentName: string, radius = 300): { name: string; distance: number }[] {
		const myPos = this.agentPositions[agentName];
		if (!myPos) return [];
		const nearby: { name: string; distance: number }[] = [];
		for (const [name, pos] of Object.entries(this.agentPositions)) {
			if (name === agentName || pos.scene !== myPos.scene) continue;
			const dist = Math.round(Math.sqrt((pos.x - myPos.x) ** 2 + (pos.y - myPos.y) ** 2));
			if (dist <= radius) nearby.push({ name, distance: dist });
		}
		return nearby.sort((a, b) => a.distance - b.distance);
	}

	getContentSnippet(): string | null {
		if (!this.activeFile) return null;
		return this.activeFile.content.slice(0, MAX_CONTENT_SNIPPET);
	}

	/* ── Subscription ── */

	onChange(cb: () => void): () => void {
		this.listeners.add(cb);
		return () => { this.listeners.delete(cb); };
	}

	/* ── Lifecycle ── */

	dispose(): void {
		this.worldStateWatcher?.close();
		this.worldStateWatcher = null;
		this.positionsWatcher?.close();
		this.positionsWatcher = null;
		for (const unsub of this.unsubs) unsub();
		this.unsubs.length = 0;
		this.listeners.clear();
		if (this.layoutTimer !== null) {
			clearTimeout(this.layoutTimer);
			this.layoutTimer = null;
		}
	}

	/* ── Getters (for testing / inspection) ── */

	getVersion(): number {
		return this.version;
	}

	getActiveFile(): FileContext | null {
		return this.activeFile;
	}

	getOpenFiles(): readonly string[] {
		return this.openFiles;
	}

	/* ── Internals ── */

	private refreshOpenFiles(): void {
		const files: string[] = [];
		this.deps.workspace.iterateAllLeaves((leaf) => { if (leaf.view.file?.path) files.push(leaf.view.file.path); });
		const prev = this.openFiles;
		this.openFiles = files;
		if (prev.length !== files.length || prev.some((f, i) => f !== files[i])) {
			this.recordChange("openFiles", `Open files: ${files.map((f) => this.toAbsolutePath(f)).join(", ")}`);
			this.notify();
		}
	}

	private recordChange(field: string, summary: string): void {
		this.version++;
		this.changeLog.push({ version: this.version, field, summary });
		if (this.changeLog.length > MAX_CHANGE_LOG) this.changeLog.splice(0, this.changeLog.length - MAX_CHANGE_LOG);
	}

	private notify(): void { for (const cb of this.listeners) { try { cb(); } catch { /* ignore */ } } }
}
