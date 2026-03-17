/**
 * Event types owned by the Nudge domain.
 */

import type { NudgeConfig, NudgeId } from "./types";

export interface NudgeEventMap {
	/** Command: add or update a nudge configuration */
	"nudge.configure": { config: NudgeConfig };
	/** Emitted after a nudge config is added or updated */
	"nudge.configured": { config: NudgeConfig };
	/** Command: remove a nudge configuration */
	"nudge.remove": { id: NudgeId };
	/** Emitted after a nudge config is removed */
	"nudge.removed": { id: NudgeId };
	/** Emitted when a nudge fires at its scheduled time */
	"nudge.triggered": { config: NudgeConfig; inboxItemCount?: number };
	/** Command: dismiss a nudge for today */
	"nudge.dismiss": { id: NudgeId };
	/** Emitted after a nudge is dismissed for today */
	"nudge.dismissed": { id: NudgeId };
	/** Emitted after nudge state is loaded from storage */
	"nudge.loaded": { configs: NudgeConfig[] };
}
