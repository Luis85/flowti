/**
 * BoundarySystem
 *
 * Handles tunnel boundary conditions:
 * - Inlet velocity profiles (uniform, parabolic)
 * - Particle recycling at outlet/walls
 * - Wall enforcement (bounce/clamp)
 *
 * Convention:
 * - Flow direction is +X
 * - Inlet at xMin, outlet at xMax
 * - Y and Z are cross-section (walls)
 */

import type { SimulationParams, TunnelBounds, Vec3 } from "./types";
import type { ParticleSystem } from "./ParticleSystem";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// Recycling thresholds
const OUTLET_MARGIN = 0.05;      // Allow slight overshoot past outlet
const INLET_BACKFLOW_MARGIN = 0.5; // Respawn if particle goes this far behind inlet

// Wall bounce factor (> 1 gives slight energy gain for visual "liveliness")
const WALL_BOUNCE_FACTOR = .35;

// Minimum half-size to prevent division by zero
const MIN_HALF_SIZE = 1e-6;

// ─────────────────────────────────────────────────────────────
// BoundarySystem
// ─────────────────────────────────────────────────────────────

export class BoundarySystem {
	private bounds: TunnelBounds;

	constructor(bounds: TunnelBounds) {
		this.bounds = bounds;
	}

	// ─────────────────────────────────────────────────────────────
	// Configuration
	// ─────────────────────────────────────────────────────────────

	setBounds(bounds: TunnelBounds): void {
		this.bounds = bounds;
	}

	getBounds(): TunnelBounds {
		return this.bounds;
	}

	/**
	 * Called once per simulation step.
	 * Placeholder for dynamic boundary behavior (e.g., pulsing inlet, moving walls).
	 */
	prepareStep(_params: SimulationParams, _time: number): void {
		// Reserved for future use
	}

	// ─────────────────────────────────────────────────────────────
	// Inlet Velocity
	// ─────────────────────────────────────────────────────────────

	/**
	 * Returns inlet velocity at position (y, z) in the tunnel cross-section.
	 *
	 * Profiles:
	 * - "uniform": Constant velocity across the inlet
	 * - "parabolic": Higher velocity in center, tapering to zero at walls
	 */
	inletVelocity(y: number, z: number, params: SimulationParams): Vec3 {
		const baseSpeed = params.windSpeed ?? 0;
		const profile = params.inletProfile ?? "uniform";

		if (profile === "uniform") {
			return { x: baseSpeed, y: 0, z: 0 };
		}

		// Parabolic profile: velocity = baseSpeed * (1 - r²)
		// where r is normalized distance from center (0 at center, 1 at walls)
		const scale = this.computeParabolicScale(y, z);
		return { x: baseSpeed * scale, y: 0, z: 0 };
	}

	private computeParabolicScale(y: number, z: number): number {
		const [yMin, yMax] = this.bounds.y;
		const [zMin, zMax] = this.bounds.z;

		// Center of cross-section
		const centerY = (yMin + yMax) * 0.5;
		const centerZ = (zMin + zMax) * 0.5;

		// Half-sizes (with safety minimum)
		const halfY = Math.max(MIN_HALF_SIZE, (yMax - yMin) * 0.5);
		const halfZ = Math.max(MIN_HALF_SIZE, (zMax - zMin) * 0.5);

		// Normalized coordinates [-1, 1]
		const ny = (y - centerY) / halfY;
		const nz = (z - centerZ) / halfZ;

		// Parabolic falloff: 1 at center, 0 at edges
		const r2 = ny * ny + nz * nz;
		return Math.max(0, 1 - r2);
	}

	// ─────────────────────────────────────────────────────────────
	// Particle Recycling
	// ─────────────────────────────────────────────────────────────

	/**
	 * Recycles particles that have left the tunnel bounds.
	 * Particles are respawned at the inlet with appropriate velocity.
	 */
	recycle(particles: ParticleSystem, params: SimulationParams, _time: number): void {
		for (let i = 0; i < particles.count; i++) {
			if (this.shouldRecycle(particles, i)) {
				this.recycleParticle(particles, i, params);
			}
		}
	}

	private shouldRecycle(particles: ParticleSystem, i: number): boolean {
		const x = particles.x[i];
		const y = particles.y[i];
		const z = particles.z[i];

		const [xMin, xMax] = this.bounds.x;
		const [yMin, yMax] = this.bounds.y;
		const [zMin, zMax] = this.bounds.z;

		// Out of Y/Z bounds (escaped through walls)
		const outOfCrossSection = y < yMin || y > yMax || z < zMin || z > zMax;

		// Past outlet
		const pastOutlet = x > xMax + OUTLET_MARGIN;

		// Backflowed behind inlet
		const behindInlet = x < xMin - INLET_BACKFLOW_MARGIN;

		return outOfCrossSection || pastOutlet || behindInlet;
	}

	private recycleParticle(particles: ParticleSystem, i: number, params: SimulationParams): void {
		// Respawn at inlet
		particles.respawn(i, this.bounds, params);

		// Set velocity based on inlet profile
		const velocity = this.inletVelocity(particles.y[i], particles.z[i], params);
		particles.vx[i] = velocity.x;
		particles.vy[i] = velocity.y;
		particles.vz[i] = velocity.z;
	}

	// ─────────────────────────────────────────────────────────────
	// Wall Enforcement
	// ─────────────────────────────────────────────────────────────

	/**
	 * Enforces wall boundaries by clamping positions and bouncing velocities.
	 * Applied after advection to prevent particles from escaping due to large forces.
	 *
	 * Note: WALL_BOUNCE_FACTOR > 1 gives slight energy gain for visual "liveliness".
	 * Set to < 1 for energy-dissipating collisions if needed.
	 */
	enforce(particles: ParticleSystem): void {
		const [yMin, yMax] = this.bounds.y;
		const [zMin, zMax] = this.bounds.z;

		for (let i = 0; i < particles.count; i++) {
			// Y walls
			if (particles.y[i] < yMin) {
				particles.y[i] = yMin;
				particles.vy[i] *= -WALL_BOUNCE_FACTOR;
			} else if (particles.y[i] > yMax) {
				particles.y[i] = yMax;
				particles.vy[i] *= -WALL_BOUNCE_FACTOR;
			}

			// Z walls
			if (particles.z[i] < zMin) {
				particles.z[i] = zMin;
				particles.vz[i] *= -WALL_BOUNCE_FACTOR;
			} else if (particles.z[i] > zMax) {
				particles.z[i] = zMax;
				particles.vz[i] *= -WALL_BOUNCE_FACTOR;
			}
		}
	}
}
