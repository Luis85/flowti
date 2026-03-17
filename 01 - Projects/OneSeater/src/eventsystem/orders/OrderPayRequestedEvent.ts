export class OrderPayRequestedEvent {
  constructor(
    public readonly orderId: string,
    public readonly source: "ui" | "system" | "auto" = "system"
  ) {}
}
