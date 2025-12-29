import { NoiseField } from "./NoiseField";
import type { Vec3 } from "./types";

export class CurlNoiseField {
  constructor(private noise: NoiseField) {}

  sample(x: number, y: number, z: number, t: number): Vec3 {
    // Scale coordinates to control feature size
    const s = 0.35;      // spatial scale (smaller => larger swirls)
    const ts = 0.6;      // time scale
    const eps = 0.02;    // finite difference step

    const X = x * s;
    const Y = y * s;
    const Z = z * s;
    const T = t * ts;

    // three noise channels for vector potential A
    const n1 = (xx: number, yy: number, zz: number) => this.noise.noise3(xx, yy, zz, T + 11.1);
    const n2 = (xx: number, yy: number, zz: number) => this.noise.noise3(xx, yy, zz, T + 37.7);
    const n3 = (xx: number, yy: number, zz: number) => this.noise.noise3(xx, yy, zz, T + 91.3);

    // A = (Ay, Az, Ax) (any mapping is fine as long as consistent)
    // We'll set:
    // Ax = n1, Ay = n2, Az = n3
    const Ax = (xx: number, yy: number, zz: number) => n1(xx, yy, zz);
    const Ay = (xx: number, yy: number, zz: number) => n2(xx, yy, zz);
    const Az = (xx: number, yy: number, zz: number) => n3(xx, yy, zz);

    // curl = ∇×A:
    // cx = dAz/dy - dAy/dz
    // cy = dAx/dz - dAz/dx
    // cz = dAy/dx - dAx/dy

    const dAz_dy = (Az(X, Y + eps, Z) - Az(X, Y - eps, Z)) / (2 * eps);
    const dAy_dz = (Ay(X, Y, Z + eps) - Ay(X, Y, Z - eps)) / (2 * eps);

    const dAx_dz = (Ax(X, Y, Z + eps) - Ax(X, Y, Z - eps)) / (2 * eps);
    const dAz_dx = (Az(X + eps, Y, Z) - Az(X - eps, Y, Z)) / (2 * eps);

    const dAy_dx = (Ay(X + eps, Y, Z) - Ay(X - eps, Y, Z)) / (2 * eps);
    const dAx_dy = (Ax(X, Y + eps, Z) - Ax(X, Y - eps, Z)) / (2 * eps);

    // Normalize-ish (optional)
    const cx = dAz_dy - dAy_dz;
    const cy = dAx_dz - dAz_dx;
    const cz = dAy_dx - dAx_dy;

    return { x: cx, y: cy, z: cz };
  }
}
