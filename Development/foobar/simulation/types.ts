export type Vec3 = { x: number; y: number; z: number };

export interface TunnelBounds {
	x: [number, number];
	y: [number, number];
	z: [number, number];
}

export interface SimulationParams {
	windSpeed: number;
	particleCount: number;
	turbulence: number;
	viscosity: number;
	tunnelBounds: TunnelBounds;
	inletProfile?: "uniform" | "parabolic";
	trailHeatDecay?: number; // e.g. 2.5 (bigger = faster fade)
	resetTrailHeatOnRespawn?: boolean;
}

export interface Obstacle {
	boundingType: "sphere" | "box";
	position: Vec3;
	// sphere: radius in x, box: size in xyz
	boundingSize: Vec3;
}

export interface VisualizationParams {
	colorMode: "velocity" | "pressure" | "vorticity" | "uniform";
	colorScale: "rainbow" | "thermal" | "cool" | "blueRed";
	displayMode: "particles" | "trails" | "both";
	particleSize: number;
	trailLength: number;
	trailWidth: number;
	opacity: number;
}

export interface SimSnapshot {
	particleCount: number;
	positions: Float32Array; // xyz packed: length = N*3
	speeds: Float32Array; // length = N
	vorticity: Float32Array; // length = N
	trails?: Float32Array; // length = N*trailLen*3
	trailLen?: number;
	velocities?: Float32Array; // xyz packed, length N*3
	trailHeat?: Float32Array;
}

export type ScenePreset = {
  id: string;
  name: string;
  description?: string;

  sim: Partial<SimulationParams>;
  vis: Partial<VisualizationParams>;

  obstacles: Obstacle[];
  camera?: { alpha?: number; beta?: number; radius?: number; target?: Vec3 };

  // optional future
  mesh?: { type: "builtin" | "gltf"; url?: string; scale?: number };
};
