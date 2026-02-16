/**
 * File operation helpers for catalog views.
 *
 * Opening files, creating event documentation, and source path resolution.
 */

import type { EventCatalogEntry } from "../../../infrastructure/events/catalog";
import type { IVaultQueryService } from "../../../infrastructure/services/VaultQueryService";
import type { IWorkspaceService } from "../../../infrastructure/services/WorkspaceService";
import type { IEventBus } from "../../../infrastructure/events/types";
import type { DiscoveredEvent } from "../../../domain/discovery/types";
import {
	getEventDocPathResolved,
	generateEventDocContent,
} from "../../eventDocTemplate";

export function getSourcePath(discoveredEvents: DiscoveredEvent[], eventName: string): string | undefined {
	return discoveredEvents.find((d) => d.eventName === eventName)?.sourcePath;
}

export async function openFile(workspace: IWorkspaceService, path: string): Promise<void> {
	await workspace.openFile(path);
}

export async function openOrCreateEventDoc(
	vaultQuery: IVaultQueryService,
	workspace: IWorkspaceService,
	eventBus: IEventBus,
	eventsFolder: string,
	entry: EventCatalogEntry,
): Promise<void> {
	const docPath = getEventDocPathResolved(eventsFolder, entry.type);

	if (vaultQuery.fileExists(docPath)) {
		await workspace.openFile(docPath);
		return;
	}

	// Create via DocService — it will emit doc.created when done
	const content = generateEventDocContent(entry);
	await eventBus.emit("doc.create", {
		docType: "EventDoc" as const,
		name: entry.type,
		path: docPath,
		content,
		source: "openOrCreateEventDoc",
	});

	// Try to open the newly created file
	if (vaultQuery.fileExists(docPath)) {
		await workspace.openFile(docPath);
	}
}
