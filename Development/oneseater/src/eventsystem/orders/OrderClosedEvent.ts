import { SalesOrder } from "src/models/SalesOrder";

export class OrderClosedEvent {
  constructor(
	public order: SalesOrder,
  ) {}
}
