export class SleepInterruptedEvent {
  constructor(
    public reason: "message" | "emergency" | "manual" | "system"
  ) {}
}
