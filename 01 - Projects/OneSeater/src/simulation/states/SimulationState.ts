import {type ITransitionActions, State, TGroupHandle} from "sim-ecs";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

export class SimulationState extends State {
    saveDataPrefabHandle?: TGroupHandle;
    staticDataPrefabHandle?: TGroupHandle;

	activate(actions: ITransitionActions) {
		actions.getResource(SimulationStore).currentState = this;
		return actions.flushCommands();
	}

	deactivate(actions: ITransitionActions) {
		return actions.flushCommands();
	}
}
