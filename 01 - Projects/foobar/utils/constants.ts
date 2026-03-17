import { ScenePreset } from "types";

export const SCENE_PRESETS: Record<string, ScenePreset> = {
	sphere: {
		name: "Kugel (Standard)",
		obstacles: [
			{
				type: "sphere",
				position: [0, 0, 0],
				scale: [1, 1, 1],
				color: [0.9, 0.4, 0.2],
			},
		],
		simulation: {
			windSpeed: 3.0,
			particleCount: 2500,
			turbulence: 0.2,
			viscosity: 0.1,
			tunnelBounds: { x: [-8, 8], y: [-2, 2], z: [-3, 3] },
		},
		visualization: {
			colorMode: "velocity",
			colorScale: "rainbow",
			displayMode: "trails",
			particleSize: 0.04,
			trailLength: 40,
			trailWidth: 0.015,
			opacity: 0.85,
		},
		camera: {
			alpha: Math.PI / 4,
			beta: Math.PI / 3,
			radius: 12,
			target: [0, 0, 0],
		},
	},

	car: {
		name: "Rennwagen",
		obstacles: [
			{
				type: "car",
				position: [0, 0.1, 0],
				scale: [1, 1, 1],
				rotation: [0, Math.PI, 0],
				color: [1, 0.3, 0],
			},
		],
		simulation: {
			windSpeed: 4.0,
			particleCount: 3500,
			turbulence: 0.25,
			viscosity: 0.08,
			tunnelBounds: { x: [-6, 12], y: [-0.5, 2], z: [-2, 2] },
		},
		visualization: {
			colorMode: "velocity",
			colorScale: "rainbow",
			displayMode: "trails",
			particleSize: 0.03,
			trailLength: 50,
			trailWidth: 0.012,
			opacity: 0.9,
		},
		camera: {
			alpha: Math.PI / 5,
			beta: Math.PI / 2.8,
			radius: 10,
			target: [1, 0.5, 0],
		},
	},

	cylinder: {
		name: "Zylinder (Kármán)",
		obstacles: [
			{
				type: "cylinder",
				position: [0, 0, 0],
				scale: [0.6, 3, 0.6],
				rotation: [Math.PI / 2, 0, 0],
				color: [0.3, 0.5, 1],
			},
		],
		simulation: {
			windSpeed: 2.5,
			particleCount: 3000,
			turbulence: 0.35,
			viscosity: 0.05,
			tunnelBounds: { x: [-5, 12], y: [-2, 2], z: [-2.5, 2.5] },
		},
		visualization: {
			colorMode: "vorticity",
			colorScale: "thermal",
			displayMode: "trails",
			particleSize: 0.035,
			trailLength: 45,
			trailWidth: 0.014,
			opacity: 0.85,
		},
		camera: {
			alpha: 0,
			beta: Math.PI / 2.5,
			radius: 14,
			target: [2, 0, 0],
		},
	},

	airfoil: {
		name: "Tragfläche",
		obstacles: [
			{
				type: "airfoil",
				position: [0, 0, 0],
				scale: [2, 0.3, 4],
				rotation: [0, 0, 0.12],
				color: [0.5, 0.7, 0.9],
			},
		],
		simulation: {
			windSpeed: 3.5,
			particleCount: 3000,
			turbulence: 0.15,
			viscosity: 0.12,
			tunnelBounds: { x: [-6, 10], y: [-2.5, 2.5], z: [-3, 3] },
		},
		visualization: {
			colorMode: "pressure",
			colorScale: "blueRed",
			displayMode: "trails",
			particleSize: 0.03,
			trailLength: 45,
			trailWidth: 0.012,
			opacity: 0.85,
		},
		camera: {
			alpha: Math.PI / 6,
			beta: Math.PI / 2.5,
			radius: 12,
			target: [0, 0, 0],
		},
	},

	multiBody: {
		name: "Mehrere Objekte",
		obstacles: [
			{
				type: "sphere",
				position: [-2, 0, 0],
				scale: [0.6, 0.6, 0.6],
				color: [0.9, 0.3, 0.3],
			},
			{
				type: "sphere",
				position: [2, 0.8, 0],
				scale: [0.5, 0.5, 0.5],
				color: [0.3, 0.9, 0.3],
			},
			{
				type: "box",
				position: [0, -0.5, 1.5],
				scale: [0.8, 0.4, 0.4],
				color: [0.3, 0.3, 0.9],
			},
		],
		simulation: {
			windSpeed: 2.8,
			particleCount: 3000,
			turbulence: 0.3,
			viscosity: 0.1,
			tunnelBounds: { x: [-6, 10], y: [-2, 2.5], z: [-3, 3] },
		},
		visualization: {
			colorMode: "velocity",
			colorScale: "rainbow",
			displayMode: "both",
			particleSize: 0.03,
			trailLength: 35,
			trailWidth: 0.01,
			opacity: 0.8,
		},
		camera: {
			alpha: Math.PI / 4,
			beta: Math.PI / 3,
			radius: 14,
			target: [0, 0, 0],
		},
	},
};

// ============================================================================
// COLOR SCALES
// ============================================================================

export const COLOR_SCALES: Record<string, (t: number) => BABYLON.Color3> = {
	rainbow: (t: number): BABYLON.Color3 => {
		const hue = (1 - t) * 0.7;
		return BABYLON.Color3.FromHSV(hue * 360, 1, 1);
	},
	thermal: (t: number): BABYLON.Color3 => {
		if (t < 0.33) return new BABYLON.Color3(t * 3, 0, 0);
		if (t < 0.66) return new BABYLON.Color3(1, (t - 0.33) * 3, 0);
		return new BABYLON.Color3(1, 1, (t - 0.66) * 3);
	},
	cool: (t: number): BABYLON.Color3 => {
		return new BABYLON.Color3(0.1 + t * 0.3, 0.3 + t * 0.5, 0.7 + t * 0.3);
	},
	blueRed: (t: number): BABYLON.Color3 => {
		if (t < 0.5)
			return new BABYLON.Color3(t * 0.4, 0.3 + t * 0.4, 1 - t * 0.5);
		return new BABYLON.Color3(
			0.2 + (t - 0.5) * 1.6,
			0.5 - (t - 0.5) * 0.8,
			0.75 - (t - 0.5) * 1.5
		);
	},
};
