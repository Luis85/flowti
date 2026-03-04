/**
 * Event types for the Modal system.
 *
 * These events are emitted by the ModalService to track
 * modal lifecycle for observability and debugging.
 */

export interface ModalEventMap {
	/** Emitted when a modal is opened */
	"modal.opened": { modalType: string; timestamp: string };
	/** Emitted when a modal is closed */
	"modal.closed": { modalType: string; timestamp: string };
	/** Request to open a text input prompt modal */
	"ui.openTextPrompt": { title: string; message?: string; placeholder?: string; submitLabel?: string };
	/** Emitted when a text prompt is submitted */
	"modal.textPrompt.submitted": { value: string };
	/** Emitted when a text prompt is cancelled (closed without submit) */
	"modal.textPrompt.cancelled": Record<string, never>;
	/** Request to open a Manual QA checkpoint modal (E2E) */
	"ui.openManualQa": { instruction: string };
	/** Emitted when the operator clicks Pass or Fail in the Manual QA modal */
	"modal.manualQa.responded": { value: "pass" | "fail"; notes: string };
}
