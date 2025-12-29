import { SimulationMessage } from "src/models/SimulationMessage";

export class MessageAddedEvent {
	constructor(public message: SimulationMessage) {}
}
