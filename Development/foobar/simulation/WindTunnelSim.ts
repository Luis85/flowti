/**
 * WindTunnelSim
 *
 * Headless wind tunnel simulation handling particle advection,
 * boundary conditions, vortex shedding, and noise-based turbulence.
 *
 * This class owns the simulation state and physics; rendering is handled separately.
 */

import type { SimulationParams, Obstacle, VisualizationParams, SimSnapshot } from "./types";

import { BoundarySystem } from "./BoundarySystem";
import { NoiseField } from "./NoiseField";
import { CurlNoiseField } from "./CurlNoiseField";
import { VortexSystem } from "./VortexSystem";
import { ParticleSystem } from "./ParticleSystem";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DEFAULT_DT = 0.016; // ~60fps fallback
const MAX_DT = 0.1; // Clamp large dt to prevent instability
const NOISE_SEED = 1337 + (Math.random() * 100);

// ─────────────────────────────────────────────────────────────
// Simulation
// ─────────────────────────────────────────────────────────────

export class WindTunnelSim {
	private simTime = 0;
	private paused = false;

	private params: SimulationParams;
	private obstacles: Obstacle[];
	private vis: VisualizationParams;

	// Subsystems
	private particles: ParticleSystem;
	private boundary: BoundarySystem;
	private noise: NoiseField;
	private curl: CurlNoiseField;
	private vortices: VortexSystem;

	private disposed = false;

	constructor(
		params: SimulationParams,
		obstacles: Obstacle[],
		vis: VisualizationParams
	) {
		// Defensive copy to prevent external mutation
		this.params = { ...params };
		this.obstacles = obstacles?.slice() ?? [];
		this.vis = { ...vis };

		// Initialize subsystems
		this.boundary = new BoundarySystem(this.params.tunnelBounds);
		this.noise = new NoiseField(NOISE_SEED);
		this.curl = new CurlNoiseField(this.noise);
		this.vortices = new VortexSystem();

		this.particles = this.createParticleSystem();
		this.particles.seedFill(this.params.tunnelBounds, this.params);
	}

	// ─────────────────────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────────────────────

	dispose() {
		if (this.disposed) return;
		this.disposed = true;

		// Clear references (subsystems currently don't hold external resources)
		this.obstacles = [];
	}

	setPaused(paused: boolean) {
		this.paused = paused;
	}

	getParams(): SimulationParams {
		return this.params;
	}

	getVisualization(): VisualizationParams {
		return this.vis;
	}

	setParams(patch: Partial<SimulationParams>) {
		if (!patch) return;

		const prevCount = this.params.particleCount;
		const prevBounds = this.params.tunnelBounds;

		this.params = { ...this.params, ...patch };

		// Particle count changed -> rebuild particle system
		if (patch.particleCount !== undefined && patch.particleCount !== prevCount) {
			this.rebuildParticles();
		}

		// Bounds changed -> rebuild boundary system
		if (patch.tunnelBounds && patch.tunnelBounds !== prevBounds) {
			this.boundary = new BoundarySystem(this.params.tunnelBounds);
		}
	}

	setVisualization(patch: Partial<VisualizationParams>) {
		if (!patch) return;

		const prevTrailLen = this.vis.trailLength;
		this.vis = { ...this.vis, ...patch };

		// Trail length changed -> rebuild particle system
		if (this.vis.trailLength !== prevTrailLen) {
			this.rebuildParticles({ reseed: true });
		}
	}

	setObstacles(obstacles: Obstacle[]) {
		this.obstacles = obstacles?.slice() ?? [];
	}

	/**
	 * Explicit rebuild for visualization changes.
	 * Prefer setVisualization() for most cases.
	 */
	rebuildForVis(trailLen: number, visPatch?: Partial<VisualizationParams>) {
		if (visPatch) {
			this.vis = { ...this.vis, ...visPatch };
		}

		this.vis.trailLength = Math.max(1, Math.floor(trailLen));
		this.rebuildParticles();
	}

	update(dt: number): SimSnapshot {
		if (this.paused || this.disposed) {
			return this.particles.buildSnapshot();
		}

		// Clamp dt for stability
		dt = this.clampDt(dt);
		this.simTime += dt;

		// Update subsystems
		this.vortices.update(this.params, this.obstacles, this.simTime);
		this.boundary.prepareStep(this.params, this.simTime);

		// Advect particles
		this.particles.advect(
			dt,
			this.params,
			this.obstacles,
			this.boundary,
			this.vortices,
			this.curl,
			this.simTime
		);

		return this.particles.buildSnapshot();
	}

	// ─────────────────────────────────────────────────────────────
	// Private Helpers
	// ─────────────────────────────────────────────────────────────

	private createParticleSystem(): ParticleSystem {
		const count = Math.max(0, Math.floor(this.params.particleCount));
		const trailLen = Math.max(1, Math.floor(this.vis.trailLength));

		return new ParticleSystem(count, trailLen);
	}

	private rebuildParticles(options?: { reseed?: boolean }) {
		this.particles = this.createParticleSystem();

		if (options?.reseed) {
			this.particles.seedFill(this.params.tunnelBounds, this.params);
		}
	}

	private clampDt(dt: number): number {
		if (dt <= 0 || dt > MAX_DT) {
			return DEFAULT_DT;
		}
		return dt;
	}
}
