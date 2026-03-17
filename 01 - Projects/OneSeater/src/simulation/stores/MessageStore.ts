import { SimulationMessage } from "src/models/SimulationMessage";
import { InboxStats } from "../types";

export class MessageStore {
	messages: SimulationMessage[] = [];

	/**
	 * Find a message by ID
	 */
	public findMessage(id: string): SimulationMessage | undefined {
		return this.messages.find((m) => m.id === id);
	}

	/**
	 * Find message index by ID
	 */
	public findMessageIndex(id: string): number {
		return this.messages.findIndex((m) => m.id === id);
	}

	/**
	 * Check if a message exists
	 */
	public hasMessage(id: string): boolean {
		return this.findMessageIndex(id) >= 0;
	}

	/**
	 * Get all active (non-deleted) messages
	 */
	public getActiveMessages(): SimulationMessage[] {
		return this.messages.filter((m) => !m.deleted_at && !m.spam_at);
	}

	/**
	 * Get all deleted (deleted and spam) messages
	 */
	public getDeletedMessages(): SimulationMessage[] {
		return this.messages.filter((m) => m.deleted_at && m.spam_at);
	}

	/**
	 * Get unread messages
	 */
	public getUnreadMessages(): SimulationMessage[] {
		return this.messages.filter((m) => !m.deleted_at && !m.read_at);
	}

	/**
	 * Get messages by type
	 */
	public getMessagesByType(type: string): SimulationMessage[] {
		return this.messages.filter((m) => !m.deleted_at && m.type === type);
	}

	/**
	 * Count active messages
	 */
	public getMessageCount(): number {
		return this.getActiveMessages().length;
	}

	/**
	 * Count unread messages
	 */
	public getUnreadCount(): number {
		return this.getUnreadMessages().length;
	}

	/**
	 * Check if inbox is full
	 */
	public isInboxFull(maxSize = 50): boolean {
		return this.getMessageCount() >= maxSize;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Message Inbox - Mutations
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Add a new message to the inbox
	 * @returns true if added, false if duplicate
	 */
	public addMessage(message: SimulationMessage): boolean {
		// Prevent duplicates
		if (this.hasMessage(message.id)) {
			return false;
		}
		this.messages.push(message);
		return true;
	}

	/**
	 * Mark a message as read
	 * @returns true if marked, false if not found or already read
	 */
	public markMessageAsRead(id: string, timestamp?: number): boolean {
		const msg = this.findMessage(id);
		if (!msg || msg.read_at) return false;

		msg.read_at = timestamp || Date.now();
		return true;
	}

	/**
	 * Mark a message as spam
	 * @returns true if marked, false if not found
	 */
	public markMessageAsSpam(id: string, timestamp?: number): boolean {
		const msg = this.findMessage(id);
		if (!msg) return false;

		const now = timestamp || Date.now();
		msg.is_spam = true;
		msg.spam_at = msg.spam_at ?? now;
		msg.read_at = msg.read_at ?? now;
		return true;
	}

	/**
	 * Soft delete a message (set deleted_at timestamp)
	 * @returns true if deleted, false if not found or already deleted
	 */
	public softDeleteMessage(id: string, timestamp?: number): boolean {
		const msg = this.findMessage(id);
		if (!msg || msg.deleted_at) return false;

		msg.deleted_at = timestamp || Date.now();
		return true;
	}

	/**
	 * Hard delete a message (remove from array)
	 * @returns true if removed, false if not found
	 */
	public hardDeleteMessage(id: string): boolean {
		const idx = this.findMessageIndex(id);
		if (idx < 0) return false;

		this.messages.splice(idx, 1);
		return true;
	}

	/**
	 * Archive a message (soft delete with archive flag)
	 * @returns true if archived, false if not found
	 */
	public archiveMessage(id: string, timestamp?: number): boolean {
		const msg = this.findMessage(id);
		if (!msg) return false;

		const now = timestamp || Date.now();
		msg.read_at = msg.read_at ?? now;
		msg.deleted_at = now;
		return true;
	}

	/**
	 * Bulk delete all read messages
	 * @returns number of deleted messages
	 */
	public deleteAllReadMessages(hardDelete = true, timestamp?: number): number {
		const readMessages = this.messages.filter(
			(m) => m.read_at && !m.deleted_at
		);
		const count = readMessages.length;

		if (hardDelete) {
			this.messages = this.messages.filter(
				(m) => !m.read_at || m.deleted_at
			);
		} else {
			const now = timestamp || Date.now();
			readMessages.forEach((m) => {
				m.deleted_at = now;
			});
		}

		return count;
	}

	/**
	 * Bulk delete all spam messages
	 * @returns number of deleted messages
	 */
	public deleteAllSpamMessages(): number {
		const before = this.messages.length;
		this.messages = this.messages.filter((m) => !m.is_spam);
		return before - this.messages.length;
	}

	/**
	 * Mark all messages as read
	 * @returns number of messages marked
	 */
	public markAllAsRead(timestamp?: number): number {
		const now = timestamp || Date.now();
		let count = 0;

		this.messages.forEach((m) => {
			if (!m.read_at && !m.deleted_at) {
				m.read_at = now;
				count++;
			}
		});

		return count;
	}

	// ─────────────────────────────────────────────────────────────────────────
	// Message Inbox - Stats
	// ─────────────────────────────────────────────────────────────────────────

	/**
	 * Get inbox statistics
	 */
	public getInboxStats(): InboxStats {
		const active = this.getActiveMessages();
		const unread = active.filter((m) => !m.read_at);
		const spam = this.messages.filter((m) => m.is_spam);

		const byType: Record<string, number> = {};
		active.forEach((m) => {
			byType[m.type] = (byType[m.type] || 0) + 1;
		});

		const byPriority: Record<string, number> = {};
		active.forEach((m) => {
			byPriority[m.priority] = (byPriority[m.priority] || 0) + 1;
		});

		return {
			total: active.length,
			unread: unread.length,
			read: active.length - unread.length,
			spam: spam.length,
			byType,
			byPriority,
		};
	}
}
