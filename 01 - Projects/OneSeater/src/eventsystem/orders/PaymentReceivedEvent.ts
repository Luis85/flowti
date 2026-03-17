import { SalesOrder } from "src/models/SalesOrder";

export class PaymentReceivedEvent {
  constructor(
	public customer: string,
	public subject: string,
	public amount: number,
	public order: SalesOrder,
  ) {}
}
