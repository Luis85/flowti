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
		new Notice(message, timeout);
	}

	success(message: string, timeout = 3000): void {
		new Notice(message, timeout);
	}
}

/**
 * Factory function to create the default NoticeService
 */
export function createNoticeService(): INoticeService {
	return new NoticeService();
}

/**
 * No-op implementation for testing
 */
export function createNoOpNoticeService(): INoticeService {
	return {
		show: () => {},
		error: () => {},
		success: () => {},
	};
}

/**
 * Mock implementation that tracks calls for testing
 */
export function createMockNoticeService(): INoticeService & {
	calls: Array<{ method: string; message: string; timeout?: number }>;
	clear: () => void;
} {
	const calls: Array<{ method: string; message: string; timeout?: number }> = [];

	return {
		calls,
		clear: () => {
			calls.length = 0;
		},
		show: (message: string, timeout?: number) => {
			calls.push({ method: "show", message, timeout });
		},
		error: (message: string, timeout?: number) => {
			calls.push({ method: "error", message, timeout });
		},
		success: (message: string, timeout?: number) => {
			calls.push({ method: "success", message, timeout });
		},
	};
}
