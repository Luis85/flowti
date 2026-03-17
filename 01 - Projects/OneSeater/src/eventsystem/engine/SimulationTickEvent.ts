import { SimulationStore } from "src/simulation/stores/SimulationStore";

export class SimulationTickEvent {

	public type:"engine:tick" = "engine:tick";
	
    constructor(
        public lastFrameDeltaTime: number,
		public timestamp: number,
		public state: SimulationStore,
    ) {}
}
