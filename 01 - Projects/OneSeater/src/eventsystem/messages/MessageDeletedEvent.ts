export class MessageDeletedEvent {
  constructor(
    public messageId: string,
    public hardRemove?: boolean, // if true: remove from array; else: tombstone via deleted_at
    public atSimNowMs?: number
  ) {}
}
