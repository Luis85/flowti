/**
 * Wind Tunnel (BabylonJS) — Obsidian Plugin View
 *
 * This view lets you explore a simple, interactive wind-tunnel simulation directly inside Obsidian.
 * You can pause the simulation to inspect the current flow state, orbit the camera, tweak parameters,
 * and quickly iterate on different "what if" settings while staying in your notes.
 *
 * Architecture:
 * - The simulation (physics/state) is handled by WindTunnelSim (headless).
 * - Rendering is handled by BabylonParticleRenderer (Babylon-only).
 * - This view orchestrates UI + rendering loop; it does not implement physics.
 */

import { ItemView, WorkspaceLeaf, Setting, SliderComponent, DropdownComponent } from "obsidian";
import { WindTunnelSim } from "simulation/WindTunnelSim";
import type { SimulationParams, VisualizationParams, Obstacle, SimSnapshot } from "simulation/types";
import { BabylonParticleRenderer } from "utils/BabylonParticleRenderer";
import * as BABYLON from "@babylonjs/core";
import { SCENE_PRESETS, getPreset } from "scenes/presets";
import { PresetCamera, safeDispose } from "utils/helpers";

export const WINDTUNNEL_VIEW_TYPE = "windtunnel-babylon-view";

export class WindTunnelBabylonView extends ItemView {
	// Babylon core
	private canvas?: HTMLCanvasElement;
	private engine?: BABYLON.Engine;
	private scene?: BABYLON.Scene;
	private camera?: BABYLON.ArcRotateCamera;

	// Simulation + Rendering
	private sim?: WindTunnelSim;
	private renderer?: BabylonParticleRenderer;
	private obstacleMeshes: BABYLON.AbstractMesh[] = [];

	// State
	private currentPresetId = "sphere-basic";
	private presetObstacles: Obstacle[] = [];
	private isPaused = false;
	private lastSnapshot?: SimSnapshot;
	private needsRender = true;

	private simParams: SimulationParams = {
		windSpeed: 3,
		particleCount: 8000,
		turbulence: 0.35,
		viscosity: 0.02,
		trailHeatDecay: 2.5,
		tunnelBounds: { x: [-10, 10], y: [-4, 4], z: [-4, 4] },
		inletProfile: "parabolic",
	};

	private visParams: VisualizationParams = {
		colorMode: "velocity",
		colorScale: "thermal",
		displayMode: "both",
		particleSize: 2.0,
		trailLength: 24,
		trailWidth: 0.03,
		opacity: 0.9,
	};

	// UI references for sync (avoids full rebuild on preset change)
	private sliders = new Map<string, SliderComponent>();
	private dropdowns = new Map<string, DropdownComponent>();

	// Observers
	private resizeObserver?: ResizeObserver;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType() {
		return WINDTUNNEL_VIEW_TYPE;
	}

	getDisplayText() {
		return "Wind Tunnel (BabylonJS)";
	}

	// ─────────────────────────────────────────────────────────────
	// Lifecycle
	// ─────────────────────────────────────────────────────────────

	async onOpen() {
		const container = this.containerEl.children[1] as HTMLElement;
		this.containerEl.style.overflow = "hidden";
		container.empty();

		const { sidebar, stage, canvas } = this.buildLayout(container);
		this.canvas = canvas;

		this.setupBabylon(canvas);
		this.buildSettingsUI(sidebar);
		this.loadPreset(this.currentPresetId);

		this.resizeObserver = new ResizeObserver(() => this.engine?.resize());
		this.resizeObserver.observe(stage);
	}

	async onClose() {
		this.resizeObserver?.disconnect();
		safeDispose(this.sim, this.renderer, this.scene, this.engine);

		this.sim = undefined;
		this.renderer = undefined;
		this.scene = undefined;
		this.engine = undefined;
	}

	// ─────────────────────────────────────────────────────────────
	// Layout
	// ─────────────────────────────────────────────────────────────

