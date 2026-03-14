/**
 * event-catalog-menu.ts — Interactive event catalog menu.
 *
 * Moved from domain/events/event-catalog.ts to separate display
 * concerns from pure domain logic.
 */

import { RESET, DIM, GREEN, CYAN, BOLD, printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import { listEvents, createEventFile, parseCommaSeparated } from "../../domain/events/event-catalog.js";
import type { EventDefinition } from "../../domain/events/event-catalog.js";
import { collectPayloadFields, collectVersioningInfo } from "../../domain/events/event-payload.js";

// ── Interactive flow ───────────────────────────────────────────────

export async function addEventInteractive(projectPath: string, deps: MenuDeps): Promise<void> {
	const { input, log, paths } = deps;
	printHeader("Add Event");

	const name = await input.ask("Event name");
	if (!name) return;

	const domain = await input.ask("Domain", "core");
	const version = await input.ask("Version", "1.0.0");
	const description = await input.ask("Description", "");
	const producersRaw = await input.ask("Producers (comma-separated)", "");
	const consumersRaw = await input.ask("Consumers (comma-separated)", "");
	const payload = await collectPayloadFields(input);
	const versioning = await collectVersioningInfo(input);

	const def: EventDefinition = {
		name,
		domain,
		version,
		description,
		producers: parseCommaSeparated(producersRaw),
		consumers: parseCommaSeparated(consumersRaw),
		payload,
		...versioning,
	};

	const filePath = createEventFile(deps, projectPath, def);
	if (filePath) {
		const relPath = paths.relative(projectPath, filePath);
		log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
	}
}

export function listEventsInteractive(projectPath: string, deps: MenuDeps): void {
	const { log } = deps;
	const events = listEvents(deps, projectPath);

	if (events.length === 0) {
		log(`\n  ${DIM}No events defined yet. Use "Add Event" to create one.${RESET}\n`);
		return;
	}

	log(`\n  ${BOLD}Events (${events.length})${RESET}\n`);
	for (const evt of events) {
		const domainTag = evt.domain ? ` ${DIM}[${evt.domain}]${RESET}` : "";
		log(`  ${CYAN}▸${RESET} ${evt.name}${domainTag} ${DIM}v${evt.version}${RESET}`);
	}
	log("");
}
