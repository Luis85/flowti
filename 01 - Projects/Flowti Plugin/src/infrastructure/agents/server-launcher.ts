/**
 * Launches the Flowti CLI server (`flowti serve`) as a background process.
 *
 * Strategy:
 * - Spawns `node .flowti/bin serve` from the vault root
 *   (Node resolves the directory via package.json → index.mjs,
 *    matching how flowti.cmd works)
 * - Polls the health endpoint until the server responds
 * - Returns once healthy or after timeout
 * - Process is detached so it survives plugin reload
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface LaunchResult {
	ok: boolean;
	error?: string;
}

const POLL_INTERVAL_MS = 500;
const MAX_WAIT_MS = 15_000;

export async function launchCliServer(vaultPath: string, baseUrl: string): Promise<LaunchResult> {
	const binDir = join(vaultPath, ".flowti", "bin");

	// The CLI builds to main.mjs; the directory has a package.json with "main": "index.mjs"
	// which acts as the bootstrap. Check for either file to confirm the CLI is built.
	const hasBinary = existsSync(join(binDir, "main.mjs")) || existsSync(join(binDir, "index.mjs"));

	if (!hasBinary) {
		return { ok: false, error: "CLI not built. Run the Flowti CLI build first." };
	}

	// Check if server is already running
	try {
		const probe = await fetch(`${baseUrl}/api/world-state`);
		if (probe.ok) return { ok: true };
	} catch {
		// Not running — proceed to spawn
	}

	// In Obsidian, process.execPath points to Obsidian.exe, not node.exe.
	// Resolve the system Node.js binary from PATH instead.
	const nodeBin = findNodeBinary();
	if (!nodeBin) {
		return { ok: false, error: "Node.js not found on PATH. Install Node.js to run the CLI server." };
	}

	// Spawn detached so the server outlives the plugin.
	// Uses binDir as the entry point — Node resolves via package.json "main" field,
	// just like `flowti.cmd` does: `node .flowti/bin serve`
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

	// Poll until the server responds
	const deadline = Date.now() + MAX_WAIT_MS;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(`${baseUrl}/api/world-state`);
			if (res.ok) return { ok: true };
		} catch {
			// Not ready yet
		}
		await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
	}

	return { ok: false, error: "Server started but did not become healthy within 15 seconds." };
}

/** Resolve the system Node.js binary path. Cached after first lookup. */
let cachedNodeBin: string | null | undefined;
function findNodeBinary(): string | null {
	if (cachedNodeBin !== undefined) return cachedNodeBin;
	try {
		const cmd = process.platform === "win32" ? "where node" : "which node";
		const result = execSync(cmd, { encoding: "utf-8", timeout: 5000, windowsHide: true }).trim();
		// `where` on Windows can return multiple lines — take the first
		cachedNodeBin = result.split(/\r?\n/)[0] || null;
	} catch {
		cachedNodeBin = null;
	}
	return cachedNodeBin;
}
