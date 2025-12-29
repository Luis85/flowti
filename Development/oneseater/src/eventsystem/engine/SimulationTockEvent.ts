import { SimulationStore } from "src/simulation/stores/SimulationStore";

export class SimulationTockEvent {
	constructor(
		public timestamp: number,
		public stepDuration: number,
		public state: SimulationStore,
	) {}
}
