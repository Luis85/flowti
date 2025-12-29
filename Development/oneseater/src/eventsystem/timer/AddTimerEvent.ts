import { AddTimerOptions } from "src/simulation/timer/types";

export class AddTimerEvent {
    constructor(public readonly options: AddTimerOptions) {}
}
