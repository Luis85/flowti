/**
 * Types for the Quick Capture domain.
 *
 * Captures represent quick note creation via ribbon icons or command palette.
 * Notes are created with typed frontmatter in a configured folder.
 */

/** Built-in capture types plus any custom string. */
export type CaptureType =
	| "idea" | "note" | "task" | "question" | "feedback" | "bug"
	| "risk" | "assumption" | "issue" | "decision" | "learning"
	| (string & Record<never, never>);

/** Input for creating a captured note. */
export interface CaptureInput {
	title: string;
	type: CaptureType;
	description?: string;
	/** Optional folder override. When set, the note is created here instead of captureFolder. */
	folder?: string;
	/** Optional template path. When set, the template body is appended after frontmatter. */
	template?: string;
}

/** Result returned after a note is captured. */
export interface CaptureResult {
	path: string;
	title: string;
	type: CaptureType;
}

/** Per-type override for capture folder and template. */
export interface CaptureOverride {
	folder?: string;
	template?: string;
}

/** Resolved capture configuration after applying overrides. */
export interface ResolvedCaptureConfig {
	folder: string;
	template: string;
}
