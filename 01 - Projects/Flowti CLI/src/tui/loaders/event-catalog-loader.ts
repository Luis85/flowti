/**
 * event-catalog-loader.ts — Event catalog loader.
 *
 * Lists all project events via the event-catalog domain service.
 */

import type { LoaderContext } from "./loader-types.js";
import { listEvents } from "../../domain/events/event-catalog.js";

export interface EventEntry {
	readonly name: string;
	readonly domain: string;
	readonly version: string;
	readonly file: string;
}

export interface EventCatalogData {
	readonly events: readonly EventEntry[];
}

export function loadEventCatalog(ctx: LoaderContext): EventCatalogData {
	const { deps, projectPath } = ctx;
	if (!projectPath) return { events: [] };

	try {
		const events = listEvents(deps, projectPath);
		return { events };
	} catch { return { events: [] }; }
}
