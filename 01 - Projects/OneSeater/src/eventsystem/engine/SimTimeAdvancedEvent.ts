
export class SimTimeAdvancedEvent {
	constructor(
		public deltaTime: number,
		public simDtMs: number,
		public multiplier: number,
		public simNowMs: number,
		public dayIndex: number,
		public minuteOfDay: number
	) { }
}
