import { SimulationMessage } from "src/models/SimulationMessage";

export class OrderAcceptedEvent {
  constructor(
    public messageId: string,
	public message: SimulationMessage,
  ) {}
}
