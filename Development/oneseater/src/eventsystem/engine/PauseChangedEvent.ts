export class PauseChangedEvent {

	public type: "sim:pause:changed" = "sim:pause:changed";

	constructor(
		public paused: boolean,
		public multiplier: number,
		public previousMultiplier: number
	) {}
}
