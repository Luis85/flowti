/**
 * args.ts — CLI argument parsing.
 */

import type { ParsedArgs } from "./types.js";

export function parseArgs(args: string[]): ParsedArgs {
	const result: ParsedArgs = { command: null, flags: {} };
	for (const arg of args) {
		if (arg.startsWith("--")) {
			const eq = arg.indexOf("=");
			if (eq !== -1) {
				result.flags[arg.substring(2, eq)] = arg.substring(eq + 1);
			} else {
				result.flags[arg.substring(2)] = true;
			}
		} else if (!result.command) {
			result.command = arg;
		}
	}
	return result;
}
