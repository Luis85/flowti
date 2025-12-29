import type { Obstacle, SimulationParams, VisualizationParams, Vec3 } from "../simulation/types";

export type CameraPreset = {
  alpha?: number;
  beta?: number;
  radius?: number;
  target?: Vec3;
};

export type ScenePreset = {
  id: string;
  name: string;
  description?: string;

  sim: Partial<SimulationParams>;
  vis: Partial<VisualizationParams>;

  obstacles: Obstacle[];

  camera?: CameraPreset;

  // optional future:
  // mesh?: { type: "gltf"; url: string; scale?: number };
};
