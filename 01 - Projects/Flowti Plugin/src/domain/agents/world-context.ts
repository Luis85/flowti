/**
 * WorldContext — aggregates workspace state and serializes it for agent prompt injection.
 * Pure domain service with event-driven updates and delta tracking.
 */

import type { IContextProvider, FileContext } from "./context-provider.js";
import type { IEventBus } from "../../infrastructure/events/types.js";
import { watchJsonFile, type FileWatcher } from "../../infrastructure/agents/file-watcher.js";
import { readFileSync, existsSync } from "node:fs";

/* ── Minimal workspace interface (avoids importing full Obsidian Workspace) ── */

export interface WorkspaceDep {
	on(name: "layout-change", callback: () => void): { id: string };
	iterateAllLeaves(callback: (leaf: { view: { file?: { path: string } | null; getViewType(): string } }) => void): void;
}

export interface VaultAdapterDep {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
}

/* ── Supporting types ── */

export interface AgentRosterEntry {
	readonly name: string;
	readonly role: string;
	readonly status: "idle" | "busy";
	readonly task?: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly skills?: readonly string[];
}

export interface ProjectInfo {
	readonly name: string;
	readonly domains: string[];
}

export interface IterationInfo {
	readonly name: string;
	readonly phase?: string;
	readonly done: number;
	readonly total: number;
}

export interface CanvasInfo {
	readonly name: string;
	readonly description?: string;
}

export interface ActivityEntry {
	readonly text: string;
	readonly timestamp: number;
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

/* ── File type mapping ── */

const EXT_TYPE_MAP: Record<string, string> = {
	".ts": "TypeScript",
	".tsx": "TypeScript",
	".js": "JavaScript",
	".jsx": "JavaScript",
	".md": "Markdown",
	".json": "JSON",
	".css": "CSS",
	".canvas": "Canvas",
	".html": "HTML",
	".scss": "SCSS",
	".less": "LESS",
	".yaml": "YAML",
	".yml": "YAML",
	".xml": "XML",
	".svg": "SVG",
	".py": "Python",
	".rs": "Rust",
	".go": "Go",
	".sh": "Shell",
	".bat": "Batch",
	".ps1": "PowerShell",
};

function fileTypeFromPath(path: string): string {
	const dot = path.lastIndexOf(".");
	if (dot === -1) return "Unknown";
	const ext = path.slice(dot).toLowerCase();
	return EXT_TYPE_MAP[ext] ?? "Unknown";
}

function basename(path: string): string {
	const sep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	return sep === -1 ? path : path.slice(sep + 1);
}

function parentAndBasename(path: string): string {
	const sep = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	if (sep === -1) return path;
	const parent = path.slice(0, sep);
	const parentSep = Math.max(parent.lastIndexOf("/"), parent.lastIndexOf("\\"));
	const folder = parentSep === -1 ? parent : parent.slice(parentSep + 1);
	return `${folder}/${path.slice(sep + 1)}`;
}

function disambiguateFiles(paths: string[]): string[] {
	const names = paths.map(basename);
	const counts = new Map<string, number>();
	for (const n of names) counts.set(n, (counts.get(n) ?? 0) + 1);
	return paths.map((p, i) => {
		const n = names[i];
		return (counts.get(n) ?? 0) > 1 ? parentAndBasename(p) : n;
	});
}

function relativeAge(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s ago`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m ago`;
	const hr = Math.floor(min / 60);
	return `${hr}h ago`;
}

/* ── Minimal world-state types (mirrors CLI WorldState shape) ── */

interface WorldStateEntity {
	readonly id: string;
	readonly type: string;
	readonly components: Record<string, Record<string, unknown>>;
}

interface WorldStateActivityEntry {
	readonly agentName: string;
	readonly timestamp: string;
	readonly type: string;
	readonly summary: string;
}

interface WorldStateFile {
	readonly entities?: Record<string, WorldStateEntity>;
	readonly activityLog?: readonly WorldStateActivityEntry[];
}

interface AgentDashboardFile {
	readonly agents?: readonly {
		readonly name: string;
		readonly domain?: string;
		readonly status?: string;
	}[];
}

/* ── Constants ── */

const MAX_CHANGE_LOG = 50;
const MAX_CONTENT_SNIPPET = 500;
const DEBOUNCE_MS = 500;
const DELTA_FALLBACK_THRESHOLD = 10;

/** Scene descriptions — what each environment looks and feels like. */
const SCENE_DESCRIPTIONS: Record<string, { name: string; vibe: string; who: string }> = {
	hub: {
		name: "The Hub",
		vibe: "A central gathering hall with a dark floor and subtle grid pattern. Doorways along the right edge lead to other rooms. The mood is open and communal — this is where everyone crosses paths.",
		who: "General-purpose agents and anyone passing through.",
	},
	office: {
		name: "The Office",
		vibe: "A focused workspace with individual workstations. Monitors glow softly. The atmosphere is heads-down and productive — code gets written here.",
		who: "Engineering, QA, and DevOps agents.",
	},
	village: {
		name: "The Village",
		vibe: "An informal, collaborative space with workbenches instead of desks. Relaxed and creative — ideas flow freely, whiteboards are everywhere.",
		who: "Design, UX, and Product agents.",
	},
	station: {
		name: "The Station",
		vibe: "A coordination center with dashboards and planning boards. Structured but dynamic — schedules are tracked, decisions are made.",
		who: "Management, Delivery, and Coordination agents.",
	},
};

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

