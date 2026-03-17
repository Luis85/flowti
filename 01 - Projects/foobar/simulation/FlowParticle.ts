import { SimulationConfig } from "types";

export class FlowParticle {
  x: number;
  y: number;
  z: number;
  vx = 0;
  vy = 0;
  vz = 0;
  speed = 0;
  vorticity = 0;
  phase: number;

  trail: Float32Array;
  speeds: Float32Array;
  private trailLength: number;

  constructor(x: number, y: number, z: number, trailLength: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.trailLength = trailLength;
    this.phase = Math.random() * Math.PI * 2;
    this.trail = new Float32Array(trailLength * 3);
    this.speeds = new Float32Array(trailLength);
    
    for (let i = 0; i < trailLength; i++) {
      this.trail[i * 3] = x;
      this.trail[i * 3 + 1] = y;
      this.trail[i * 3 + 2] = z;
      this.speeds[i] = 0;
    }
  }

  addToTrail() {
    for (let i = this.trailLength - 1; i > 0; i--) {
      this.trail[i * 3] = this.trail[(i - 1) * 3];
      this.trail[i * 3 + 1] = this.trail[(i - 1) * 3 + 1];
      this.trail[i * 3 + 2] = this.trail[(i - 1) * 3 + 2];
      this.speeds[i] = this.speeds[i - 1];
    }
    
    this.trail[0] = this.x;
    this.trail[1] = this.y;
    this.trail[2] = this.z;
    this.speeds[0] = this.speed;
  }

  respawn(bounds: SimulationConfig["tunnelBounds"]) {
    this.x = bounds.x[0] + Math.random() * 0.3;
    this.y = bounds.y[0] + Math.random() * (bounds.y[1] - bounds.y[0]);
    this.z = bounds.z[0] + Math.random() * (bounds.z[1] - bounds.z[0]);
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.speed = 0;
    
    for (let i = 0; i < this.trailLength; i++) {
      this.trail[i * 3] = this.x;
      this.trail[i * 3 + 1] = this.y;
      this.trail[i * 3 + 2] = this.z;
      this.speeds[i] = 0;
    }
  }
}
