import {
    createSystem,
    WriteEvents,
    Storage,
    ReadResource,
} from "sim-ecs";
import { NewMessageReceivedEvent } from "src/eventsystem/messages/NewMessageReceivedEvent";
import { MessageGeneratorService, MessageGenContext } from "src/messages/MessageGeneratorService";
import { mkId } from "src/messages/utils";
import { GameSettingsStore } from "src/simulation/stores/GameSettingsStore";
import { SimulationStore } from "src/simulation/stores/SimulationStore";

export const DailyMessageIntakeSystem = createSystem({
    msg: WriteEvents(NewMessageReceivedEvent),
    sim: ReadResource(SimulationStore),
    msgGenerator: ReadResource(MessageGeneratorService),
    settings: ReadResource(GameSettingsStore),

    storage: Storage({
        lastCheckedMinute: -1,
        seq: 0,
        rngSeed: 123456789,
    }),
})
    .withName("DailyMessageIntakeSystem")
    .withRunFunction(
        ({ msg, sim, msgGenerator, settings, storage }) => {
            const now = sim.simNowMs ?? 0;
            const dayIndex = sim.dayIndex ?? 0;
            const minuteOfDay = sim.minuteOfDay ?? 0;

            // === Gleiche Minute? Nichts tun ===
            if (minuteOfDay === storage.lastCheckedMinute) return;
            storage.lastCheckedMinute = minuteOfDay;

            // === Settings Guard ===
            if (!settings.dailyMail && !settings.dailySpam) return;

            // === Spawn Roll (1x pro Minute) ===
            const rng = nextRng(storage.rngSeed);
            storage.rngSeed = rng.seed;

            const chance = Number(settings.dailyMailChance);
            if (rng.value > chance) return;

            // === Spawn! ===
            const ctx: MessageGenContext = {
                minuteOfDay,
                isWeekend: sim.isWeekend?.() ?? false,
            };

            const rngCount = nextRng(storage.rngSeed);
            storage.rngSeed = rngCount.seed;

            const count = poisson(Number(settings.mailLambda) || 1, rngCount.value);
            const maxToSpawn = Math.min(count, Number(settings.mailHardCapPerStep) || 6);

            if (maxToSpawn <= 0) return;

            const result = msgGenerator.select(maxToSpawn, ctx);

            for (const template of result.selected) {
                // Type guards
                if (template.type === "Spam" && !settings.dailySpam) continue;
                if (template.type !== "Spam" && !settings.dailyMail) continue;

                // Spam chance roll
                if (template.type === "Spam") {
                    const spamRng = nextRng(storage.rngSeed);
                    storage.rngSeed = spamRng.seed;
                    if (spamRng.value > settings.dailySpamChance) continue;
                }

                storage.seq++;

                // Message publizieren - Handler in InboxEventBridge entscheidet ob sie angenommen wird
                msg.publish(
                    new NewMessageReceivedEvent(
                        mkId(dayIndex, minuteOfDay, storage.seq),
                        template.type,
                        template.subject,
                        template.priority,
                        template.author,
                        now,
                        dayIndex,
                        minuteOfDay,
                        now,
                        template.body,
                        msgGenerator.mergeActions(template.possible_actions),
                        template.tags
                    )
                );
            }
        }
    )
    .build();

// === Utilities ===

function nextRng(seed: number): { value: number; seed: number } {
    let t = (seed + 0x6d2b79f5) | 0;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return { value, seed: t };
}

function poisson(lambda: number, rngValue: number): number {
    if (lambda <= 0) return 1;
    const L = Math.exp(-lambda);
    let k = 0;
    let p = rngValue;
    while (p > L && k < 20) {
        k++;
        p *= rngValue * (1 + k * 0.1);
    }
    return Math.max(1, k);
}
