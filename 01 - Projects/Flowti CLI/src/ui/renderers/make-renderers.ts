/**
 * make-renderers.ts — Display renderers for Make domain commands.
 *
 * Provides ANSI-formatted output for non-interactive CLI commands
 * in the Make domain.
 */

import { RESET, CYAN } from "../../infrastructure/ui.js";
import type { Log } from "../../infrastructure/deps.js";

/** Renders a progress line when adding a component (e.g., "Adding Component: Button"). */
export function renderComponentAdding(defLabel: string, name: string, log: Log): void {
	log(`\n  ${CYAN}▸${RESET} Adding ${defLabel}: ${name}\n`);
}
