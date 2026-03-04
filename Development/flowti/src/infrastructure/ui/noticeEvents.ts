/**
 * Event types for the Notice system.
 *
 * These events allow domain services and UI components to show
 * notices without importing Obsidian's Notice class directly.
 * The NoticeService listens for these events and creates
 * the actual Obsidian Notice instances.
 */

export interface NoticePromptButton {
	label: string;
	value: string;
	/** Primary/accent styling (mod-cta) */
	cta?: boolean;
	/** Warning styling (background-modifier-error) */
	warning?: boolean;
}

export interface NoticeEventMap {
	/** Show a plain notice with optional duration */
	"notice.show": { message: string; duration?: number };
	/** Show a success notice (default duration) */
	"notice.success": { message: string };
	/** Show an error notice (default 5000ms) */
	"notice.error": { message: string; duration?: number };
	/** Show a throttled notice (batched by key within a 2s window) */
	"notice.throttled": { key: string; message: string };
	/** Show an interactive prompt with configurable buttons */
	"notice.prompt": { title: string; message: string; buttons: NoticePromptButton[] };
	/** Emitted when a prompt button is clicked */
	"notice.prompt.responded": { value: string };
}
