/**
 * needs-thirst.ts — MDSL subtree for thirst satisfaction.
 *
 * Priority order:
 *   1. Same-room station (preferred → nearest) → Drink
 *   2. Cross-room transfer to a room that has a drink station
 *   3. Wander seeking a drink (last resort, e.g. single-room scene)
 */

export const NEEDS_THIRST_SUBTREE = `
root [NeedsThirst] {
	selector {
		sequence {
			condition [IsThirsty]
			selector {
				sequence {
					condition [HasPreferredDrinkStation]
					action [SeekPreferredDrinkStation]
				}
				action [SeekDrinkStation]
			}
			action [Drink]
		}
		sequence {
			condition [IsThirsty]
			condition [HasDrinkStationInOtherRoom]
			action [SeekDrinkStationRoom]
		}
		sequence {
			condition [IsThirsty]
			action [WanderThirsty]
		}
	}
}
`.trim();
