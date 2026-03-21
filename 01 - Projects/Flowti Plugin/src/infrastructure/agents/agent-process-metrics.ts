/**
 * Sample RSS memory and approximate CPU% for a child OS process (agent CLI).
 *
 * Used by the agent world Monitor tab. Windows uses TotalProcessorTime deltas;
 * Linux uses /proc/pid/stat jiffies; macOS uses ps %cpu snapshot.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { cpus } from "node:os";

import { isProcessAlive } from "./cli-executor-helpers.js";

export interface AgentProcessResources {
	readonly pid: number;
	/** Resident set size (bytes), or null if unavailable. */
	readonly rssBytes: number | null;
	/** Approximate CPU usage (% of one core) since the previous sample. */
	readonly cpuPercent: number | null;
	readonly sampledAt: number;
}

/** wallMs + integral for CPU% (Windows: processor ms, Linux: jiffies). */
const cpuPrev = new Map<number, { wallMs: number; integral: number }>();

const LINUX_JIFFIES_PER_SEC = 100;

function deleteCpuPrev(pid: number): void {
	cpuPrev.delete(pid);
}

function windowsSample(pid: number): { rssBytes: number | null; cpuMs: number | null } {
	try {
		const out = execFileSync(
			"powershell.exe",
			[
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				`$p = Get-Process -Id ${pid} -ErrorAction Stop; Write-Output $p.WorkingSet64; Write-Output ([int64]$p.TotalProcessorTime.TotalMilliseconds)`,
			],
			{ encoding: "utf-8", timeout: 5000, windowsHide: true },
		).trim();
		const lines = out.split(/\r?\n/).filter((l) => l.length > 0);
		const rss = lines[0] ? parseInt(lines[0], 10) : NaN;
		const cpu = lines[1] ? parseInt(lines[1], 10) : NaN;
		return {
			rssBytes: Number.isFinite(rss) ? rss : null,
			cpuMs: Number.isFinite(cpu) ? cpu : null,
		};
	} catch {
		return { rssBytes: null, cpuMs: null };
	}
}

/** Linux utime+stime jiffies from /proc/[pid]/stat. */
function linuxCpuJiffies(pid: number): number | null {
	try {
		const line = readFileSync(`/proc/${pid}/stat`, "utf-8");
		const rp = line.lastIndexOf(")");
		if (rp < 0) return null;
		const rest = line.slice(rp + 2).trimStart().split(/\s+/);
		const utime = parseInt(rest[11] ?? "", 10);
		const stime = parseInt(rest[12] ?? "", 10);
		if (!Number.isFinite(utime) || !Number.isFinite(stime)) return null;
		return utime + stime;
	} catch {
		return null;
	}
}

function linuxRssBytes(pid: number): number | null {
	try {
		const kb = parseInt(
			execFileSync("ps", ["-p", String(pid), "-o", "rss="], {
				encoding: "utf-8",
				timeout: 4000,
				windowsHide: true,
			}).trim(),
			10,
		);
		return Number.isFinite(kb) ? kb * 1024 : null;
	} catch {
		return null;
	}
}

function darwinSample(pid: number): { rssBytes: number | null; psCpu: number | null } {
	try {
		const out = execFileSync("ps", ["-p", String(pid), "-o", "rss=,%cpu="], {
			encoding: "utf-8",
			timeout: 4000,
			windowsHide: true,
		}).trim();
		const parts = out.split(/\s+/).filter(Boolean);
		const rssKb = parts[0] ? parseInt(parts[0], 10) : NaN;
		const cpu = parts[1] ? parseFloat(parts[1]) : NaN;
		return {
			rssBytes: Number.isFinite(rssKb) ? rssKb * 1024 : null,
			psCpu: Number.isFinite(cpu) ? cpu : null,
		};
	} catch {
		return { rssBytes: null, psCpu: null };
	}
}

/**
 * Sample current RSS and CPU for an agent child PID.
 * Call every 1–3s; CPU% compares to the previous call for this pid.
 */
export function sampleAgentProcessResources(pid: number): AgentProcessResources {
	const sampledAt = Date.now();

	if (!isProcessAlive(pid)) {
		deleteCpuPrev(pid);
		return { pid, rssBytes: null, cpuPercent: null, sampledAt };
	}

	let rssBytes: number | null = null;
	let cpuPercent: number | null = null;

	if (process.platform === "win32") {
		const { rssBytes: rss, cpuMs } = windowsSample(pid);
		rssBytes = rss;
		const prev = cpuPrev.get(pid);
		if (prev != null && cpuMs != null) {
			const deltaCpu = cpuMs - prev.integral;
			const deltaWall = (sampledAt - prev.wallMs) / 1000;
			if (deltaWall > 0.05 && deltaCpu >= 0) {
				const nCpus = Math.max(1, cpus().length);
				cpuPercent = Math.min(999, (deltaCpu / 1000 / deltaWall / nCpus) * 100);
			}
		}
		if (cpuMs != null) {
			cpuPrev.set(pid, { wallMs: sampledAt, integral: cpuMs });
		} else {
			deleteCpuPrev(pid);
		}
		return { pid, rssBytes, cpuPercent, sampledAt };
	}

	if (process.platform === "linux") {
		rssBytes = linuxRssBytes(pid);
		const jiffies = linuxCpuJiffies(pid);
		const prev = cpuPrev.get(pid);
		if (prev != null && jiffies != null) {
			const deltaJ = jiffies - prev.integral;
			const deltaWall = (sampledAt - prev.wallMs) / 1000;
			if (deltaWall > 0.05 && deltaJ >= 0) {
				const cpuSeconds = deltaJ / LINUX_JIFFIES_PER_SEC;
				const nCpus = Math.max(1, cpus().length);
				cpuPercent = Math.min(999, (cpuSeconds / deltaWall / nCpus) * 100);
			}
		}
		if (jiffies != null) {
			cpuPrev.set(pid, { wallMs: sampledAt, integral: jiffies });
		} else {
			deleteCpuPrev(pid);
		}
		return { pid, rssBytes, cpuPercent, sampledAt };
	}

	// darwin and other unix
	const { rssBytes: rss, psCpu } = darwinSample(pid);
	rssBytes = rss;
	cpuPercent = psCpu;
	return { pid, rssBytes, cpuPercent, sampledAt };
}
