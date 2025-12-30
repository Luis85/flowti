import { buildWorld, IPreptimeWorld, ISyncPoint } from "sim-ecs";
import { MessageGeneratorService } from "src/messages/MessageGeneratorService";
import { GurpsDice } from "src/utils/TheDice";
import { Counter } from "../components/Counter";
import { SIMULATION_SCHEDULE } from "../schedules/SimulationSchedule";
import { GameSettingsStore } from "../stores/GameSettingsStore";
import { PlayerEnergyStore } from "../stores/PlayerEnergyStore";
import { PlayerProgressStore } from "../stores/PlayerProgressStore";
import { SimulationStore } from "../stores/SimulationStore";
import { TaskStore } from "../stores/TaskStore";
import { TimerStore } from "../stores/TimerStore";
import { TimeScaleStore } from "../stores/TimeScaleStore";
import { MessageStore } from "../stores/MessageStore";

export const TEST_WORLD: IPreptimeWorld = buildWorld()
	.withName("OneSeater - Test World v1.0")
	.withDefaultScheduling((root: ISyncPoint) => root.fromPrefab(SIMULATION_SCHEDULE))
	.r(TimerStore)
	.r(TimeScaleStore)
	.r(PlayerEnergyStore)
	.r(PlayerProgressStore)
	.r(SimulationStore)
	.r(GameSettingsStore)
	.r(MessageStore)
	.r(TaskStore)
	.r(MessageGeneratorService)
	.r(GurpsDice)
	.withComponent(Counter)
	.build();
