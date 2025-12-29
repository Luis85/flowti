export class MessageMarkedAsSpamEvent {
  constructor(
    public messageId: string,
    public atSimNowMs?: number
  ) {}
}
