export class OrderCloseRequestedEvent {
  constructor(
    public readonly orderId: string,
    public readonly source: "ui" | "system" | "auto" = "ui"
  ) {}
}
