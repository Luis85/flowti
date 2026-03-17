/**
 * BabylonParticleRenderer
 *
 * Renders particles and trails for the wind tunnel simulation.
 * Handles vertex buffer management, color mapping, and display modes.
 */

import type { SimSnapshot, SimulationParams, VisualizationParams } from "simulation/types";
import { safeDispose } from "./helpers";
import * as BABYLON from "@babylonjs/core";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const HIDDEN_POSITION = 1e9;
const RANGE_SMOOTH_ALPHA = 0.08;
const MIN_RANGE_DELTA = 1e-6;

const DEFAULT_POINT_SIZE = 2.0;
const DEFAULT_OPACITY = 0.9;
const DEFAULT_TRAIL_STRIDE = 8;

// Trail color constants
const TRAIL_COLD_ALPHA = 0.08;
const TRAIL_HOT_THRESHOLD = 0.01;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface RendererConfig {
	pointSize?: number;
	opacity?: number;
	trailStride?: number;
}

interface TrailState {
	mesh: BABYLON.LinesMesh;
	material: BABYLON.StandardMaterial;
	positions: Float32Array;
	colors: Float32Array;
	map: Int32Array; // maps trail vertex -> snapshot.trails offset
	len: number;
	lineCount: number;
	vertexCount: number;
}

interface ColorRange {
	lo: number;
	hi: number;
}

type RGB = [number, number, number];
type ColorScaleFn = (t: number) => RGB;

// ─────────────────────────────────────────────────────────────
// Color Scales
// ─────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const COLOR_SCALES: Record<VisualizationParams["colorScale"], ColorScaleFn> = {
	thermal: (t) => {
		const r = clamp01(t * 2);
		const g = clamp01((t - 0.5) * 2);
		const b = clamp01((t - 0.85) * 6);
		return [r, g, b];
	},

	cool: (t) => [t, 1 - t, 1],

	blueRed: (t) => [t, 0, 1 - t],

	rainbow: (t) => {
		const h = (1 - t) * 240;
		const x = 1 - Math.abs(((h / 60) % 2) - 1);

		if (h < 60) return [1, x, 0];
		if (h < 120) return [x, 1, 0];
		if (h < 180) return [0, 1, x];
		if (h < 240) return [0, x, 1];
		return [0, 0, 1];
	},
};

// ─────────────────────────────────────────────────────────────
// Renderer
// ─────────────────────────────────────────────────────────────

export class BabylonParticleRenderer {
	private scene?: BABYLON.Scene;

	// Particle rendering
	private mesh?: BABYLON.Mesh;
	private material?: BABYLON.StandardMaterial;
	private positions?: Float32Array;
	private colors?: Float32Array;
	private maxParticles = 0;

	// Trail rendering
	private trail?: TrailState;
	private trailStride = DEFAULT_TRAIL_STRIDE;

	// Config
	private config: Required<RendererConfig> = {
		pointSize: DEFAULT_POINT_SIZE,
		opacity: DEFAULT_OPACITY,
		trailStride: DEFAULT_TRAIL_STRIDE,
	};

	// Color range smoothing (prevents flickering)
	private smoothedRange: ColorRange = { lo: 0, hi: 1 };

	// ─────────────────────────────────────────────────────────────
	// Public API
	// ─────────────────────────────────────────────────────────────

	init(scene: BABYLON.Scene, maxParticles: number, config?: RendererConfig) {
		this.dispose();

		this.scene = scene;
		this.maxParticles = Math.max(0, Math.floor(maxParticles));
		this.applyConfig(config);

		this.initBuffers();
		this.initMesh(scene);
	}

	setConfig(patch: RendererConfig) {
		this.applyConfig(patch);

		if (this.mesh) {
			(this.mesh as any).pointsCloudSize = this.config.pointSize;
		}

		if (this.material) {
			this.material.alpha = this.config.opacity;
			(this.material as any).pointSize = this.config.pointSize;
		}
	}

