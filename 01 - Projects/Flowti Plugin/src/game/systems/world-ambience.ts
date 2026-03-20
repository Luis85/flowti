/**
 * world-ambience.ts — Ambient lighting and weather for the Living World.
 *
 * Provides phase-driven lighting tints and a cycling weather state machine.
 * The engine creates an ExcaliburJS Canvas actor from getLighting() data;
 * this system itself has no ExcaliburJS imports.
 */

import type { DayPhase } from "../data/day-phase-config.js";
import { WEATHER_STATES, WEATHER_VISUALS, type WeatherState, type WeatherVisuals } from "../data/weather-config.js";

// ── Lighting definitions per phase ───────────────────────────────────

export interface LightingState {
	readonly r: number;
	readonly g: number;
	readonly b: number;
	readonly opacity: number;
}

const PHASE_LIGHTING: Record<DayPhase, LightingState> = {
	"morning-arrival":    { r: 255, g: 200, b: 100, opacity: 0.05 },
	"productive-morning": { r: 0,   g: 0,   b: 0,   opacity: 0 },
	"lunch":              { r: 255, g: 210, b: 130, opacity: 0.03 },
	"afternoon":          { r: 0,   g: 0,   b: 0,   opacity: 0 },
	"afternoon-slump":    { r: 200, g: 150, b: 80,  opacity: 0.08 },
	"wind-down":          { r: 100, g: 120, b: 200, opacity: 0.06 },
	"evening-departure":  { r: 80,  g: 80,  b: 160, opacity: 0.12 },
};

// ── Persistence shape ────────────────────────────────────────────────

export interface AmbienceState {
	readonly weather: WeatherState;
	readonly cyclesSinceChange: number;
}

// ── System ───────────────────────────────────────────────────────────

export class WorldAmbience {
	private weather: WeatherState = "clear";
	private cyclesSinceChange = 0;
	private readonly cycleLengthInDayCycles: number;

	constructor(cycleLengthInDayCycles = 2) {
		this.cycleLengthInDayCycles = cycleLengthInDayCycles;
	}

	// ── Public API ─────────────────────────────────────────────

	getLighting(phase: DayPhase): LightingState {
		return PHASE_LIGHTING[phase] ?? PHASE_LIGHTING["afternoon"];
	}

	getWeather(): WeatherState {
		return this.weather;
	}

	getWeatherVisuals(): WeatherVisuals {
		return WEATHER_VISUALS[this.weather];
	}

	/** Called when DayClock completes a full cycle. May trigger weather change. */
	onCycleComplete(): void {
		this.cyclesSinceChange++;
		if (this.cyclesSinceChange >= this.cycleLengthInDayCycles) {
			this.cyclesSinceChange = 0;
			this.weather = this.nextWeather();
		}
	}

	// ── Persistence ────────────────────────────────────────────

	serialize(): AmbienceState {
		return { weather: this.weather, cyclesSinceChange: this.cyclesSinceChange };
	}

	restore(state: AmbienceState): void {
		this.weather = state.weather;
		this.cyclesSinceChange = state.cyclesSinceChange;
	}

	// ── Private ────────────────────────────────────────────────

	private nextWeather(): WeatherState {
		const others = WEATHER_STATES.filter((w) => w !== this.weather);
		return others[Math.floor(Math.random() * others.length)];
	}
}
