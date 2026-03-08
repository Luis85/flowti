/**
 * output.ts — Structured output support for non-interactive commands.
 *
 * Provides a thin helper for commands that support --format=json.
 * When format is "json", data is printed as a single JSON line.
 * Otherwise, the human-readable renderer is called.
 */

import { log } from "./logger.js";

export type OutputFormat = "text" | "json";

/**
 * Resolve the output format from command flags.
 * Returns "json" when --format=json is specified, "text" otherwise.
 */
export function resolveFormat(flags: Record<string, string | boolean>): OutputFormat {
	return flags.format === "json" ? "json" : "text";
}

/**
 * Print data as JSON (for machine consumption) or call a human renderer.
 */
export function printOutput<T>(
	format: OutputFormat,
	data: T,
	humanRenderer: (data: T) => void,
): void {
	if (format === "json") {
		log(JSON.stringify(data));
	} else {
		humanRenderer(data);
	}
}
