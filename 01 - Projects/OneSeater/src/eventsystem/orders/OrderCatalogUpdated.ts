import { SalesOrder } from "src/models/SalesOrder";

export class OrderCatalogUpdatedEvent {
  constructor(public orders: SalesOrder[]) {}
}
