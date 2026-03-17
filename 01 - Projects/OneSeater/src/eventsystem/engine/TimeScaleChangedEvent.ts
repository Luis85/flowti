export class TimeScaleChangedEvent {
	
	public type = "sim:speed.set";

	constructor(
		public multiplier: number
	) {}
}
