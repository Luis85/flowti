/**
 * ParticleSystem
 *
 * Manages particle state (positions, velocities, diagnostics) and advection.
 * Uses Structure-of-Arrays (SoA) layout for cache-friendly iteration.
 *
 * Trail history is delegated to TrailBuffer.
 */

import type { TunnelBounds, SimulationParams, Obstacle, SimSnapshot, Vec3 } from "./types";
import { BoundarySystem } from "./BoundarySystem";
import { CurlNoiseField } from "./CurlNoiseField";
import { VortexSystem } from "./VortexSystem";
import { TrailBuffer } from "./TrailBuffer";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

// Time step limits
const DEFAULT_DT = 0.016;
const MAX_DT = 0.05;

// Velocity blending (viscosity mapping)
const BLEND_MIN = 0.15;
const BLEND_MAX = 0.90;

// Turbulence
const TURBULENCE_SCALE = 0.25;
const TURBULENCE_CLAMP_FACTOR = 1.25; // maxNoise = factor * windSpeed

// Vortex influence
const VORTEX_SCALE = 0.6;

// Obstacle interaction
const OBSTACLE_INFLUENCE_RADII = 3.0;    // Influence extends to N * radius
const OBSTACLE_SHELL_FACTOR = 1.05;      // Push-out shell = factor * radius
const OBSTACLE_PUSH_STRENGTH = 10.0;     // Push-out velocity scale
const OBSTACLE_FLOW_REDUCTION = 0.35;    // Forward flow reduction near obstacle
const OBSTACLE_DEFLECTION_STRENGTH = 0.85; // Sideways deflection scale

// Obstacle heat (collision highlighting)
const HEAT_SHELL_FACTOR = 1.15;          // Heat shell = factor * radius
const HEAT_INFLUENCE_RADII = 2.5;        // Heat influence extends to N * radius
const HEAT_DECAY_DEFAULT = 2.5;

// Boundary padding
const BOUNDARY_PADDING = 0.5;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface TargetVelocity {
	x: number;
	y: number;
	z: number;
}

// ─────────────────────────────────────────────────────────────
// ParticleSystem
// ─────────────────────────────────────────────────────────────

export class ParticleSystem {
	readonly count: number;
	readonly trailLen: number;

	// Position (SoA)
	x: Float32Array;
	y: Float32Array;
	z: Float32Array;

	// Velocity (SoA)
	vx: Float32Array;
	vy: Float32Array;
	vz: Float32Array;

	// Diagnostics
	speed: Float32Array;
	vort: Float32Array;

	// Per-particle state
	phase: Float32Array;
	heat: Float32Array;

	// Trail management
	private trails: TrailBuffer;

