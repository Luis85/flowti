/**
 * Event dispatched when the player wants to go to sleep.
 * This will trigger the PlayerEnergySystem to restore energy
 */
export class GoToSleepEvent {
  constructor(public reason: "exhausted" | "player" | "auto" = "player") {}
}
