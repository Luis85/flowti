/**
 * needs.ts — MDSL subtree for needs satisfaction (Phase 1 stub).
 *
 * Full liveness-systems integration is a Phase 2 prerequisite.
 * Phase 1 stub: low energy triggers rest.
 * Exported as NEEDS_SUBTREE for use by bt-factory.
 */

export const NEEDS_SUBTREE = `
root [NeedsSatisfaction] {
	selector {
		sequence {
			flip {
				condition [HasEnoughEnergy]
			}
			action [Rest]
		}
	}
}
`.trim();
