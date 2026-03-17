/**
 * tui-session-store.ts — Factory for TUI session state.
 *
 * Creates a mutable session store that tracks pipeline state
 * and the currently selected project.
 */

import type { TuiSessionStore } from "./tui-handler-types.js";

export function createSessionStore(): TuiSessionStore {
	return {
		pipeline: {},
		selectedProject: undefined,
	};
}
