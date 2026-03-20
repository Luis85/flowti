/**
 * weather-config.ts — Weather states and visual configuration.
 */

export type WeatherState = "clear" | "rain" | "overcast" | "sunny";

export interface WeatherVisuals {
	readonly tintColor: string | null;
	readonly tintOpacity: number;
	readonly particleCount: number;
	readonly particleColor: string;
	readonly particleSpeed: number;
	readonly particleAngle: number;  // radians, 0 = down
}

export const WEATHER_VISUALS: Record<WeatherState, WeatherVisuals> = {
	clear: {
		tintColor: null, tintOpacity: 0,
		particleCount: 0, particleColor: "", particleSpeed: 0, particleAngle: 0,
	},
	rain: {
		tintColor: "rgb(100, 120, 160)", tintOpacity: 0.04,
		particleCount: 25, particleColor: "rgba(150, 170, 220, 0.4)",
		particleSpeed: 120, particleAngle: 0.3,
	},
	overcast: {
		tintColor: "rgb(140, 140, 150)", tintOpacity: 0.06,
		particleCount: 0, particleColor: "", particleSpeed: 0, particleAngle: 0,
	},
	sunny: {
		tintColor: "rgb(255, 230, 150)", tintOpacity: 0.03,
		particleCount: 10, particleColor: "rgba(255, 220, 100, 0.3)",
		particleSpeed: 15, particleAngle: -1.57,  // upward drift
	},
};

export const WEATHER_STATES: readonly WeatherState[] = ["clear", "rain", "overcast", "sunny"];
