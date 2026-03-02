/**
 * Event types for the Modal system.
 *
 * These events are emitted by the {@link ModalService} to track
 * modal lifecycle for observability and debugging.
 */

export interface ModalEventMap {
	/** Emitted when a modal is opened */
	"modal.opened": { modalType: string; timestamp: string };
	/** Emitted when a modal is closed */
	"modal.closed": { modalType: string; timestamp: string };
}
