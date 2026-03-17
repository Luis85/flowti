export class OrderCancelRequestedEvent {
  constructor(
    public readonly orderId: string,
    public readonly reason?: string,
    public readonly source: "ui" | "system" | "player" = "ui"
  ) {}
}
