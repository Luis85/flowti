export class SleepFinishedEvent {
  constructor(
    public energyBefore: number,
    public energyAfter: number,
    public sleptMinutes: number
  ) {}
}