	private buildLayout(container: HTMLElement) {
		const root = container.createDiv({ cls: "wt-root" });
		Object.assign(root.style, {
			display: "grid",
			gridTemplateColumns: "320px 1fr",
			gap: "12px",
			height: "100%",
			overflow: "hidden",
		});

		const sidebar = root.createDiv({ cls: "windtunnel-sidebar" });
		Object.assign(sidebar.style, {
			padding: "8px",
			overflowY: "auto",
			maxHeight: "100%",
			minHeight: "0",
		});

		const stage = root.createDiv({ cls: "windtunnel-stage" });
		Object.assign(stage.style, {
			minHeight: "0",
			position: "relative",
			overflow: "hidden",
			height: "100%",
		});

		const canvas = stage.createEl("canvas", { cls: "windtunnel-canvas" });
		Object.assign(canvas.style, {
			width: "100%",
			height: "100%",
			display: "block",
		});

		return { sidebar, stage, canvas };
	}

	// ─────────────────────────────────────────────────────────────
	// Babylon Setup
	// ─────────────────────────────────────────────────────────────

	private setupBabylon(canvas: HTMLCanvasElement) {
		const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true });
		this.engine = engine;

		const scene = new BABYLON.Scene(engine);
		this.scene = scene;
		scene.clearColor = new BABYLON.Color4(0.06, 0.06, 0.08, 1.0);

		this.camera = this.createCamera(scene, canvas);
		this.createLight(scene);
		this.createTunnelGizmo(scene);
		this.createGrid2D(scene);

		engine.runRenderLoop(() => this.renderLoop());
	}

	private createCamera(scene: BABYLON.Scene, canvas: HTMLCanvasElement): BABYLON.ArcRotateCamera {
		const camera = new BABYLON.ArcRotateCamera(
			"cam",
			-Math.PI / 2,
			Math.PI / 3,
			22,
			BABYLON.Vector3.Zero(),
			scene
		);
		camera.attachControl(canvas as unknown as HTMLElement, true);
		camera.wheelPrecision = 40;
		return camera;
	}

	private createLight(scene: BABYLON.Scene) {
		const light = new BABYLON.HemisphericLight("hemi", new BABYLON.Vector3(0, 1, 0), scene);
		light.intensity = 0.9;
	}

	private createTunnelGizmo(scene: BABYLON.Scene) {
		const { x, y, z } = this.simParams.tunnelBounds;

		const box = BABYLON.MeshBuilder.CreateBox("tunnelBounds", {
			width: x[1] - x[0],
			height: y[1] - y[0],
			depth: z[1] - z[0],
		}, scene);

		box.position = new BABYLON.Vector3(
			(x[0] + x[1]) / 2,
			(y[0] + y[1]) / 2,
			(z[0] + z[1]) / 2
		);

		const mat = new BABYLON.StandardMaterial("tunnelMat", scene);
		mat.wireframe = false;
		mat.disableLighting = true;
		mat.alpha = 0;
		box.material = mat;
	}

	private createGrid2D(scene: BABYLON.Scene) {
		const b = this.simParams.tunnelBounds;
		const xMin = b.x[0] - 10, xMax = b.x[1] + 10;
		const zMin = b.z[0] - 2, zMax = b.z[1] + 2;
		const y = b.y[0];
		const step = 1;

		const lines: BABYLON.Vector3[][] = [];

		for (let z = Math.ceil(zMin); z <= Math.floor(zMax); z += step) {
			lines.push([new BABYLON.Vector3(xMin, y, z), new BABYLON.Vector3(xMax, y, z)]);
		}
		for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x += step) {
			lines.push([new BABYLON.Vector3(x, y, zMin), new BABYLON.Vector3(x, y, zMax)]);
		}

		const grid = BABYLON.MeshBuilder.CreateLineSystem("grid2d", { lines }, scene);
		grid.isPickable = false;
		grid.alwaysSelectAsActiveMesh = true;

		const mat = new BABYLON.StandardMaterial("grid2dMat", scene);
		mat.disableLighting = true;
		mat.emissiveColor = new BABYLON.Color3(0.35, 0.35, 0.4);
		mat.alpha = 0.15;
		grid.material = mat;
	}

	// ─────────────────────────────────────────────────────────────
	// Render Loop
	// ─────────────────────────────────────────────────────────────

	private renderLoop() {
		const { engine, scene, sim, renderer } = this;
		if (!engine || !scene) return;

		const dt = engine.getDeltaTime() / 1000;

		if (sim && renderer) {
			if (!this.isPaused) {
				this.lastSnapshot = sim.update(dt);
				this.needsRender = true;
			}

			if (this.needsRender && this.lastSnapshot) {
				renderer.render(this.lastSnapshot, sim.getVisualization(), sim.getParams());
				this.needsRender = false;
			}
		}

		scene.render();
	}

	private requestRender() {
		this.needsRender = true;
	}

	// ─────────────────────────────────────────────────────────────
	// State Updates (reduces boilerplate in UI callbacks)
	// ─────────────────────────────────────────────────────────────

	private updateSim<K extends keyof SimulationParams>(key: K, value: SimulationParams[K]) {
		this.simParams[key] = value;
		this.sim?.setParams({ [key]: value });
		this.requestRender();
	}

	private updateVis<K extends keyof VisualizationParams>(key: K, value: VisualizationParams[K]) {
		this.visParams[key] = value;
		this.sim?.setVisualization({ [key]: value });
		this.requestRender();
	}

	// ─────────────────────────────────────────────────────────────
	// UI
	// ─────────────────────────────────────────────────────────────

	private buildSettingsUI(sidebar: HTMLDivElement) {
		sidebar.empty();
		this.sliders.clear();
		this.dropdowns.clear();

		sidebar.createEl("h3", { text: "Wind Tunnel" });

		this.addPauseControl(sidebar);
		this.addSceneSelector(sidebar);
		this.addResetButton(sidebar);
		this.addDisplayModeSelector(sidebar);
		this.addColorModeSelector(sidebar);
		this.addColorScaleSelector(sidebar);
		this.addSimulationSliders(sidebar);
		this.addVisualizationSliders(sidebar);
	}

	private addPauseControl(sidebar: HTMLDivElement) {
		new Setting(sidebar)
			.setName("Simulation")
			.setDesc("Pause freezes the simulation state while keeping the camera interactive.")
			.addButton((btn) => {
				const sync = () => btn.setButtonText(this.isPaused ? "Resume" : "Pause");
				btn.setCta();
				sync();
				btn.onClick(() => {
					this.isPaused = !this.isPaused;
					this.sim?.setPaused(this.isPaused);
					sync();
				});
			});
	}

	private addSceneSelector(sidebar: HTMLDivElement) {
		new Setting(sidebar)
			.setName("Scene")
			.setDesc("Loads a scene preset.")
			.addDropdown((dd) => {
				for (const p of SCENE_PRESETS) dd.addOption(p.id, p.name);
				dd.setValue(this.currentPresetId);
				dd.onChange((id) => this.loadPreset(id));
				this.dropdowns.set("scene", dd);
			});
	}

	private addDisplayModeSelector(sidebar: HTMLDivElement) {
		new Setting(sidebar)
			.setName("Display mode")
			.setDesc("Show particles, trails, or both.")
			.addDropdown((dd) => {
				dd.addOption("particles", "Particles");
				dd.addOption("trails", "Trails");
				dd.addOption("both", "Both");
				dd.setValue(this.visParams.displayMode);
				dd.onChange((v) => this.updateVis("displayMode", v as VisualizationParams["displayMode"]));
				this.dropdowns.set("displayMode", dd);
			});
	}

	private addColorModeSelector(sidebar: HTMLDivElement) {
		new Setting(sidebar)
			.setName("Color mode")
			.setDesc("Color mapping for the flow.")
			.addDropdown((dd) => {
				dd.addOption("velocity", "Velocity");
				dd.addOption("vorticity", "Vorticity");
				dd.addOption("pressure", "Pressure (proxy)");
				dd.addOption("uniform", "Uniform");
				dd.setValue(this.visParams.colorMode);
				dd.onChange((v) => this.updateVis("colorMode", v as VisualizationParams["colorMode"]));
				this.dropdowns.set("colorMode", dd);
			});
	}

	private addColorScaleSelector(sidebar: HTMLDivElement) {
		new Setting(sidebar)
			.setName("Color scale")
			.setDesc("How values are mapped to colors.")
			.addDropdown((dd) => {
				dd.addOption("thermal", "Thermal");
				dd.addOption("rainbow", "Rainbow");
				dd.addOption("cool", "Cool");
				dd.addOption("blueRed", "Blue ↔ Red");
				dd.setValue(this.visParams.colorScale);
				dd.onChange((v) => this.updateVis("colorScale", v as VisualizationParams["colorScale"]));
				this.dropdowns.set("colorScale", dd);
			});
	}

	private addSimulationSliders(sidebar: HTMLDivElement) {
		this.addSlider(sidebar, {
			key: "windSpeed",
			name: "Wind speed",
			desc: "Base inlet velocity.",
			min: 0, max: 12, step: 0.1,
			get: () => this.simParams.windSpeed,
			set: (v) => this.updateSim("windSpeed", v),
		});

		this.addSlider(sidebar, {
			key: "turbulence",
			name: "Turbulence",
			desc: "Strength of turbulent perturbations.",
			min: 0, max: 2, step: 0.01,
			get: () => this.simParams.turbulence,
			set: (v) => this.updateSim("turbulence", v),
		});

		this.addSlider(sidebar, {
			key: "viscosity",
			name: "Viscosity",
			desc: "Velocity diffusion / damping.",
			min: 0, max: 0.2, step: 0.001,
			get: () => this.simParams.viscosity,
			set: (v) => this.updateSim("viscosity", v),
		});

		this.addSlider(sidebar, {
			key: "particleCount",
			name: "Particles",
			desc: "Rebuilds simulation and renderer (higher values cost more).",
			min: 1000, max: 30000, step: 500,
			get: () => this.simParams.particleCount,
			set: (v) => {
				this.simParams.particleCount = Math.floor(v);
				this.rebuildSimAndRenderer();
			},
		});

		this.addSlider(sidebar, {
			key: "trailLength",
			name: "Trail length",
			desc: "Rebuilds particle trails (simulation-side).",
			min: 1, max: 120, step: 1,
			get: () => this.visParams.trailLength,
			set: (v) => {
				const next = Math.max(1, Math.floor(v));
				this.visParams.trailLength = next;
				this.sim?.rebuildForVis(next, { trailLength: next });
				this.requestRender();
			},
		});

		this.addSlider(sidebar, {
			key: "trailHeatDecay",
			name: "Trail highlight decay",
			desc: "How quickly collision highlights fade. Higher = faster.",
			min: 0.5, max: 8.0, step: 0.1,
			get: () => this.simParams.trailHeatDecay ?? 2.5,
			set: (v) => this.updateSim("trailHeatDecay", v),
		});
	}

	private addVisualizationSliders(sidebar: HTMLDivElement) {
		this.addSlider(sidebar, {
			key: "particleSize",
			name: "Point size",
			desc: "Rendering only.",
			min: 1, max: 8, step: 0.1,
			get: () => this.visParams.particleSize,
			set: (v) => {
				this.visParams.particleSize = v;
				this.renderer?.setConfig({ pointSize: v });
			},
		});

		this.addSlider(sidebar, {
			key: "opacity",
			name: "Opacity",
			desc: "Rendering only.",
			min: 0.05, max: 1, step: 0.01,
			get: () => this.visParams.opacity,
			set: (v) => {
				this.visParams.opacity = v;
				this.renderer?.setConfig({ opacity: v });
			},
		});
	}

	private addSlider(
		sidebar: HTMLDivElement,
		opts: {
			key: string;
			name: string;
			desc: string;
			min: number;
			max: number;
			step: number;
			get: () => number;
			set: (v: number) => void;
		}
	) {
		new Setting(sidebar)
			.setName(opts.name)
			.setDesc(opts.desc)
			.addSlider((s) => {
				s.setLimits(opts.min, opts.max, opts.step);
				s.setValue(opts.get());
				s.setDynamicTooltip();
				s.onChange(opts.set);
				this.sliders.set(opts.key, s);
			});
	}

	private addResetButton(sidebar: HTMLDivElement) {
		new Setting(sidebar)
			.setName("Reset")
			.setDesc("Recreate the simulation with the current parameters.")
			.addButton((btn) => {
				btn.setButtonText("Rebuild");
				btn.onClick(() => this.rebuildSimAndRenderer());
			});
	}

	/**
	 * Syncs UI controls to current state (used after preset load).
	 */
	private syncUIToState() {
		// Sliders
		this.sliders.get("windSpeed")?.setValue(this.simParams.windSpeed);
		this.sliders.get("turbulence")?.setValue(this.simParams.turbulence);
		this.sliders.get("viscosity")?.setValue(this.simParams.viscosity);
		this.sliders.get("particleCount")?.setValue(this.simParams.particleCount);
		this.sliders.get("trailLength")?.setValue(this.visParams.trailLength);
		this.sliders.get("trailHeatDecay")?.setValue(this.simParams.trailHeatDecay ?? 2.5);
		this.sliders.get("particleSize")?.setValue(this.visParams.particleSize);
		this.sliders.get("opacity")?.setValue(this.visParams.opacity);

		// Dropdowns
		this.dropdowns.get("scene")?.setValue(this.currentPresetId);
		this.dropdowns.get("displayMode")?.setValue(this.visParams.displayMode);
		this.dropdowns.get("colorMode")?.setValue(this.visParams.colorMode);
		this.dropdowns.get("colorScale")?.setValue(this.visParams.colorScale);
	}

	// ─────────────────────────────────────────────────────────────
	// Preset Loading
	// ─────────────────────────────────────────────────────────────

	private loadPreset(id: string) {
		this.currentPresetId = id;

		const preset = getPreset(id);
		Object.assign(this.simParams, preset.sim);
		Object.assign(this.visParams, preset.vis);
		this.presetObstacles = preset.obstacles ?? [];

		this.applyCamera(preset.camera);
		this.syncUIToState();
		this.requestRender();
		this.rebuildSimAndRenderer();
	}

	private applyCamera(cam?: PresetCamera) {
		if (!this.camera || !cam) return;

		if (cam.alpha != null) this.camera.alpha = cam.alpha;
		if (cam.beta != null) this.camera.beta = cam.beta;
		if (cam.radius != null) this.camera.radius = cam.radius;
		if (cam.target) {
			this.camera.setTarget(new BABYLON.Vector3(cam.target.x, cam.target.y, cam.target.z));
		}
	}

	// ─────────────────────────────────────────────────────────────
	// Simulation & Renderer Rebuild
	// ─────────────────────────────────────────────────────────────

	private rebuildSimAndRenderer() {
		if (!this.scene) return;

		const paused = this.isPaused;

		safeDispose(this.sim, this.renderer);

		const obstacles = this.presetObstacles;
		this.rebuildObstacleVisuals(this.scene, obstacles);

		this.sim = new WindTunnelSim(this.simParams, obstacles, this.visParams);
		this.sim.setPaused(paused);

		const r = new BabylonParticleRenderer();
		r.init(this.scene, this.simParams.particleCount, {
			pointSize: this.visParams.particleSize,
			opacity: this.visParams.opacity,
		});
		this.renderer = r;
	}

	private rebuildObstacleVisuals(scene: BABYLON.Scene, obstacles: Obstacle[]) {
		for (const m of this.obstacleMeshes) {
			safeDispose(m);
		}
		this.obstacleMeshes = [];

		const mat = new BABYLON.StandardMaterial("wt-obstacle-mat", scene);
		mat.diffuseColor = new BABYLON.Color3(0.7, 0.1, 0.1);
		mat.specularColor = new BABYLON.Color3(1, 1, 1);

		obstacles.forEach((o, idx) => {
			const mesh = o.boundingType === "sphere"
				? BABYLON.MeshBuilder.CreateSphere(
					`wt-obstacle-sphere-${idx}`,
					{ diameter: Math.max(0.001, o.boundingSize.x) * 2 },
					scene
				)
				: BABYLON.MeshBuilder.CreateBox(
					`wt-obstacle-box-${idx}`,
					{
						width: Math.max(0.001, o.boundingSize.x),
						height: Math.max(0.001, o.boundingSize.y),
						depth: Math.max(0.001, o.boundingSize.z),
					},
					scene
				);

			mesh.position.set(o.position.x, o.position.y, o.position.z);
			mesh.material = mat;
			mesh.isPickable = false;

			this.obstacleMeshes.push(mesh);
		});
	}
}