				this.recordChange("worldState", "World state updated");
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
			const raw = readFileSync(rosterPath, "utf-8");
			const data = JSON.parse(raw) as AgentDashboardFile;
			const agents = data.agents ?? [];
			if (agents.length === 0) return;
			this.agentRoster = agents.map((a) => ({
				name: a.name,
				role: a.domain ?? "general",
				persona: typeof (a as Record<string, unknown>).persona === "string" ? (a as Record<string, unknown>).persona as string : undefined,
				status: this.normalizeStatus(a.status ?? "idle"),
			}));
			this.recordChange("agentRoster", `Roster seeded: ${agents.length} agents from dashboard`);
		} catch {
			/* missing file or parse error — silently ignore */
		}
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

		// Active file + content
		if (this.activeFile) {
			const type = fileTypeFromPath(this.activeFile.path);
			const absPath = this.toAbsolutePath(this.activeFile.path);
			lines.push(`Active file: ${absPath} (${type})`);
			if (this.activeFile.content) {
				const snippet = this.activeFile.content.slice(0, MAX_CONTENT_SNIPPET);
				const truncated = snippet.length < this.activeFile.content.length ? `\n[... truncated at ${MAX_CONTENT_SNIPPET} chars, full file: ${this.activeFile.content.length} chars]` : "";
				lines.push(`\nContent of ${basename(this.activeFile.path)}:\n\`\`\`\n${snippet}${truncated}\n\`\`\``);
			}
		}

		// Open files (excluding active)
		if (this.openFiles.length > 0) {
			const activePath = this.activeFile?.path;
			const others = this.openFiles.filter((f) => f !== activePath);
			if (others.length > 0) {
				const absPaths = others.map((f) => this.toAbsolutePath(f));
				lines.push(`Also open: ${absPaths.join(", ")}`);
			}
		}

		// Canvas
		if (this.activeCanvas) {
			const desc = this.activeCanvas.description ? ` — ${this.activeCanvas.description}` : "";
			lines.push(`Canvas: "${this.activeCanvas.name}"${desc}`);
		}

		// Project
		if (this.projectInfo) {
			lines.push(`Project: ${this.projectInfo.name} — domains: ${this.projectInfo.domains.join(", ")}`);
		}

		// Iteration
		if (this.currentIteration) {
			const phase = this.currentIteration.phase ? ` ${this.currentIteration.phase}` : "";
			lines.push(`Iteration: "${this.currentIteration.name}"${phase} — ${this.currentIteration.done}/${this.currentIteration.total} done`);
		}

		// Team — each colleague with role, status, and skills
		if (this.agentRoster.length > 0) {
			lines.push("\nTeam:");
			for (const a of this.agentRoster) {
				const persona = a.persona ? ` "${a.persona}"` : "";
				const task = a.status === "busy" && a.task ? ` — working on "${a.task}"` : ` — ${a.status}`;
				const mood = a.mood ? `, ${a.mood}` : "";
				const skills = a.skills && a.skills.length > 0 ? ` [${a.skills.join(", ")}]` : "";
				lines.push(`- ${a.name}${persona} (${a.role}${mood}${task})${skills}`);
			}
		}

		// Recent activity
		if (this.recentActivity.length > 0) {
			const now = Date.now();
			const recent = this.recentActivity.slice(0, 3).map(
				(a) => `${a.text} ${relativeAge(now - a.timestamp)}`
			);
			lines.push(`Recent: ${recent.join("; ")}`);
		}

		return lines.join("\n");
	}

	serializeDelta(agentName: string): string | null {
		const lastSeen = this.agentVersions.get(agentName) ?? 0;
		if (lastSeen >= this.version) return null;

		const changes = this.changeLog.filter((c) => c.version > lastSeen);
		if (changes.length === 0) return null;

		// Fall back to full snapshot if too many changes accumulated
		if (changes.length > DELTA_FALLBACK_THRESHOLD) {
			return this.serialize();
		}

		const lines = [`[World Context — Delta for ${agentName}]`];
		for (const c of changes) {
			lines.push(`- ${c.summary}`);
		}
		return lines.join("\n");
	}

	markSeen(agentName: string): void {
		this.agentVersions.set(agentName, this.version);
	}

	getProtocolInstruction(agentName: string, domain: string, agent?: { persona?: string; mood?: string; personality?: readonly string[]; skills?: readonly { name: string; level: string }[]; roles?: readonly string[]; description?: string }): string {
		const persona = agent?.persona ?? agentName;
		const lines: string[] = [];

		lines.push(`You ARE ${persona}, a ${domain} specialist. Stay in character at all times — never break the fourth wall, never mention being an AI or LLM.`);

		if (agent?.description) {
			lines.push(`Your role: ${agent.description}`);
		}

		if (agent?.mood) {
			lines.push(`Current mood: ${agent.mood}.`);
		}

		if (agent?.personality && agent.personality.length > 0) {
			lines.push(`Personality: ${agent.personality.join("; ")}.`);
		}

		if (agent?.skills && agent.skills.length > 0) {
			const top = agent.skills.slice(0, 5).map((s) => `${s.name} (${s.level})`).join(", ");
			lines.push(`Core skills: ${top}.`);
		}

		if (agent?.roles && agent.roles.length > 0) {
			lines.push(`Roles: ${agent.roles.join(", ")}.`);
		}

		// Scene / environment awareness
		const myPos = this.agentPositions[agentName];
		const scene = myPos?.scene ?? "hub";
		const sceneInfo = SCENE_DESCRIPTIONS[scene] ?? SCENE_DESCRIPTIONS["hub"];
		lines.push("");
		lines.push(`You are in ${sceneInfo.name}. ${sceneInfo.vibe}`);
		lines.push(`Typical residents: ${sceneInfo.who}`);

		// Nearby colleagues (from spatial positions)
		const nearby = this.getNearbyAgents(agentName);
		if (nearby.length > 0) {
			lines.push("");
			lines.push(`Nearby colleagues: ${nearby.map((n) => {
				const roster = this.agentRoster.find((a) => a.name === n.name);
				const role = roster?.role ?? "team member";
				const persona = roster?.persona ? ` "${roster.persona}"` : "";
				return `${n.name}${persona} (${role}, ${n.distance}px away)`;
			}).join(", ")}.`);
		}

		lines.push("");
		lines.push("Communication rules:");
		lines.push("- Keep responses SHORT. One to three sentences unless asked for detail.");
		lines.push("- Speak in first person as yourself. Be direct and natural.");
		lines.push("- The person you're talking to is the Director — they oversee and steer the project. Never call them \"user\" or \"human\". Address them directly or refer to them as \"boss\", \"chief\", or simply \"you\".");
		lines.push("- If you need something from the Director, say so clearly and specifically.");
		lines.push("- Do NOT repeat or echo context that was provided to you. Just use it to inform your response.");
		lines.push("- Respond with plain text only. No markdown, no code fences, no JSON wrapping.");

		return lines.join("\n");
	}

	/** Get agents within proximity of the given agent, sorted by distance. */
	private getNearbyAgents(agentName: string, radius = 300): { name: string; distance: number }[] {
		const myPos = this.agentPositions[agentName];
		if (!myPos) return [];
		const nearby: { name: string; distance: number }[] = [];
		for (const [name, pos] of Object.entries(this.agentPositions)) {
			if (name === agentName) continue;
			if (pos.scene !== myPos.scene) continue;
			const dx = pos.x - myPos.x;
			const dy = pos.y - myPos.y;
			const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
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
		this.deps.workspace.iterateAllLeaves((leaf) => {
			if (leaf.view.file?.path) {
				files.push(leaf.view.file.path);
			}
		});
		const prev = this.openFiles;
		this.openFiles = files;
		if (prev.length !== files.length || prev.some((f, i) => f !== files[i])) {
			const absPaths = files.map((f) => this.toAbsolutePath(f));
			this.recordChange("openFiles", `Open files: ${absPaths.join(", ")}`);
			this.notify();
		}
	}

	private recordChange(field: string, summary: string): void {
		this.version++;
		this.changeLog.push({ version: this.version, field, summary });
		if (this.changeLog.length > MAX_CHANGE_LOG) {
			this.changeLog.splice(0, this.changeLog.length - MAX_CHANGE_LOG);
		}
	}

	private notify(): void {
		for (const cb of this.listeners) {
			try { cb(); } catch { /* listener errors do not propagate */ }
		}
	}
}
