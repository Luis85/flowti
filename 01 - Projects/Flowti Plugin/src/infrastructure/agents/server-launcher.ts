/**
 * Launches the Flowti CLI server (`flowti serve`) as a background process.
 *
 * Strategy:
 * - Spawns `node .flowti/bin serve` from the vault root
 * - Writes a PID registry at `.flowti/var/server-registry.json`
 * - Polls the health endpoint until the server responds
 * - Returns once healthy or after timeout
 * - Process is detached so it survives plugin reload
 * - On next startup, stale registry entries can be detected and cleaned up
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";

export interface LaunchResult {
	ok: boolean;
	error?: string;
	pid?: number;
}

export interface ServerRegistryEntry {
	pid: number;
	url: string;
	startedAt: string;
	vaultPath: string;
}

const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 15_000;

function registryPath(vaultPath: string): string {
	return join(vaultPath, ".flowti", "var", "server-registry.json");
}

/** Read the current server registry. Returns null if no file or invalid. */
export function readServerRegistry(vaultPath: string): ServerRegistryEntry | null {
	const path = registryPath(vaultPath);
	if (!existsSync(path)) return null;
	try {
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw) as ServerRegistryEntry;
	} catch {
		return null;
	}
}

/** Write a server registry entry. */
function writeServerRegistry(vaultPath: string, entry: ServerRegistryEntry): void {
	const path = registryPath(vaultPath);
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	writeFileSync(path, JSON.stringify(entry, null, "\t"), "utf-8");
}

/** Remove the registry file. */
export function clearServerRegistry(vaultPath: string): void {
	const path = registryPath(vaultPath);
	try { unlinkSync(path); } catch { /* already gone */ }
}

/** Create a registry entry for an externally started server (no PID known). */
export function writeServerRegistryForExisting(vaultPath: string, url: string): void {
	writeServerRegistry(vaultPath, {
		pid: 0,
		url,
		startedAt: new Date().toISOString(),
		vaultPath,
	});
}

/** Kill a server process by PID. Cross-platform: uses taskkill on Windows, SIGTERM elsewhere. */
export function killServer(pid: number): boolean {
	try {
		if (process.platform === "win32") {
			execSync(`taskkill /F /PID ${pid}`, { windowsHide: true, timeout: 5000 });
		} else {
			process.kill(pid, "SIGTERM");
		}
		return true;
	} catch {
		return false;
	}
}

/** Get current server status from registry. Trusts the file — use probeServer() for liveness. */
export function getServerStatus(vaultPath: string): { running: boolean; entry: ServerRegistryEntry | null } {
	const entry = readServerRegistry(vaultPath);
	if (!entry) return { running: false, entry: null };
	return { running: true, entry };
}

/** Async liveness check via HTTP probe. Cleans stale registry if server is gone. */
export async function probeServer(vaultPath: string): Promise<boolean> {
	const entry = readServerRegistry(vaultPath);
	if (!entry) return false;
	try {
		const res = await fetch(`${entry.url}/api/world-state`);
		return res.ok;
	} catch {
		clearServerRegistry(vaultPath);
		return false;
	}
}

export async function launchCliServer(vaultPath: string, baseUrl: string): Promise<LaunchResult> {
	const binDir = join(vaultPath, ".flowti", "bin");

	const hasBinary = existsSync(join(binDir, "main.mjs")) || existsSync(join(binDir, "index.mjs"));
	if (!hasBinary) {
		return { ok: false, error: "CLI not built. Run the Flowti CLI build first." };
	}

	// Check if server is already running (via registry or probe)
	const status = getServerStatus(vaultPath);
	if (status.running) {
		try {
			const probe = await fetch(`${status.entry!.url}/api/world-state`);
			if (probe.ok) return { ok: true, pid: status.entry!.pid };
		} catch {
			// Registry says alive but HTTP fails — kill stale and respawn
			killServer(status.entry!.pid);
			clearServerRegistry(vaultPath);
		}
	}

	// Probe without registry (someone started it externally)
	try {
		const probe = await fetch(`${baseUrl}/api/world-state`);
		if (probe.ok) return { ok: true };
	} catch {
		// Not running — proceed to spawn
	}

	const nodeBin = findNodeBinary();
	if (!nodeBin) {
		return { ok: false, error: "Node.js not found on PATH. Install Node.js to run the CLI server." };
	}

	let child: ChildProcess;
	try {
		child = spawn(nodeBin, [binDir, "serve"], {
			cwd: vaultPath,
			detached: true,
			stdio: "ignore",
			windowsHide: true,
		});
		child.unref();
	} catch (err) {
		return { ok: false, error: `Failed to start server: ${err instanceof Error ? err.message : String(err)}` };
	}

	const pid = child.pid ?? 0;

	// Write registry immediately so we can track the process
	if (pid > 0) {
		writeServerRegistry(vaultPath, {
			pid,
			url: baseUrl,
			startedAt: new Date().toISOString(),
			vaultPath,
		});
	}

	// Poll until the server responds
	const deadline = Date.now() + MAX_WAIT_MS;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${baseUrl}/api/world-state`);
			if (res.ok) return { ok: true, pid };
		} catch {
			// Not ready yet
		}
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}

	return { ok: false, error: "Server started but did not become healthy within 15 seconds.", pid };
}

/** Resolve the system Node.js binary path. Cached after first lookup. */
let cachedNodeBin: string | null | undefined;
function findNodeBinary(): string | null {
	if (cachedNodeBin !== undefined) return cachedNodeBin;
	try {
		const cmd = process.platform === "win32" ? "where node" : "which node";
		const result = execSync(cmd, { encoding: "utf-8", timeout: 5000, windowsHide: true }).trim();
		cachedNodeBin = result.split(/\r?\n/)[0] || null;
	} catch {
		cachedNodeBin = null;
	}
	return cachedNodeBin;
}
