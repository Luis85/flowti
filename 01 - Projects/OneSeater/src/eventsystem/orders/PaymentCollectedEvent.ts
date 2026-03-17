import { SimulationMessage } from "src/models/SimulationMessage";

export class PaymentCollectedEvent {
  constructor(
	public paymentId: string,
	public message: SimulationMessage,
  ) {}
}
