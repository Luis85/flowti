export type TimerId = string;

export type TimerTrigger = {
    /** Event-Typ der ausgelöst werden soll */
    eventType: string;
    /** Payload für das Event */
    payload?: Record<string, unknown>;
};

export type Timer = {
    id: TimerId;
    /** Wann der Timer abläuft (simNowMs) */
    expiresAt: number;
    /** Was bei Ablauf passiert */
    trigger: TimerTrigger;
    /** Optional: wiederholt sich */
    repeat?: {
        intervalMs: number;
        maxRepeats?: number; // undefined = unendlich
        currentRepeat: number;
    };
    /** Metadata für Debugging */
    createdAt: number;
    source?: string; // z.B. "PaymentSystem", "QuestSystem"
};

export type AddTimerOptions = {
    /** Eindeutige ID (sonst auto-generiert) */
    id?: TimerId;
    /** Delay in Sim-Millisekunden */
    delayMs: number;
    /** Was auslösen */
    trigger: TimerTrigger;
    /** Wiederholung */
    repeat?: {
        intervalMs: number;
        maxRepeats?: number;
    };
    /** Woher kommt der Timer */
    source?: string;
};
