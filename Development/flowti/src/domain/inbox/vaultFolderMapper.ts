/**
 * Pure mapper for vault folder inbox items.
 *
 * Maps an untyped note detected in a watched vault folder
 * to an InboxItem. Exports source constants used by InboxService.
 */

import type { InboxItem } from "./types";

/** Source event constant for vault folder inbox items. */
export const VAULT_FOLDER_SOURCE_EVENT = "inbox.vaultFolder.noteDetected";
export const VAULT_FOLDER_SOURCE_HUB = "vault-folder";

/**
 * Maps a detected untyped vault folder note to an InboxItem.
 * Pure function — no side effects, no dependencies.
 */
export function mapVaultFolderNote(
	payload: { path: string; title: string; folder: string },
	id: string,
): InboxItem {
	return {
		id,
		type: "action",
		title: payload.title,
		description: `Untyped note in ${payload.folder}: ${payload.path}`,
		sourceEvent: VAULT_FOLDER_SOURCE_EVENT,
		sourceHub: VAULT_FOLDER_SOURCE_HUB,
		timestamp: new Date().toISOString(),
		read: false,
	};
}
