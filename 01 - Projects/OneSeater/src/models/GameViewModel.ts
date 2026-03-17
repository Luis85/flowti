import { DayPhase } from "src/simulation/types";

import { SimulationMessage } from "./SimulationMessage";
import { PlayerState } from "./Player";
import { Product } from "./Product";
import { Payment } from "./Payment";
import { SalesOrder } from "./SalesOrder";

export type GameViewModel = {
	day: number,
	minuteOfDay: number;
	phase: DayPhase;
	paused: boolean;
	speed: number; // current sim speed (0 if paused depending on store/event)
	resumeSpeed: number; // sim speed before beforePause
	feed: string[];
	messages: SimulationMessage[];
	products: Product[];
	orders: SalesOrder[];
	payments: Payment[];
	player: PlayerState;
};
