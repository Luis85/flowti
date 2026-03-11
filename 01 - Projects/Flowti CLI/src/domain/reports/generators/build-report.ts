/**
 * generate-build-report.ts
 *
 * Pure helper functions for build report generation.
 */

import type { CliDeps } from "../../../infrastructure/deps.js";

export type BuildReportDeps = Pick<CliDeps, "paths">;

export function humanBytes(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let i = 0;
	let n = bytes;
	while (n >= 1024 && i < units.length - 1) {
		n /= 1024;
		i++;
	}
	return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export function safeLocalTime(d: Date): string {
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface OutputEntry {
	file: string;
	bytes: number;
}

export interface ByteSummary {
	totalBytes: number;
	jsBytes: number;
	cssBytes: number;
	otherBytes: number;
	outputs: OutputEntry[];
}

export function collectOutputs(metafile: Record<string, unknown>, deps: BuildReportDeps): ByteSummary {
	const result: ByteSummary = { totalBytes: 0, jsBytes: 0, cssBytes: 0, otherBytes: 0, outputs: [] };
	const outputs = metafile?.outputs as Record<string, { bytes?: number }> | undefined;
	if (!outputs) return result;

	for (const [file, info] of Object.entries(outputs)) {
		const bytes = info.bytes || 0;
		result.totalBytes += bytes;
		if (file.endsWith(".js")) result.jsBytes += bytes;
		else if (file.endsWith(".css")) result.cssBytes += bytes;
		else result.otherBytes += bytes;
		result.outputs.push({ file: deps.paths.basename(file), bytes });
	}
	return result;
}

