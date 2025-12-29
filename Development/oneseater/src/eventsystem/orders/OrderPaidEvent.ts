import { SalesOrder } from "src/models/SalesOrder";

export class OrderPaidEvent {
  constructor(
	public order: SalesOrder,
  ) {}
}
