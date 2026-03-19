/**
 * WorldContext — aggregates workspace state and serializes it for agent prompt injection.
 * Pure domain service with event-driven updates and delta tracking.
 */

import type { IContextProvider, FileContext } from "./context-provider.js";
import type { IEventBus } from "../../infrastructure/events/types.js";

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

/* ── Constants ── */

const MAX_CHANGE_LOG = 50;
const MAX_CONTENT_SNIPPET = 500;
const DEBOUNCE_MS = 500;
const DELTA_FALLBACK_THRESHOLD = 10;

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
	private recentActivity: ActivityEntry[] = [];

	/* ── Version tracking ── */
	private version = 0;
	private readonly agentVersions = new Map<string, number>();
	private readonly changeLog: ChangeEntry[] = [];

	/* ── Debounce ── */
	private layoutTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(deps: WorldContextDeps) {
		this.deps = deps;

		// Subscribe to file changes from context provider
		const unsubFile = deps.contextProvider.onFileChanged((ctx: FileContext) => {
			this.activeFile = ctx;
			this.recordChange("activeFile", `Active file: ${basename(ctx.path)}`);
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

	serialize(): string {
		const lines: string[] = ["[World Context — Snapshot]"];

		// Active file
		if (this.activeFile) {
			const type = fileTypeFromPath(this.activeFile.path);
			lines.push(`Active: ${this.activeFile.path} (${type})`);
		}

		// Open files
		if (this.openFiles.length > 0) {
			const display = disambiguateFiles(this.openFiles);
			lines.push(`Open: ${display.join(", ")}`);
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

		// Team
		if (this.agentRoster.length > 0) {
			const entries = this.agentRoster.map((a) => {
				const task = a.status === "busy" && a.task ? `, busy: "${a.task}"` : `, ${a.status}`;
				return `${a.name} (${a.role}${task})`;
			});
			lines.push(`Team: ${entries.join(", ")}`);
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

	getProtocolInstruction(agentName: string, domain: string): string {
		return `You are ${agentName}, operating in the ${domain} domain. Respond concisely and stay within your area of expertise.`;
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
			this.recordChange("openFiles", `Open files: ${files.length}`);
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
