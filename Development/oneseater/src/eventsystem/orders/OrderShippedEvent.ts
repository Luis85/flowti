import { SalesOrder } from "src/models/SalesOrder";

export class OrderShippedEvent {
  constructor(
	public order: SalesOrder,
  ) {}
}
