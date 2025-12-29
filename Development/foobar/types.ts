
export interface ScenePreset {
  name: string;
  obstacles: ObstacleConfig[];
  simulation: SimulationConfig;
  visualization: VisualizationConfig;
  camera: { alpha: number; beta: number; radius: number; target: [number, number, number] };
}

export interface ObstacleConfig {
  type: "sphere" | "box" | "car" | "cylinder" | "airfoil";
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  color: [number, number, number];
}

export interface SimulationConfig {
  windSpeed: number;
  particleCount: number;
  turbulence: number;
  viscosity: number;
  tunnelBounds: { x: [number, number]; y: [number, number]; z: [number, number] };
}

export interface VisualizationConfig {
  colorMode: "velocity" | "pressure" | "vorticity" | "uniform";
  colorScale: "rainbow" | "thermal" | "cool" | "blueRed";
  displayMode: "particles" | "trails" | "both";
  particleSize: number;
  trailLength: number;
  trailWidth: number;
  opacity: number;
}

export interface ObstacleMesh {
  mesh: BABYLON.Mesh;
  position: BABYLON.Vector3;
  boundingType: "sphere" | "box";
  boundingSize: BABYLON.Vector3;
}

