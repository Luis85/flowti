import { TimerId, Timer } from "src/simulation/timer/types";

export class TimerStore {
    timers: Map<TimerId, Timer> = new Map();

    add(timer: Timer): void {
        this.timers.set(timer.id, timer);
    }

    remove(id: TimerId): boolean {
        return this.timers.delete(id);
    }

    get(id: TimerId): Timer | undefined {
        return this.timers.get(id);
    }

    has(id: TimerId): boolean {
        return this.timers.has(id);
    }

    getExpired(nowMs: number): Timer[] {
        const expired: Timer[] = [];
        for (const timer of this.timers.values()) {
            if (timer.expiresAt <= nowMs) {
                expired.push(timer);
            }
        }
        return expired;
    }

    get count(): number {
        return this.timers.size;
    }

    clear(): void {
        this.timers.clear();
    }
}
