import {type ISyncPointPrefab} from "sim-ecs";
import { BeforeStepSystem } from "../systems/engine/BeforeStepSystem";
import { DayCycleSystem } from "../systems/engine/DayCycleSystem";
import { ErrorSystem } from "../systems/engine/ErrorSystem";
import { JumpToNextPhaseSystem } from "../systems/engine/JumpToNextPhaseSystem";
import { SimulationTickSystem } from "../systems/engine/SimulationTickSystem";
import { SimulationTockSystem } from "../systems/engine/SimulationTockSystem";
import { TimerSystem } from "../systems/engine/TimerSystem";
import { TimeScaleControlSystem } from "../systems/engine/TimeScaleControlSystem";
import { CustomerPurchaseOrderCreationSystem } from "../systems/messages/CustomerPurchaseOrderCreationSystem";
import { DailyMessageIntakeSystem } from "../systems/messages/DailyMessageIntakeSystem";
import { PaymentSystem } from "../systems/PaymentSystem";
import { PlayerEnergySystem } from "../systems/player/PlayerEnergySystem";
import { PlayerSleepSystem } from "../systems/player/PlayerSleepSystem";
import { ProductCatalogSystem } from "../systems/ProductCatalogSystem";
import { TaskResolutionSystem } from "../systems/TaskResolutionSystem";

export const SIMULATION_SCHEDULE: ISyncPointPrefab = {
	stages: [
		[BeforeStepSystem],
		[SimulationTickSystem],
		[TimeScaleControlSystem],
		[DayCycleSystem],
		[TimerSystem],
		[PlayerEnergySystem],
		[PlayerSleepSystem],
		[JumpToNextPhaseSystem],
		[ProductCatalogSystem],
		[DailyMessageIntakeSystem],
		[CustomerPurchaseOrderCreationSystem],
		[PaymentSystem],
		[TaskResolutionSystem],
		[SimulationTockSystem],
		[ErrorSystem],
	],
};
