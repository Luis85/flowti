/**
 * needs-focus.ts — MDSL subtree for focus restoration.
 *
 * When focus is low, agent seeks a quiet corner away from others.
 */

export const NEEDS_FOCUS_SUBTREE = `
root [NeedsFocus] {
	sequence {
		condition [IsFocusLow]
		action [SeekQuietCorner]
	}
}
`.trim();