	constructor(count: number, trailLen: number) {
		this.count = Math.max(0, Math.floor(count));
		this.trailLen = Math.max(1, Math.floor(trailLen));

		// Allocate buffers
		this.x = new Float32Array(this.count);
		this.y = new Float32Array(this.count);
		this.z = new Float32Array(this.count);

		this.vx = new Float32Array(this.count);
		this.vy = new Float32Array(this.count);
		this.vz = new Float32Array(this.count);

		this.speed = new Float32Array(this.count);
		this.vort = new Float32Array(this.count);

		this.phase = new Float32Array(this.count);
		this.heat = new Float32Array(this.count);

		this.trails = new TrailBuffer(this.count, this.trailLen);

		// Initialize with defaults
		for (let i = 0; i < this.count; i++) {
			this.phase[i] = Math.random() * Math.PI * 2;
			this.trails.init(i, 0, 0, 0);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────────────────────

	advect(
		dt: number,
		params: SimulationParams,
		obstacles: Obstacle[],
		boundary: BoundarySystem,
		vortices: VortexSystem,
		curlNoise: CurlNoiseField,
		simTime: number
	): void {
		dt = this.clampDt(dt);

		const bounds = params.tunnelBounds;
		const blendFactor = this.computeBlendFactor(params.viscosity ?? 0);
		const heatDecay = params.trailHeatDecay ?? HEAT_DECAY_DEFAULT;

		// Recycle particles at outlet
		boundary.recycle(this, params, simTime);

		// Advect each particle
		for (let i = 0; i < this.count; i++) {
			const pos = this.getPosition(i);

			// Compute target velocity from all influences
			const target = this.computeTargetVelocity(
				pos, params, obstacles, boundary, vortices, curlNoise, simTime
			);

			// Update heat (collision highlighting)
			this.updateHeat(i, pos, obstacles, dt, heatDecay);

			// Integrate velocity with blending
			this.integrateVelocity(i, target, blendFactor);

			// Integrate position (updates this.x/y/z in place)
			this.integratePosition(i, dt, bounds);

			// Update diagnostics
			this.updateDiagnostics(i, curlNoise, pos, simTime, params.turbulence ?? 0);
		}

		// Batch update trails (much faster than per-particle push)
		this.trails.pushAll(this.x, this.y, this.z, this.heat, this.count);

		// Enforce wall boundaries
		boundary.enforce(this);
	}

	respawn(i: number, bounds: TunnelBounds, params?: SimulationParams): void {
		const [xMin, xMax] = bounds.x;
		const [yMin, yMax] = bounds.y;
		const [zMin, zMax] = bounds.z;

		// Spawn near inlet with slight random offset
		this.x[i] = xMin + (xMax - xMin) * 0.01 * Math.random();
		this.y[i] = yMin + (yMax - yMin) * Math.random();
		this.z[i] = zMin + (zMax - zMin) * Math.random();

		this.vx[i] = 0;
		this.vy[i] = 0;
		this.vz[i] = 0;

		// Reset heat
		const resetHeat = params?.resetTrailHeatOnRespawn ?? true;
		if (resetHeat) {
			this.heat[i] = 0;
			this.trails.clearHeat(i);
		}

		// Reset trail positions
		this.trails.init(i, this.x[i], this.y[i], this.z[i]);
	}

	seedFill(bounds: TunnelBounds, params: SimulationParams): void {
		const [x0, x1] = bounds.x;
		const [y0, y1] = bounds.y;
		const [z0, z1] = bounds.z;

		for (let i = 0; i < this.count; i++) {
			// Random position in tunnel
			this.x[i] = x0 + Math.random() * (x1 - x0);
			this.y[i] = y0 + Math.random() * (y1 - y0);
			this.z[i] = z0 + Math.random() * (z1 - z0);

			// Initial velocity based on inlet profile
			const vel = this.computeInletVelocity(this.y[i], this.z[i], bounds, params);
			this.vx[i] = vel.x;
			this.vy[i] = vel.y;
			this.vz[i] = vel.z;

			// Initialize trail at current position
			this.trails.init(i, this.x[i], this.y[i], this.z[i]);
		}
	}

	buildSnapshot(): SimSnapshot {
		// Pack positions for renderer
		const positions = new Float32Array(this.count * 3);
		for (let i = 0; i < this.count; i++) {
			const idx = i * 3;
			positions[idx] = this.x[i];
			positions[idx + 1] = this.y[i];
			positions[idx + 2] = this.z[i];
		}

		const trailData = this.trails.getData();

		return {
			particleCount: this.count,
			positions,
			speeds: this.speed,
			vorticity: this.vort,
			trails: trailData.positions,
			trailLen: this.trailLen,
			trailHeat: trailData.heat,
		};
	}

	// ─────────────────────────────────────────────────────────────
	// Velocity Computation
	// ─────────────────────────────────────────────────────────────

	private computeTargetVelocity(
		pos: Vec3,
		params: SimulationParams,
		obstacles: Obstacle[],
		boundary: BoundarySystem,
		vortices: VortexSystem,
		curlNoise: CurlNoiseField,
		simTime: number
	): TargetVelocity {
		// A) Base inlet flow
		const inlet = boundary.inletVelocity(pos.y, pos.z, params);
		let tx = inlet.x * Math.random();
		let ty = inlet.y * Math.random();
		let tz = inlet.z * Math.random();

		// B) Curl noise turbulence
		const noise = this.sampleTurbulence(pos, params, curlNoise, simTime);
		tx += noise.x;
		ty += noise.y;
		tz += noise.z;

		// C) Vortex field
		const vortex = this.sampleVortices(pos, vortices);
		tx += vortex.x;
		ty += vortex.y;
		tz += vortex.z;

		// D) Obstacle deflection
		const obstacle = this.computeObstacleVelocity(pos, obstacles, inlet.x);
		tx += obstacle.x;
		ty += obstacle.y;
		tz += obstacle.z;

		return { x: tx, y: ty, z: tz };
	}

	private sampleTurbulence(
		pos: Vec3,
		params: SimulationParams,
		curlNoise: CurlNoiseField,
		simTime: number
	): Vec3 {
		const turb = params.turbulence ?? 0;
		const wind = params.windSpeed ?? 0;
		const maxNoise = Math.max(0.5, TURBULENCE_CLAMP_FACTOR * wind);

		const cn = curlNoise.sample(pos.x, pos.y, pos.z, simTime);

		const scale = turb * TURBULENCE_SCALE;
		return {
			x: this.clamp(cn.x * scale, -maxNoise, maxNoise),
			y: this.clamp(cn.y * scale, -maxNoise, maxNoise),
			z: this.clamp(cn.z * scale, -maxNoise, maxNoise),
		};
	}

	private sampleVortices(pos: Vec3, vortices: VortexSystem): Vec3 {
		if (!vortices?.sampleVelocity) {
			return { x: 0, y: 0, z: 0 };
		}

		const v = vortices.sampleVelocity(pos);
		return {
			x: v.x * VORTEX_SCALE,
			y: v.y * VORTEX_SCALE,
			z: v.z * VORTEX_SCALE,
		};
	}

	private computeObstacleVelocity(pos: Vec3, obstacles: Obstacle[], baseFlowX: number): Vec3 {
		let ax = 0, ay = 0, az = 0;

		for (const obs of obstacles) {
			if (obs.boundingType !== "sphere") continue;

			const radius = Math.max(1e-4, obs.boundingSize.x);
			const delta = this.vectorTo(obs.position, pos);
			const dist = this.magnitude(delta);

			// Check influence range
			const influence = OBSTACLE_INFLUENCE_RADII * radius;
			if (dist > influence) continue;

			// Normalized direction away from obstacle
			const normal = this.normalize(delta, dist);

			// 1) Push-out if penetrating shell
			const shell = OBSTACLE_SHELL_FACTOR * radius;
			if (dist < shell) {
				const push = (shell - dist) / shell;
				const strength = OBSTACLE_PUSH_STRENGTH * push * baseFlowX;
				ax += normal.x * strength;
				ay += normal.y * strength;
				az += normal.z * strength;
			}

			// 2) Deflection around obstacle
			const falloff = this.computeFalloff(dist, radius, influence);
			const falloff2 = falloff * falloff;

			// Reduce forward flow
			ax -= baseFlowX * OBSTACLE_FLOW_REDUCTION * falloff2;

			// Add tangential deflection: tangent = cross(flowDir, normal)
			// flowDir = (1,0,0), so tangent = (0, -nz, ny)
			const tangentY = -normal.z;
			const tangentZ = normal.y;
			const deflection = baseFlowX * OBSTACLE_DEFLECTION_STRENGTH * falloff2;

			ay += tangentY * deflection;
			az += tangentZ * deflection;
		}

		return { x: ax, y: ay, z: az };
	}

	// ─────────────────────────────────────────────────────────────
	// Integration
	// ─────────────────────────────────────────────────────────────

	private integrateVelocity(i: number, target: TargetVelocity, blend: number): void {
		const retain = 1 - blend;
		this.vx[i] = this.vx[i] * retain + target.x * blend;
		this.vy[i] = this.vy[i] * retain + target.y * blend;
		this.vz[i] = this.vz[i] * retain + target.z * blend;
	}

	private integratePosition(i: number, dt: number, bounds: TunnelBounds): void {
		const [yMin, yMax] = bounds.y;
		const [zMin, zMax] = bounds.z;

		// Integrate
		const nx = this.x[i] + this.vx[i] * dt;
		let ny = this.y[i] + this.vy[i] * dt;
		let nz = this.z[i] + this.vz[i] * dt;

		// Clamp Y/Z (X is open for outlet)
		ny = this.clamp(ny, yMin - BOUNDARY_PADDING, yMax + BOUNDARY_PADDING);
		nz = this.clamp(nz, zMin - BOUNDARY_PADDING, zMax + BOUNDARY_PADDING);

		this.x[i] = nx;
		this.y[i] = ny;
		this.z[i] = nz;
	}

	// ─────────────────────────────────────────────────────────────
	// Heat (Collision Highlighting)
	// ─────────────────────────────────────────────────────────────

	private updateHeat(i: number, pos: Vec3, obstacles: Obstacle[], dt: number, decay: number): void {
		// Decay existing heat
		this.heat[i] *= Math.exp(-dt * decay);

		// Check for new heat from obstacles
		const newHeat = this.computeObstacleHeat(pos, obstacles);
		if (newHeat > this.heat[i]) {
			this.heat[i] = newHeat;
		}
	}

	private computeObstacleHeat(pos: Vec3, obstacles: Obstacle[]): number {
		let maxHeat = 0;

		for (const obs of obstacles) {
			if (obs.boundingType !== "sphere") continue;

			const radius = Math.max(1e-4, obs.boundingSize.x);
			const delta = this.vectorTo(obs.position, pos);
			const dist = this.magnitude(delta);

			const shell = HEAT_SHELL_FACTOR * radius;
			const influence = HEAT_INFLUENCE_RADII * radius;

			if (dist > influence) continue;

			let heat: number;
			if (dist <= shell) {
				heat = 1.0;
			} else {
				// Linear falloff from shell to influence
				heat = 1 - (dist - shell) / (influence - shell);
				heat = this.clamp(heat, 0, 1);
			}

			maxHeat = Math.max(maxHeat, heat);
		}

		return maxHeat;
	}

	// ─────────────────────────────────────────────────────────────
	// Diagnostics
	// ─────────────────────────────────────────────────────────────

	private updateDiagnostics(
		i: number,
		curlNoise: CurlNoiseField,
		pos: Vec3,
		simTime: number,
		turbulence: number
	): void {
		// Speed magnitude
		const vx = this.vx[i], vy = this.vy[i], vz = this.vz[i];
		this.speed[i] = Math.sqrt(vx * vx + vy * vy + vz * vz);

		// Vorticity proxy (curl noise magnitude)
		const cn = curlNoise.sample(pos.x, pos.y, pos.z, simTime);
		this.vort[i] = Math.sqrt(cn.x * cn.x + cn.y * cn.y + cn.z * cn.z) * turbulence;
	}

	// ─────────────────────────────────────────────────────────────
	// Inlet Velocity (for seedFill)
	// ─────────────────────────────────────────────────────────────

	private computeInletVelocity(y: number, z: number, bounds: TunnelBounds, params: SimulationParams): Vec3 {
		const profile = params.inletProfile ?? "uniform";
		const base = params.windSpeed ?? 0;

		if (profile === "uniform") {
			return { x: base, y: 0, z: 0 };
		}

		// Parabolic profile
		const [y0, y1] = bounds.y;
		const [z0, z1] = bounds.z;

		const cy = (y0 + y1) * 0.5;
		const cz = (z0 + z1) * 0.5;
		const hy = Math.max(1e-6, (y1 - y0) * 0.5);
		const hz = Math.max(1e-6, (z1 - z0) * 0.5);

		const ny = (y - cy) / hy;
		const nz = (z - cz) / hz;
		const r2 = ny * ny + nz * nz;
		const scale = Math.max(0, 1 - r2);

		return { x: base * scale, y: 0, z: 0 };
	}

	// ─────────────────────────────────────────────────────────────
	// Helpers
	// ─────────────────────────────────────────────────────────────

	private getPosition(i: number): Vec3 {
		return { x: this.x[i], y: this.y[i], z: this.z[i] };
	}

	private clampDt(dt: number): number {
		if (dt <= 0 || dt > MAX_DT) return DEFAULT_DT;
		return dt;
	}

	private computeBlendFactor(viscosity: number): number {
		const v = this.clamp(viscosity, 0, 1);
		return BLEND_MIN + v * (BLEND_MAX - BLEND_MIN);
	}

	private computeFalloff(dist: number, radius: number, influence: number): number {
		const t = 1 - (dist - radius) / (influence - radius);
		return this.clamp(t, 0, 1);
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}

	private vectorTo(from: Vec3, to: Vec3): Vec3 {
		return {
			x: to.x - from.x,
			y: to.y - from.y,
			z: to.z - from.z,
		};
	}

	private magnitude(v: Vec3): number {
		return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
	}

	private normalize(v: Vec3, mag?: number): Vec3 {
		const m = mag ?? this.magnitude(v);
		const invM = m > 1e-6 ? 1 / m : 0;
		return {
			x: v.x * invM,
			y: v.y * invM,
			z: v.z * invM,
		};
	}
}
