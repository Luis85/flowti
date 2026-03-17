export class NoiseField {
  constructor(private seed = 1337) {}

  // Deterministic hash -> [0,1)
  private hash4(x: number, y: number, z: number, t: number): number {
    // Convert to 32-bit ints
    const xi = (x | 0) >>> 0;
    const yi = (y | 0) >>> 0;
    const zi = (z | 0) >>> 0;
    const ti = (t | 0) >>> 0;

    let h = (xi * 374761393 + yi * 668265263 + zi * 2147483647 + ti * 1274126177 + (this.seed >>> 0)) >>> 0;
    h ^= h >>> 13;
    h = (h * 1274126177) >>> 0;
    h ^= h >>> 16;

    // Map to [0,1)
    return (h >>> 0) / 4294967296;
  }

  private fade(u: number): number {
    // smoothstep-ish
    return u * u * (3 - 2 * u);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Value noise in [-1,1], smoothly interpolated in 3D, time as 4th dimension.
   * This is “good enough” for coherent turbulence.
   */
  noise3(x: number, y: number, z: number, t: number): number {
    // integer lattice
    const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z), t0 = Math.floor(t);
    const x1 = x0 + 1, y1 = y0 + 1, z1 = z0 + 1, t1 = t0 + 1;

    const fx = this.fade(x - x0);
    const fy = this.fade(y - y0);
    const fz = this.fade(z - z0);
    const ft = this.fade(t - t0);

    // 16 corners (3D + time)
    const v0000 = this.hash4(x0, y0, z0, t0);
    const v1000 = this.hash4(x1, y0, z0, t0);
    const v0100 = this.hash4(x0, y1, z0, t0);
    const v1100 = this.hash4(x1, y1, z0, t0);
    const v0010 = this.hash4(x0, y0, z1, t0);
    const v1010 = this.hash4(x1, y0, z1, t0);
    const v0110 = this.hash4(x0, y1, z1, t0);
    const v1110 = this.hash4(x1, y1, z1, t0);

    const v0001 = this.hash4(x0, y0, z0, t1);
    const v1001 = this.hash4(x1, y0, z0, t1);
    const v0101 = this.hash4(x0, y1, z0, t1);
    const v1101 = this.hash4(x1, y1, z0, t1);
    const v0011 = this.hash4(x0, y0, z1, t1);
    const v1011 = this.hash4(x1, y0, z1, t1);
    const v0111 = this.hash4(x0, y1, z1, t1);
    const v1111 = this.hash4(x1, y1, z1, t1);

    // trilinear + time lerp
    const x00 = this.lerp(v0000, v1000, fx);
    const x10 = this.lerp(v0100, v1100, fx);
    const x01 = this.lerp(v0010, v1010, fx);
    const x11 = this.lerp(v0110, v1110, fx);

    const y0z0 = this.lerp(x00, x10, fy);
    const y0z1 = this.lerp(x01, x11, fy);
    const t0v = this.lerp(y0z0, y0z1, fz);

    const X00 = this.lerp(v0001, v1001, fx);
    const X10 = this.lerp(v0101, v1101, fx);
    const X01 = this.lerp(v0011, v1011, fx);
    const X11 = this.lerp(v0111, v1111, fx);

    const Y0Z0 = this.lerp(X00, X10, fy);
    const Y0Z1 = this.lerp(X01, X11, fy);
    const t1v = this.lerp(Y0Z0, Y0Z1, fz);

    const v = this.lerp(t0v, t1v, ft);

    // map [0,1) -> [-1,1]
    return v * 2 - 1;
  }
}
