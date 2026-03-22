/**
 * process-registry.ts — Generic process registry (domain layer).
 *
 * Persists ProcessEntry records as JSON in .flowti/var/processes/.
 * Liveness checks and kill delegate to deps.pidOps (infrastructure).
 */

import type { ProcessDeps } from "../../infrastructure/deps.js";

export interface StorybookMeta {
	readonly framework: string;
	readonly configDir: string;
}

export interface LlmMeta {
	readonly provider: string;
	readonly sessionId?: string;
}

export interface ProcessEntry {
	readonly type: string;
	readonly name: string;
	readonly pid: number;
	readonly port?: number;
	readonly url?: string;
	readonly startedAt: string;
	readonly meta?: StorybookMeta | LlmMeta;
}

const REGISTRY_DIR = ".flowti/var/processes";

function safeName(s: string): string {
	return s.replace(/[/\\:*?"<>|]/g, "_");
}

function entryPath(deps: ProcessDeps, type: string, name: string): string {
	return deps.paths.join(REGISTRY_DIR, `${safeName(type)}-${safeName(name)}.json`);
}

function ensureDir(deps: ProcessDeps): void {
	deps.disk.mkdirSync(REGISTRY_DIR, { recursive: true });
}

/** Read and validate a single entry file. Returns null if missing, corrupt, or stale (PID dead). Cleans up stale files. */
function readEntry(deps: ProcessDeps, filePath: string): ProcessEntry | null {
	try {
		const raw = deps.disk.readFileSync(filePath, "utf-8");
		const entry = JSON.parse(raw) as ProcessEntry;
		if (!deps.pidOps.isPidAlive(entry.pid)) {
			try { deps.disk.unlinkSync(filePath); } catch { /* ok */ }
			return null;
		}
		return entry;
	} catch {
		return null;
	}
}

export function registerProcess(deps: ProcessDeps, entry: ProcessEntry): void {
	ensureDir(deps);
	const target = entryPath(deps, entry.type, entry.name);
	const tmp = target + ".tmp";
	deps.disk.writeFileSync(tmp, JSON.stringify(entry), "utf-8");
	deps.disk.renameSync(tmp, target);
}

export function unregisterProcess(deps: ProcessDeps, type: string, name: string): void {
	const path = entryPath(deps, type, name);
	try { deps.disk.unlinkSync(path); } catch { /* already gone */ }
}

export function getProcess(deps: ProcessDeps, type: string, name: string): ProcessEntry | null {
	return readEntry(deps, entryPath(deps, type, name));
}

export function listProcesses(deps: ProcessDeps, type?: string): ProcessEntry[] {
	ensureDir(deps);
	const files = deps.disk.readdirSync(REGISTRY_DIR).filter((f) => f.endsWith(".json") && !f.endsWith(".tmp"));
	const entries: ProcessEntry[] = [];
	for (const file of files) {
		const entry = readEntry(deps, deps.paths.join(REGISTRY_DIR, file));
		if (!entry) continue;
		if (type && entry.type !== type) continue;
		entries.push(entry);
	}
	return entries;
}

export function killProcess(deps: ProcessDeps, type: string, name: string): boolean {
	const entry = getProcess(deps, type, name);
	if (!entry) return false;
	const killed = deps.pidOps.killPid(entry.pid);
	unregisterProcess(deps, type, name);
	return killed;
}
