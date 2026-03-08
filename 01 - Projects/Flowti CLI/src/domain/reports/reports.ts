/**
 * reports.ts — Non-interactive report commands.
 *
 * Commands resolve scripts and paths from the project's flowti.config.json.
 * The interactive Reports menu lives in mainMenu.ts.
 */

import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { shell } from "../../infrastructure/shell.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";

// ── Non-interactive commands ────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	reports: (_f, _r, _c, p) => {
		const cmd = p?.config.reports?.allCommand ?? p?.config.tools?.["reports"] ?? "npm run generate:reports";
		shell.run(cmd, { cwd: p?.path, label: "Generating all reports..." });
	},
	"reports:audit": (_f, _r, _c, p) => {
		const cmd = p?.config.reports?.allCommand ?? p?.config.tools?.["reports"] ?? "npm run generate:reports";
		shell.run(cmd, { cwd: p?.path, label: "Generating reports for audit..." });
		log(`  ${GREEN}✓${RESET} Reports generated. Use interactive mode for full audit.\n`);
	},
	"report:*": (_flags, _rawArgs, command, p) => {
		const reportId = command!.substring("report:".length);
		const generators = p?.config.reports?.generators ?? [];
		const gen = generators.find((g) => g.label.toLowerCase().replace(/\s+/g, "-") === reportId || g.command.includes(reportId));
		if (gen) {
			shell.run(gen.command, { cwd: p?.path, label: `Generating ${gen.label}...` });
		} else {
			log(`\n  ${RED}Unknown report: ${reportId}${RESET}`);
			log(`  ${DIM}Available: ${generators.map((g) => g.label).join(", ") || "(none configured)"}${RESET}\n`);
		}
	},
};