	render(snapshot: SimSnapshot, vis: VisualizationParams, simParams?: SimulationParams) {
		if (!this.mesh || !this.positions || !this.colors) return;

		const mode = vis.displayMode ?? "particles";
		const showParticles = mode === "particles" || mode === "both";
		const showTrails = mode === "trails" || mode === "both";

		// Update particles
		this.updateParticlePositions(snapshot);
		this.updateParticleColors(snapshot, vis, simParams);
		this.mesh.setEnabled(showParticles);

		// Update trails
		if (showTrails && snapshot.trails && snapshot.trailLen) {
			this.ensureTrailState(snapshot);
			this.updateTrailPositions(snapshot);
			this.updateTrailColors(snapshot, vis);
			this.trail?.mesh.setEnabled(true);
		} else {
			this.trail?.mesh.setEnabled(false);
		}
	}

	dispose() {
		this.disposeTrail();
		safeDispose(this.mesh, this.material);

		this.mesh = undefined;
		this.material = undefined;
		this.scene = undefined;
		this.positions = undefined;
		this.colors = undefined;
		this.maxParticles = 0;
	}

	// ─────────────────────────────────────────────────────────────
	// Initialization
	// ─────────────────────────────────────────────────────────────

	private applyConfig(patch?: RendererConfig) {
		if (patch) {
			this.config = { ...this.config, ...patch };
		}
		this.trailStride = Math.max(1, Math.floor(this.config.trailStride));
	}

	private initBuffers() {
		this.positions = new Float32Array(this.maxParticles * 3);
		this.colors = new Float32Array(this.maxParticles * 4);
	}

	private initMesh(scene: BABYLON.Scene) {
		const mesh = new BABYLON.Mesh("windtunnel-points", scene);
		this.mesh = mesh;

		// Apply initial vertex data
		const vd = new BABYLON.VertexData();
		vd.positions = Array.from(this.positions!);
		vd.colors = Array.from(this.colors!);
		vd.applyToMesh(mesh, true);

		mesh.hasVertexAlpha = true;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.doNotSyncBoundingInfo = true;
		(mesh as any).isPointsCloud = true;
		(mesh as any).pointsCloudSize = this.config.pointSize;

		// Material
		this.material = this.createPointMaterial(scene, "windtunnel-points-mat");
		mesh.material = this.material;
	}

	private createPointMaterial(scene: BABYLON.Scene, name: string): BABYLON.StandardMaterial {
		const mat = new BABYLON.StandardMaterial(name, scene);

		mat.disableLighting = true;
		mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
		mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
		mat.specularColor = new BABYLON.Color3(0, 0, 0);
		mat.alpha = this.config.opacity;
		mat.needDepthPrePass = true;
		mat.backFaceCulling = false;

		(mat as any).pointsCloud = true;
		(mat as any).pointSize = this.config.pointSize;

		return mat;
	}

	// ─────────────────────────────────────────────────────────────
	// Particle Updates
	// ─────────────────────────────────────────────────────────────

