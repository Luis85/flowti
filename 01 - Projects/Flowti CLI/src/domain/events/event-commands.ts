/**
 * event-commands.ts — Non-interactive CLI commands for the Event Catalog.
 */

import { paths } from "../../infrastructure/paths.js";
import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import { resolveFormat, printOutput } from "../../infrastructure/output.js";
import { listEvents, createEventFile, parseCommaSeparated } from "./event-catalog.js";
import type { EventDefinition } from "./event-catalog.js";
import { parsePayloadFlag } from "./event-payload.js";
import { versionCommands } from "./event-versioning.js";
import { saveEventFlowDoc } from "./event-flow.js";

// ── Flag helpers ──────────────────────────────────────────────────

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

function flagList(flags: Record<string, string | boolean>, key: string): string[] {
	return typeof flags[key] === "string" ? parseCommaSeparated(flags[key]) : [];
}

// ── Commands ──────────────────────────────────────────────────────

export const commands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	"events:list": (flags, _rawArgs, _command, project) => {
		if (!project) return;
		const events = listEvents(project.path);
		const format = resolveFormat(flags);
		if (format === "json") {
			printOutput(format, events, () => {});
			return;
		}
		if (events.length === 0) { log(`\n  ${DIM}No events defined.${RESET}\n`); return; }
		for (const evt of events) log(`  ${evt.name} [${evt.domain}] v${evt.version}`);
	},
	"events:flow": (flags, _rawArgs, _command, project) => {
		if (!project) return;
		const domain = typeof flags.domain === "string" ? flags.domain : undefined;
		log(`\n  ${GREEN}✓${RESET} Generated: ${paths.relative(project.path, saveEventFlowDoc(project.path, domain))}\n`);
	},
	"events:add": (flags, _rawArgs, _command, project) => {
		if (!project) return;
		const name = flags.name;
		if (!name || typeof name !== "string") {
			log(`\n  ${RED}Missing --name flag.${RESET}`);
			log(`  ${DIM}Usage: flowti events:add --name="user.created" --domain="user"${RESET}\n`);
			return;
		}
		const payload = typeof flags.payload === "string" ? parsePayloadFlag(flags.payload) : [];
		const def: EventDefinition = {
			name, domain: flagStr(flags, "domain", "core"), version: flagStr(flags, "version", "1.0.0"),
			description: flagStr(flags, "description", ""), producers: flagList(flags, "producers"),
			consumers: flagList(flags, "consumers"), payload,
		};
		const filePath = createEventFile(project.path, def);
		if (filePath) log(`\n  ${GREEN}✓${RESET} Created: ${paths.relative(project.path, filePath)}\n`);
	},
	...versionCommands,
};
