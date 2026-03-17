export class MessageReadEvent {
  constructor(
    public messageId: string,
    public atSimNowMs?: number // optional, system will fill
  ) {}
}
