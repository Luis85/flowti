/**
 * args.mjs — CLI argument parsing.
 */

export function parseArgs(args) {
	const result = { command: null, flags: {} };
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
