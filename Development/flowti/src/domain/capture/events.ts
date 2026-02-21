/**
 * Event map for the Quick Capture domain.
 *
 * Events follow the `capture.` prefix convention.
 * Type-specific events are emitted alongside the generic `capture.note.created`.
 */

export interface CaptureEventMap {
	/** An idea was captured via Quick Capture */
	"capture.idea.created": { path: string; title: string };

	/** Feedback was captured via Quick Capture */
	"capture.feedback.created": { path: string; title: string };

	/** A note was created via Quick Capture (any type) */
	"capture.note.created": { path: string; title: string; type: string };
}
