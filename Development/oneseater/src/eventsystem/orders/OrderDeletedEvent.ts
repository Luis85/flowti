import { SalesOrder } from "src/models/SalesOrder";

export class OrderDeletedEvent {
  constructor(
	public order: SalesOrder,
  ) {}
}