	private updateParticlePositions(snapshot: SimSnapshot) {
		if (!this.positions || !this.mesh) return;

		const count = Math.min(snapshot.particleCount, this.maxParticles);
		const srcPos = snapshot.positions;

		// Copy active positions
		const activeFloats = count * 3;
		for (let i = 0; i < activeFloats; i++) {
			this.positions[i] = srcPos[i];
		}

		// Hide unused particles
		for (let i = activeFloats; i < this.positions.length; i += 3) {
			this.positions[i] = HIDDEN_POSITION;
			this.positions[i + 1] = HIDDEN_POSITION;
			this.positions[i + 2] = HIDDEN_POSITION;
		}

		this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, this.positions, true);
	}

	private updateParticleColors(snapshot: SimSnapshot, vis: VisualizationParams, simParams?: SimulationParams) {
		if (!this.colors || !this.mesh) return;

		const count = Math.min(snapshot.particleCount, this.maxParticles);
		const colorMode = vis.colorMode ?? "velocity";
		const colorScale = vis.colorScale ?? "thermal";
		const alpha = vis.opacity ?? this.config.opacity;

		const range = this.computeColorRange(snapshot, vis, simParams);
		const getValue = this.createValueGetter(snapshot, colorMode, simParams?.windSpeed ?? 1);
		const toColor = COLOR_SCALES[colorScale] ?? COLOR_SCALES.thermal;

		// Fill active particle colors
		for (let i = 0; i < count; i++) {
			const value = getValue(i);
			const t = this.normalize(value, range.lo, range.hi);
			const [r, g, b] = toColor(clamp01(t));

			const offset = i * 4;
			this.colors[offset] = r;
			this.colors[offset + 1] = g;
			this.colors[offset + 2] = b;
			this.colors[offset + 3] = alpha;
		}

		// Hide unused particles
		for (let i = count; i < this.maxParticles; i++) {
			const offset = i * 4;
			this.colors[offset] = 0;
			this.colors[offset + 1] = 0;
			this.colors[offset + 2] = 0;
			this.colors[offset + 3] = 0;
		}

		this.mesh.updateVerticesData(BABYLON.VertexBuffer.ColorKind, this.colors, true);
	}

	// ─────────────────────────────────────────────────────────────
	// Color Helpers
	// ─────────────────────────────────────────────────────────────

	private createValueGetter(
		snapshot: SimSnapshot,
		mode: VisualizationParams["colorMode"],
		windSpeed: number
	): (index: number) => number {
		const { speeds, vorticity } = snapshot;

		switch (mode) {
			case "uniform":
				return () => 1;

			case "pressure":
				// Pressure proxy: slower = higher pressure
				return (i) => Math.max(0, Math.min(1, 1 - (speeds[i] ?? 0) / (windSpeed + MIN_RANGE_DELTA)));

			case "vorticity":
				return (i) => vorticity[i] ?? 0;

			case "velocity":
			default:
				return (i) => speeds[i] ?? 0;
		}
	}

	private computeColorRange(
		snapshot: SimSnapshot,
		vis: VisualizationParams,
		simParams?: SimulationParams
	): ColorRange {
		const mode = vis.colorMode ?? "velocity";
		const windSpeed = simParams?.windSpeed ?? 1;

		let lo = 0;
		let hi = 1;

		switch (mode) {
			case "uniform":
				lo = 0;
				hi = 1;
				break;

			case "pressure":
				lo = 0;
				hi = 1;
				break;

			case "vorticity":
				hi = this.estimateVorticityMax(snapshot);
				break;

			case "velocity":
			default:
				hi = Math.max(MIN_RANGE_DELTA, windSpeed * 1.5);
				break;
		}

		return this.smoothRange(lo, hi);
	}

	private estimateVorticityMax(snapshot: SimSnapshot): number {
		const { vorticity, particleCount } = snapshot;
		const sampleStep = Math.max(1, Math.floor(particleCount / 128));

		let max = 0;
		for (let i = 0; i < particleCount; i += sampleStep) {
			max = Math.max(max, vorticity[i] ?? 0);
		}

		return Math.max(MIN_RANGE_DELTA, max);
	}

	private smoothRange(targetLo: number, targetHi: number): ColorRange {
		const a = RANGE_SMOOTH_ALPHA;

		this.smoothedRange.lo = this.smoothedRange.lo * (1 - a) + targetLo * a;
		this.smoothedRange.hi = this.smoothedRange.hi * (1 - a) + targetHi * a;

		// Prevent degenerate range
		if (this.smoothedRange.hi <= this.smoothedRange.lo + MIN_RANGE_DELTA) {
			this.smoothedRange.hi = this.smoothedRange.lo + MIN_RANGE_DELTA;
		}

		return this.smoothedRange;
	}

	private normalize(value: number, lo: number, hi: number): number {
		return clamp01((value - lo) / (hi - lo));
	}

	// ─────────────────────────────────────────────────────────────
	// Trail Management
	// ─────────────────────────────────────────────────────────────

	private ensureTrailState(snapshot: SimSnapshot) {
		if (!this.scene || !snapshot.trails || !snapshot.trailLen) return;

		const desiredLen = snapshot.trailLen;
		const desiredLineCount = Math.ceil(snapshot.particleCount / this.trailStride);

		const needsRebuild =
			!this.trail ||
			this.trail.len !== desiredLen ||
			this.trail.lineCount !== desiredLineCount;

		if (!needsRebuild) return;

		this.disposeTrail();
		this.trail = this.createTrailState(snapshot, desiredLen, desiredLineCount);
	}

	private createTrailState(
		snapshot: SimSnapshot,
		len: number,
		lineCount: number
	): TrailState {
		const vertexCount = lineCount * len;

		const positions = new Float32Array(vertexCount * 3);
		const colors = new Float32Array(vertexCount * 4);
		const map = new Int32Array(vertexCount);

		// Build line geometry and mapping
		const lines: BABYLON.Vector3[][] = [];
		let vi = 0;

		for (let li = 0; li < lineCount; li++) {
			const particleIndex = li * this.trailStride;
			const line: BABYLON.Vector3[] = [];

			for (let k = 0; k < len; k++) {
				line.push(new BABYLON.Vector3(0, 0, 0));

				// Map trail vertex to snapshot offset
				map[vi] = particleIndex < snapshot.particleCount
					? (particleIndex * len + k) * 3
					: -1;

				// Initialize colors (visible white)
				const co = vi * 4;
				colors[co] = 1;
				colors[co + 1] = 1;
				colors[co + 2] = 1;
				colors[co + 3] = this.config.opacity;

				vi++;
			}

			lines.push(line);
		}

		// Create mesh
		const mesh = BABYLON.MeshBuilder.CreateLineSystem(
			"windtunnel-trails",
			{ lines, updatable: true },
			this.scene!
		);

		mesh.isPickable = false;
		mesh.alwaysSelectAsActiveMesh = true;
		mesh.hasVertexAlpha = true;
		mesh.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true, 4);

		// Material
		const material = this.createTrailMaterial(this.scene!, "windtunnel-trails-mat");
		mesh.material = material;

		return { mesh, material, positions, colors, map, len, lineCount, vertexCount };
	}

	private createTrailMaterial(scene: BABYLON.Scene, name: string): BABYLON.StandardMaterial {
		const mat = new BABYLON.StandardMaterial(name, scene);

		mat.disableLighting = true;
		mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
		mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
		mat.specularColor = new BABYLON.Color3(0, 0, 0);
		mat.backFaceCulling = false;
		mat.alpha = 1; // Vertex alpha drives visibility

		return mat;
	}

	private updateTrailPositions(snapshot: SimSnapshot) {
		const trail = this.trail;
		if (!trail || !snapshot.trails) return;

		const { positions, map, vertexCount, mesh } = trail;
		const srcTrails = snapshot.trails;

		for (let vi = 0; vi < vertexCount; vi++) {
			const src = map[vi];
			const offset = vi * 3;

			if (src >= 0) {
				positions[offset] = srcTrails[src];
				positions[offset + 1] = srcTrails[src + 1];
				positions[offset + 2] = srcTrails[src + 2];
			} else {
				positions[offset] = HIDDEN_POSITION;
				positions[offset + 1] = HIDDEN_POSITION;
				positions[offset + 2] = HIDDEN_POSITION;
			}
		}

		mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);
	}

	private updateTrailColors(snapshot: SimSnapshot, vis: VisualizationParams) {
		const trail = this.trail;
		if (!trail) return;

		const heat = snapshot.trailHeat;
		if (!heat) return;

		const { colors, map, vertexCount, mesh } = trail;

		for (let vi = 0; vi < vertexCount; vi++) {
			const src = map[vi];
			const heatIndex = src >= 0 ? src / 3 : -1;
			const heatValue = heatIndex >= 0 ? (heat[heatIndex] ?? 0) : 0;

			const co = vi * 4;

			if (heatValue <= TRAIL_HOT_THRESHOLD) {
				// Cold: faint white
				colors[co] = 1;
				colors[co + 1] = 1;
				colors[co + 2] = 1;
				colors[co + 3] = TRAIL_COLD_ALPHA;
			} else {
				// Hot: orange glow
				const t = clamp01(heatValue);
				colors[co] = 1.0;
				colors[co + 1] = 0.6 * t;
				colors[co + 2] = 0.15 * t;
				colors[co + 3] = 0.9 * t;
			}
		}

		mesh.updateVerticesData(BABYLON.VertexBuffer.ColorKind, colors, true);
	}

	private disposeTrail() {
		if (this.trail) {
			safeDispose(this.trail.mesh, this.trail.material);
			this.trail = undefined;
		}
	}
}
