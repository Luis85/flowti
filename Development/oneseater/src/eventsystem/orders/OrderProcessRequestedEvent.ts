export class OrderProcessRequestedEvent {
  constructor(
    public readonly orderId: string,
    public readonly source: "ui" | "system" | "auto" = "ui"
  ) {}
}
