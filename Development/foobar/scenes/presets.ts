import type { ScenePreset } from "./types";

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "sphere-basic",
    name: "Sphere (Basic)",
    description: "Single sphere in a tunnel.",
    sim: {
      windSpeed: 3,
      turbulence: 0.15,
      viscosity: 0.08,
      particleCount: 8000,
      inletProfile: "parabolic",
      tunnelBounds: { x: [-10, 10], y: [-4, 4], z: [-6, 6] },
    },
    vis: {
      displayMode: "both",
      colorMode: "velocity",
      colorScale: "thermal",
      particleSize: 2.0,
      trailLength: 40,
      opacity: 0.85,
      trailWidth: 1,
    },
    obstacles: [
      {
        boundingType: "sphere",
        position: { x: 0, y: 0, z: 0 },
        boundingSize: { x: 1.4, y: 1.4, z: 1.4 }, // radius in x
      },
    ],
    camera: { alpha: -Math.PI / 2, beta: Math.PI / 3.2, radius: 22, target: { x: 0, y: 0, z: 0 } },
  },

  {
    id: "box-obstacle",
    name: "Box (Obstacle)",
    description: "A blunt box produces strong separation.",
    sim: {
      windSpeed: 3.5,
      turbulence: 0.2,
      viscosity: 0.06,
      particleCount: 9000,
      inletProfile: "parabolic",
      tunnelBounds: { x: [-10, 10], y: [-4, 4], z: [-6, 6] },
    },
    vis: {
      displayMode: "trails",
      colorMode: "vorticity",
      colorScale: "rainbow",
      particleSize: 2.0,
      trailLength: 55,
      opacity: 0.8,
      trailWidth: 1,
    },
    obstacles: [
      {
        boundingType: "box",
        position: { x: 0, y: 0, z: 0 },
        boundingSize: { x: 2.2, y: 1.4, z: 1.6 },
      },
    ],
    camera: { alpha: -Math.PI / 2, beta: Math.PI / 3.0, radius: 24, target: { x: 0, y: 0, z: 0 } },
  },

  {
    id: "two-spheres",
    name: "Two spheres (wake interaction)",
    description: "Wake interaction behind two bodies.",
    sim: {
      windSpeed: 3,
      turbulence: 0.18,
      viscosity: 0.07,
      particleCount: 10000,
      inletProfile: "parabolic",
      tunnelBounds: { x: [-12, 12], y: [-4, 4], z: [-7, 7] },
    },
    vis: {
      displayMode: "both",
      colorMode: "pressure",
      colorScale: "blueRed",
      particleSize: 2.0,
      trailLength: 50,
      opacity: 0.85,
      trailWidth: 1,
    },
    obstacles: [
      { boundingType: "sphere", position: { x: -1.5, y: 0, z: 0 }, boundingSize: { x: 1.3, y: 1.3, z: 1.3 } },
      { boundingType: "sphere", position: { x:  2.0, y: 0, z: 0 }, boundingSize: { x: 1.1, y: 1.1, z: 1.1 } },
    ],
    camera: { alpha: -Math.PI / 2, beta: Math.PI / 3.1, radius: 26, target: { x: 0.5, y: 0, z: 0 } },
  },
];

export function getPreset(id: string): ScenePreset {
  const p = SCENE_PRESETS.find(x => x.id === id);
  if (!p) throw new Error(`Unknown scene preset: ${id}`);
  return p;
}
