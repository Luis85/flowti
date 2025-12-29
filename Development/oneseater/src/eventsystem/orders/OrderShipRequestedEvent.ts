export class OrderShipRequestedEvent {
  constructor(
    public readonly orderId: string,
    public readonly source: "ui" | "system" | "auto" = "ui"
  ) {}
}
