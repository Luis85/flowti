import { DayPhase } from "src/simulation/types";

export class DayPhaseChangedEvent {
	constructor(
		public dayIndex: number,
		public from: DayPhase,
		public to: DayPhase
	) { }
}
