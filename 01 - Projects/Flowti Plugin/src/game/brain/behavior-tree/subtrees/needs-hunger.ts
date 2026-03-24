/**
 * needs-hunger.ts — MDSL subtree for hunger satisfaction.
 *
 * Priority order:
 *   1. Same-room station (preferred → nearest) → Eat
 *   2. Cross-room transfer to a room that has a food station
 *   3. Wander seeking food (last resort, e.g. single-room scene)
 */

export const NEEDS_HUNGER_SUBTREE = `
root [NeedsHunger] {
	selector {
		sequence {
			condition [IsHungry]
			selector {
				sequence {
					condition [HasPreferredFoodStation]
					action [SeekPreferredFoodStation]
				}
				action [SeekFoodStation]
			}
			action [Eat]
		}
		sequence {
			condition [IsHungry]
			condition [HasFoodStationInOtherRoom]
			action [SeekFoodStationRoom]
		}
		sequence {
			condition [IsHungry]
			action [WanderHungry]
		}
	}
}
`.trim();
