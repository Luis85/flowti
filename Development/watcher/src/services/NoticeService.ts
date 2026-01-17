import { Notice } from "obsidian";

/**
 * Interface for displaying user notifications.
 * Abstracts the Obsidian Notice API for easier testing.
 */
export interface INoticeService {
	/**
	 * Show a notification to the user
	 * @param message The message to display
	 * @param timeout Optional timeout in milliseconds (default: 5000, 0 = no auto-dismiss)
	 */
	show(message: string, timeout?: number): void;

	/**
	 * Show an error notification
	 * @param message The error message
	 * @param timeout Optional timeout (default: 8000 for errors)
	 */
	error(message: string, timeout?: number): void;

	/**
	 * Show a success notification
	 * @param message The success message
	 * @param timeout Optional timeout (default: 3000 for success)
	 */
	success(message: string, timeout?: number): void;
}

/**
 * Default implementation using Obsidian's Notice API
 */
export class NoticeService implements INoticeService {
	show(message: string, timeout?: number): void {
		new Notice(message, timeout);
	}

	error(message: string, timeout = 8000): void {
		const notice = new Notice(`⚠️ ${message}`, timeout);
		// Add error styling to the notice element
		notice.messageEl.addClass("mod-error");
	}

	success(message: string, timeout = 3000): void {
		const notice = new Notice(`✅ ${message}`, timeout);
		notice.messageEl.addClass("mod-success");
	}
}

/**
 * Factory function to create the default NoticeService
 */
export function createNoticeService(): INoticeService {
	return new NoticeService();
}

/**
 * No-op implementation for contexts where notices should be silenced.
 */
export function createNoOpNoticeService(): INoticeService {
	return {
		show: () => {},
		error: () => {},
		success: () => {},
	};
}
