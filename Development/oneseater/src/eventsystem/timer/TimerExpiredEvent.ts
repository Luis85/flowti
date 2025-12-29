import { Timer } from "src/simulation/timer/types";

export class TimerExpiredEvent {
    constructor(public readonly timer: Timer) {}
}
