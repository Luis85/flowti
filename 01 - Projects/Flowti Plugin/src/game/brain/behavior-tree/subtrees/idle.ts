/**
 * idle.ts — MDSL subtree for idle behavior.
 *
 * Fallback when no needs, goals, or social triggers are active.
 * Emits "idle" — the brain's autonomous cycle handles wander pacing
 * and the talk engine handles ambient chatter independently.
 * Exported as IDLE_SUBTREE for use by bt-factory.
 */

export const IDLE_SUBTREE = `
root [IdleBehavior] {
	action [EchoBiasedIdle]
}
`.trim();
