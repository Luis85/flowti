import { SalesOrder } from "src/models/SalesOrder";

export class OrderUpdatedEvent {
  constructor(
    public order: SalesOrder,
  ) {}
}
