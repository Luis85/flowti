/**
 * Event types owned by the Inbox domain.
 */

import type { InboxItem } from "./types";

export interface InboxEventMap {
	/** Emitted after inbox state is loaded from storage */
	"inbox.loaded": { items: InboxItem[]; unreadCount: number };
	/** Emitted when a new item is added to the inbox */
	"inbox.itemAdded": { item: InboxItem };
	/** Emitted when inbox items change (mark read, dismiss, clear) */
	"inbox.itemsChanged": { items: InboxItem[]; unreadCount: number };
	/** Command: request re-emit of current inbox state */
	"inbox.refresh": Record<string, never>;
	/** Emitted when an untyped note is detected in a watched vault folder */
	"inbox.vaultFolder.noteDetected": { path: string; title: string };
}
