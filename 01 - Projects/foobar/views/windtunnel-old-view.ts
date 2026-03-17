import { ItemView, WorkspaceLeaf, Setting } from "obsidian";
import * as BABYLON from "@babylonjs/core";
import "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Particles/solidParticleSystem";
import "@babylonjs/core/Materials/standardMaterial";

const GridMaterialClass: typeof import("@babylonjs/materials").GridMaterial | null = null;


export const VIEW_TYPE_WINDTUNNEL_OLD = "cfd-wind-tunnel-babylon";

// ============================================================================
// INTERFACES
// ============================================================================

interface ScenePreset {
  name: string;
  obstacles: ObstacleConfig[];
  simulation: SimulationConfig;
  visualization: VisualizationConfig;
  camera: { alpha: number; beta: number; radius: number; target: [number, number, number] };
}

interface ObstacleConfig {
  type: "sphere" | "box" | "car" | "cylinder" | "airfoil";
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  color: [number, number, number];
}

interface SimulationConfig {
  windSpeed: number;
  particleCount: number;
  turbulence: number;
  viscosity: number;
  tunnelBounds: { x: [number, number]; y: [number, number]; z: [number, number] };
}

interface VisualizationConfig {
  colorMode: "velocity" | "pressure" | "vorticity" | "uniform";
  colorScale: "rainbow" | "thermal" | "cool" | "blueRed";
  displayMode: "particles" | "trails" | "both";
  particleSize: number;
  trailLength: number;
  trailWidth: number;
  opacity: number;
}

interface ObstacleMesh {
  mesh: BABYLON.Mesh;
  position: BABYLON.Vector3;
  boundingType: "sphere" | "box";
  boundingSize: BABYLON.Vector3;
}

// ============================================================================
// SCENE PRESETS
// ============================================================================

const SCENE_PRESETS: Record<string, ScenePreset> = {
  sphere: {
    name: "Kugel (Standard)",
    obstacles: [
      { type: "sphere", position: [0, 0, 0], scale: [1, 1, 1], color: [0.9, 0.4, 0.2] }
    ],
    simulation: {
      windSpeed: 3.0,
      particleCount: 2500,
      turbulence: 0.2,
      viscosity: 0.1,
      tunnelBounds: { x: [-8, 8], y: [-2, 2], z: [-3, 3] }
    },
    visualization: {
      colorMode: "velocity",
      colorScale: "rainbow",
      displayMode: "trails",
      particleSize: 0.04,
      trailLength: 40,
      trailWidth: 0.015,
      opacity: 0.85
    },
    camera: { alpha: Math.PI / 4, beta: Math.PI / 3, radius: 12, target: [0, 0, 0] }
  },

  car: {
    name: "Rennwagen",
    obstacles: [
      { type: "car", position: [0, 0.1, 0], scale: [1, 1, 1], rotation: [0, Math.PI, 0], color: [1, 0.3, 0] }
    ],
    simulation: {
      windSpeed: 4.0,
      particleCount: 3500,
      turbulence: 0.25,
      viscosity: 0.08,
      tunnelBounds: { x: [-6, 12], y: [-0.5, 2], z: [-2, 2] }
    },
    visualization: {
      colorMode: "velocity",
      colorScale: "rainbow",
      displayMode: "trails",
      particleSize: 0.03,
      trailLength: 50,
      trailWidth: 0.012,
      opacity: 0.9
    },
    camera: { alpha: Math.PI / 5, beta: Math.PI / 2.8, radius: 10, target: [1, 0.5, 0] }
  },

  cylinder: {
    name: "Zylinder (Kármán)",
    obstacles: [
      { type: "cylinder", position: [0, 0, 0], scale: [0.6, 3, 0.6], rotation: [Math.PI / 2, 0, 0], color: [0.3, 0.5, 1] }
    ],
    simulation: {
      windSpeed: 2.5,
      particleCount: 3000,
      turbulence: 0.35,
      viscosity: 0.05,
      tunnelBounds: { x: [-5, 12], y: [-2, 2], z: [-2.5, 2.5] }
    },
    visualization: {
      colorMode: "vorticity",
      colorScale: "thermal",
      displayMode: "trails",
      particleSize: 0.035,
      trailLength: 45,
      trailWidth: 0.014,
      opacity: 0.85
    },
    camera: { alpha: 0, beta: Math.PI / 2.5, radius: 14, target: [2, 0, 0] }
  },

  airfoil: {
    name: "Tragfläche",
    obstacles: [
      { type: "airfoil", position: [0, 0, 0], scale: [2, 0.3, 4], rotation: [0, 0, 0.12], color: [0.5, 0.7, 0.9] }
    ],
    simulation: {
      windSpeed: 3.5,
      particleCount: 3000,
      turbulence: 0.15,
      viscosity: 0.12,
      tunnelBounds: { x: [-6, 10], y: [-2.5, 2.5], z: [-3, 3] }
    },
    visualization: {
      colorMode: "pressure",
      colorScale: "blueRed",
      displayMode: "trails",
      particleSize: 0.03,
      trailLength: 45,
      trailWidth: 0.012,
      opacity: 0.85
    },
    camera: { alpha: Math.PI / 6, beta: Math.PI / 2.5, radius: 12, target: [0, 0, 0] }
  },

  multiBody: {
    name: "Mehrere Objekte",
    obstacles: [
      { type: "sphere", position: [-2, 0, 0], scale: [0.6, 0.6, 0.6], color: [0.9, 0.3, 0.3] },
      { type: "sphere", position: [2, 0.8, 0], scale: [0.5, 0.5, 0.5], color: [0.3, 0.9, 0.3] },
      { type: "box", position: [0, -0.5, 1.5], scale: [0.8, 0.4, 0.4], color: [0.3, 0.3, 0.9] }
    ],
    simulation: {
      windSpeed: 2.8,
      particleCount: 3000,
      turbulence: 0.3,
      viscosity: 0.1,
      tunnelBounds: { x: [-6, 10], y: [-2, 2.5], z: [-3, 3] }
    },
    visualization: {
      colorMode: "velocity",
      colorScale: "rainbow",
      displayMode: "both",
      particleSize: 0.03,
      trailLength: 35,
      trailWidth: 0.01,
      opacity: 0.8
    },
    camera: { alpha: Math.PI / 4, beta: Math.PI / 3, radius: 14, target: [0, 0, 0] }
  }
};

// ============================================================================
// COLOR SCALES
// ============================================================================

const COLOR_SCALES: Record<string, (t: number) => BABYLON.Color3> = {
  rainbow: (t: number): BABYLON.Color3 => {
    const hue = (1 - t) * 0.7;
    return BABYLON.Color3.FromHSV(hue * 360, 1, 1);
  },
  thermal: (t: number): BABYLON.Color3 => {
    if (t < 0.33) return new BABYLON.Color3(t * 3, 0, 0);
    if (t < 0.66) return new BABYLON.Color3(1, (t - 0.33) * 3, 0);
    return new BABYLON.Color3(1, 1, (t - 0.66) * 3);
  },
  cool: (t: number): BABYLON.Color3 => {
    return new BABYLON.Color3(0.1 + t * 0.3, 0.3 + t * 0.5, 0.7 + t * 0.3);
  },
  blueRed: (t: number): BABYLON.Color3 => {
    if (t < 0.5) return new BABYLON.Color3(t * 0.4, 0.3 + t * 0.4, 1 - t * 0.5);
    return new BABYLON.Color3(0.2 + (t - 0.5) * 1.6, 0.5 - (t - 0.5) * 0.8, 0.75 - (t - 0.5) * 1.5);
  }
};

// ============================================================================
// MAIN VIEW
// ============================================================================

export class WindTunnelView extends ItemView {
  private engine?: BABYLON.Engine;
  private scene?: BABYLON.Scene;
  private camera?: BABYLON.ArcRotateCamera;
  private simulation?: FlowSimulation;

  private currentPreset: string = "sphere";
  private settingsEl?: HTMLElement;
  private canvasContainer?: HTMLElement;
  private canvas?: HTMLCanvasElement;
  private resizeObserver?: ResizeObserver;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() { return VIEW_TYPE_WINDTUNNEL_OLD; }
  getDisplayText() { return "Wind Tunnel old"; }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.style.display = "flex";
    container.style.flexDirection = "row";
    container.style.height = "100%";

    // Settings Panel
    this.settingsEl = container.createDiv({ cls: "windtunnel-settings" });
    this.settingsEl.style.cssText = `
      width: 280px; min-width: 280px; padding: 12px;
      background: var(--background-secondary);
      border-right: 1px solid var(--background-modifier-border);
      overflow-y: auto; font-size: 13px;
    `;

    // Canvas Container
    this.canvasContainer = container.createDiv({ cls: "windtunnel-canvas" });
    this.canvasContainer.style.cssText = "flex: 1; position: relative; overflow: hidden;";

    this.canvas = document.createElement("canvas");
    this.canvas.style.cssText = "width: 100%; height: 100%; display: block; outline: none;";
    this.canvasContainer.appendChild(this.canvas);

    // Babylon.js Setup
    this.setupBabylon();
    this.buildSettingsUI();
    this.loadPreset(this.currentPreset);

    // ResizeObserver
    this.resizeObserver = new ResizeObserver(() => {
      this.engine?.resize();
    });
    this.resizeObserver.observe(this.canvasContainer);

    // Initial resize
    setTimeout(() => this.engine?.resize(), 100);
  }

  async onClose() {
    this.resizeObserver?.disconnect();
    this.simulation?.dispose();
    this.scene?.dispose();
    this.engine?.dispose();
  }

  private setupBabylon() {
    this.engine = new BABYLON.Engine(this.canvas!, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      antialias: true
    });

    this.scene = new BABYLON.Scene(this.engine);
    this.scene.clearColor = new BABYLON.Color4(0.03, 0.03, 0.06, 1);
    this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    this.scene.fogDensity = 0.015;
    this.scene.fogColor = new BABYLON.Color3(0.03, 0.03, 0.06);

    // Camera
    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      Math.PI / 4,
      Math.PI / 3,
      12,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(this.canvas!, true);
    this.camera.wheelPrecision = 20;
    this.camera.minZ = 0.1;
    this.camera.lowerRadiusLimit = 3;
    this.camera.upperRadiusLimit = 30;

    // Lighting
    const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0, 1, 0), this.scene);
    ambient.intensity = 0.4;
    ambient.groundColor = new BABYLON.Color3(0.2, 0.2, 0.4);

    const key = new BABYLON.DirectionalLight("key", new BABYLON.Vector3(-1, -2, -1), this.scene);
    key.intensity = 0.8;

    const fill = new BABYLON.DirectionalLight("fill", new BABYLON.Vector3(1, 1, 1), this.scene);
    fill.intensity = 0.3;

    // Render loop
    this.engine.runRenderLoop(() => {
      this.simulation?.update(this.engine!.getDeltaTime() / 1000);
      this.scene?.render();
    });
  }

  private buildSettingsUI() {
    const el = this.settingsEl!;
    el.empty();

    // Header
    const header = el.createDiv();
    header.style.cssText = "display: flex; align-items: center; margin-bottom: 16px;";
    header.createEl("h3", { text: "Wind Tunnel" }).style.cssText = "margin: 0; flex: 1;";
    const badge = header.createEl("span", { text: "Babylon.js" });
    badge.style.cssText = "font-size: 10px; padding: 2px 6px; background: var(--interactive-accent); color: white; border-radius: 4px;";

    // Scene Preset
    new Setting(el).setName("Szene").addDropdown(dd => {
      for (const [key, preset] of Object.entries(SCENE_PRESETS)) {
        dd.addOption(key, preset.name);
      }
      dd.setValue(this.currentPreset);
      dd.onChange(value => { this.currentPreset = value; this.loadPreset(value); });
    });

    this.addSectionHeader(el, "Simulation");

    // Wind Speed
    new Setting(el).setName("Windgeschwindigkeit").addSlider(s => {
      s.setLimits(0.5, 6, 0.1);
      s.setValue(this.simulation?.config.windSpeed ?? 3);
      s.setDynamicTooltip();
      s.onChange(v => { if (this.simulation) this.simulation.config.windSpeed = v; });
    });

    // Particle Count
    new Setting(el).setName("Partikel").addSlider(s => {
      s.setLimits(500, 6000, 100);
      s.setValue(this.simulation?.config.particleCount ?? 2500);
      s.setDynamicTooltip();
      s.onChange(v => {
        if (this.simulation) {
          this.simulation.config.particleCount = v;
          this.simulation.rebuild();
        }
      });
    });

    // Turbulence
    new Setting(el).setName("Turbulenz").addSlider(s => {
      s.setLimits(0, 0.6, 0.02);
      s.setValue(this.simulation?.config.turbulence ?? 0.2);
      s.setDynamicTooltip();
      s.onChange(v => { if (this.simulation) this.simulation.config.turbulence = v; });
    });

    // Viscosity
    new Setting(el).setName("Viskosität").setDesc("Dämpfung der Strömung").addSlider(s => {
      s.setLimits(0, 0.3, 0.01);
      s.setValue(this.simulation?.config.viscosity ?? 0.1);
      s.setDynamicTooltip();
      s.onChange(v => { if (this.simulation) this.simulation.config.viscosity = v; });
    });

    this.addSectionHeader(el, "Visualisierung");

    // Display Mode
    new Setting(el).setName("Anzeigemodus").addDropdown(dd => {
      dd.addOption("particles", "Partikel");
      dd.addOption("trails", "Stromlinien");
      dd.addOption("both", "Beides");
      dd.setValue(this.simulation?.visConfig.displayMode ?? "trails");
      dd.onChange(v => {
        if (this.simulation) {
          this.simulation.visConfig.displayMode = v as any;
          this.simulation.rebuild();
        }
      });
    });

    // Color Mode
    new Setting(el).setName("Farbmodus").addDropdown(dd => {
      dd.addOption("velocity", "Geschwindigkeit");
      dd.addOption("pressure", "Druck");
      dd.addOption("vorticity", "Wirbelstärke");
      dd.addOption("uniform", "Einheitlich");
      dd.setValue(this.simulation?.visConfig.colorMode ?? "velocity");
      dd.onChange(v => { if (this.simulation) this.simulation.visConfig.colorMode = v as any; });
    });

    // Color Scale
    new Setting(el).setName("Farbskala").addDropdown(dd => {
      dd.addOption("rainbow", "Regenbogen (CFD)");
      dd.addOption("thermal", "Thermal");
      dd.addOption("cool", "Kühl");
      dd.addOption("blueRed", "Blau-Rot (Druck)");
      dd.setValue(this.simulation?.visConfig.colorScale ?? "rainbow");
      dd.onChange(v => { if (this.simulation) this.simulation.visConfig.colorScale = v as any; });
    });

    // Particle Size
    new Setting(el).setName("Partikelgröße").addSlider(s => {
      s.setLimits(0.02, 0.1, 0.005);
      s.setValue(this.simulation?.visConfig.particleSize ?? 0.04);
      s.setDynamicTooltip();
      s.onChange(v => {
        if (this.simulation) {
          this.simulation.visConfig.particleSize = v;
          this.simulation.updateVisuals();
        }
      });
    });

    // Trail Length
    new Setting(el).setName("Spurlänge").addSlider(s => {
      s.setLimits(15, 80, 5);
      s.setValue(this.simulation?.visConfig.trailLength ?? 40);
      s.setDynamicTooltip();
      s.onChange(v => {
        if (this.simulation) {
          this.simulation.visConfig.trailLength = v;
          this.simulation.rebuild();
        }
      });
    });

    // Opacity
    new Setting(el).setName("Transparenz").addSlider(s => {
      s.setLimits(0.2, 1, 0.05);
      s.setValue(this.simulation?.visConfig.opacity ?? 0.85);
      s.setDynamicTooltip();
      s.onChange(v => {
        if (this.simulation) {
          this.simulation.visConfig.opacity = v;
          this.simulation.updateVisuals();
        }
      });
    });

    // Info
    this.addSectionHeader(el, "Info");
    
    const infoBox = el.createDiv();
    infoBox.style.cssText = "padding: 10px; background: var(--background-primary); border-radius: 6px; font-size: 11px; color: var(--text-muted);";
    infoBox.innerHTML = `
      <strong>Steuerung:</strong><br>
      • LMB: Drehen<br>
      • RMB: Verschieben<br>
      • Scroll: Zoom<br><br>
      <strong>Engine:</strong> Babylon.js
    `;

    // Color Legend
    const legend = el.createDiv();
    legend.style.cssText = "margin-top: 12px; padding: 10px; background: var(--background-primary); border-radius: 6px;";
    legend.createEl("div", { text: "Farbskala" }).style.cssText = "font-size: 11px; color: var(--text-muted); margin-bottom: 6px;";
    const gradient = legend.createDiv();
    gradient.style.cssText = "height: 14px; border-radius: 4px; background: linear-gradient(to right, hsl(252,100%,50%), hsl(180,100%,50%), hsl(120,100%,50%), hsl(60,100%,50%), hsl(0,100%,50%));";
    const labels = legend.createDiv();
    labels.style.cssText = "display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-top: 3px;";
    labels.createSpan({ text: "Niedrig" });
    labels.createSpan({ text: "Hoch" });
  }

  private addSectionHeader(container: HTMLElement, title: string) {
    container.createEl("hr").style.cssText = "border: none; border-top: 1px solid var(--background-modifier-border); margin: 14px 0;";
    container.createEl("h4", { text: title }).style.cssText = "margin: 0 0 10px 0; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;";
  }

  private loadPreset(presetKey: string) {
    const preset = SCENE_PRESETS[presetKey];
    if (!preset || !this.scene) return;

    this.simulation?.dispose();

    // Clear scene (keep lights and camera)
    this.scene.meshes.slice().forEach(mesh => mesh.dispose());

    // Tunnel
    this.createTunnel(preset.simulation.tunnelBounds);

    // Obstacles
    const obstacles: ObstacleMesh[] = [];
    for (const cfg of preset.obstacles) {
      obstacles.push(this.createObstacle(cfg));
    }

    // Simulation
    this.simulation = new FlowSimulation(
      this.scene,
      obstacles,
      { ...preset.simulation },
      { ...preset.visualization }
    );

    // Camera
    this.camera!.alpha = preset.camera.alpha;
    this.camera!.beta = preset.camera.beta;
    this.camera!.radius = preset.camera.radius;
    this.camera!.target = new BABYLON.Vector3(...preset.camera.target);

    this.buildSettingsUI();
  }

  private createTunnel(bounds: SimulationConfig["tunnelBounds"]) {
    const scene = this.scene!;
    const length = bounds.x[1] - bounds.x[0];
    const height = bounds.y[1] - bounds.y[0];
    const width = bounds.z[1] - bounds.z[0];
    const cx = (bounds.x[0] + bounds.x[1]) / 2;
    const cy = (bounds.y[0] + bounds.y[1]) / 2;

    // Ground grid
    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: length, height: width, subdivisions: 2 }, scene);
    ground.position = new BABYLON.Vector3(cx, bounds.y[0], 0);
    
    // Use GridMaterial if available, otherwise fallback to StandardMaterial
    if (GridMaterialClass) {
      const groundMat = new GridMaterialClass("groundMat", scene);
      groundMat.majorUnitFrequency = 2;
      groundMat.minorUnitVisibility = 0.3;
      groundMat.gridRatio = 1;
      groundMat.mainColor = new BABYLON.Color3(0.1, 0.1, 0.15);
      groundMat.lineColor = new BABYLON.Color3(0.2, 0.25, 0.35);
      groundMat.opacity = 0.9;
      ground.material = groundMat;
    } else {
      const groundMat = new BABYLON.StandardMaterial("groundMat", scene);
      groundMat.diffuseColor = new BABYLON.Color3(0.12, 0.12, 0.18);
      groundMat.specularColor = new BABYLON.Color3(0, 0, 0);
      groundMat.alpha = 0.9;
      ground.material = groundMat;
    }

    // Walls (transparent)
    const wallMat = new BABYLON.StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.6);
    wallMat.alpha = 0.06;
    wallMat.backFaceCulling = false;

    // Side walls
    const sideWall = BABYLON.MeshBuilder.CreatePlane("sideWall", { width: length, height: height }, scene);
    sideWall.material = wallMat;
    sideWall.position = new BABYLON.Vector3(cx, cy, -width / 2);
    
    const sideWall2 = sideWall.clone("sideWall2");
    sideWall2.position.z = width / 2;

    // Top
    const topWall = BABYLON.MeshBuilder.CreatePlane("topWall", { width: length, height: width }, scene);
    topWall.rotation.x = Math.PI / 2;
    topWall.position = new BABYLON.Vector3(cx, bounds.y[1], 0);
    topWall.material = wallMat;

    // Inlet (green)
    const inletMat = new BABYLON.StandardMaterial("inletMat", scene);
    inletMat.diffuseColor = new BABYLON.Color3(0.2, 0.7, 0.3);
    inletMat.alpha = 0.12;
    inletMat.backFaceCulling = false;

    const inlet = BABYLON.MeshBuilder.CreatePlane("inlet", { width: width, height: height }, scene);
    inlet.rotation.y = Math.PI / 2;
    inlet.position = new BABYLON.Vector3(bounds.x[0], cy, 0);
    inlet.material = inletMat;

    // Outlet (red)
    const outletMat = new BABYLON.StandardMaterial("outletMat", scene);
    outletMat.diffuseColor = new BABYLON.Color3(0.7, 0.2, 0.3);
    outletMat.alpha = 0.12;
    outletMat.backFaceCulling = false;

    const outlet = BABYLON.MeshBuilder.CreatePlane("outlet", { width: width, height: height }, scene);
    outlet.rotation.y = Math.PI / 2;
    outlet.position = new BABYLON.Vector3(bounds.x[1], cy, 0);
    outlet.material = outletMat;

    // Wind arrow
    const arrowBody = BABYLON.MeshBuilder.CreateCylinder("arrowBody", { height: 1.2, diameter: 0.08 }, scene);
    arrowBody.rotation.z = Math.PI / 2;
    arrowBody.position = new BABYLON.Vector3(bounds.x[0] + 1, cy + height * 0.35, 0);
    
    const arrowHead = BABYLON.MeshBuilder.CreateCylinder("arrowHead", { height: 0.3, diameterTop: 0, diameterBottom: 0.2 }, scene);
    arrowHead.rotation.z = -Math.PI / 2;
    arrowHead.position = new BABYLON.Vector3(bounds.x[0] + 1.75, cy + height * 0.35, 0);

    const arrowMat = new BABYLON.StandardMaterial("arrowMat", scene);
    arrowMat.diffuseColor = new BABYLON.Color3(0.3, 1, 0.5);
    arrowMat.emissiveColor = new BABYLON.Color3(0.1, 0.4, 0.2);
    arrowBody.material = arrowMat;
    arrowHead.material = arrowMat;
  }

  private createObstacle(cfg: ObstacleConfig): ObstacleMesh {
    const scene = this.scene!;
    let mesh: BABYLON.Mesh;
    let boundingType: "sphere" | "box" = "box";
    let boundingSize = new BABYLON.Vector3();

    switch (cfg.type) {
      case "sphere":
        mesh = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 32 }, scene);
        boundingType = "sphere";
        boundingSize = new BABYLON.Vector3(cfg.scale[0], cfg.scale[0], cfg.scale[0]);
        break;
      case "cylinder":
        mesh = BABYLON.MeshBuilder.CreateCylinder("cylinder", { height: 1, diameter: 2, tessellation: 32 }, scene);
        boundingType = "sphere";
        boundingSize = new BABYLON.Vector3(cfg.scale[0], cfg.scale[0], cfg.scale[0]);
        break;
      case "car":
        mesh = this.createCarMesh(scene);
        boundingSize = new BABYLON.Vector3(3.2 * cfg.scale[0], 0.9 * cfg.scale[1], 1.4 * cfg.scale[2]);
        break;
      case "airfoil":
        mesh = this.createAirfoilMesh(scene);
        boundingSize = new BABYLON.Vector3(cfg.scale[0] * 2, cfg.scale[1] * 2, cfg.scale[2]);
        break;
      case "box":
      default:
        mesh = BABYLON.MeshBuilder.CreateBox("box", { size: 1 }, scene);
        boundingSize = new BABYLON.Vector3(...cfg.scale);
    }

    mesh.position = new BABYLON.Vector3(...cfg.position);
    mesh.scaling = new BABYLON.Vector3(...cfg.scale);
    if (cfg.rotation) {
      mesh.rotation = new BABYLON.Vector3(...cfg.rotation);
    }

    const mat = new BABYLON.StandardMaterial("obstacleMat", scene);
    mat.diffuseColor = new BABYLON.Color3(...cfg.color);
    mat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);
    mat.specularPower = 32;
    mesh.material = mat;

    // Stand
    const stand = BABYLON.MeshBuilder.CreateCylinder("stand", { height: 0.6, diameterTop: 0.06, diameterBottom: 0.1 }, scene);
    stand.position = new BABYLON.Vector3(cfg.position[0], cfg.position[1] - boundingSize.y / 2 - 0.3, cfg.position[2]);
    const standMat = new BABYLON.StandardMaterial("standMat", scene);
    standMat.diffuseColor = new BABYLON.Color3(0.4, 0.4, 0.4);
    stand.material = standMat;

    return { mesh, position: new BABYLON.Vector3(...cfg.position), boundingType, boundingSize };
  }

  private createCarMesh(scene: BABYLON.Scene): BABYLON.Mesh {
    // Vereinfachtes Auto aus CSG oder kombinierten Boxen
    const body = BABYLON.MeshBuilder.CreateBox("carBody", { width: 3.2, height: 0.5, depth: 1.3 }, scene);
    body.position.y = 0.25;

    const cabin = BABYLON.MeshBuilder.CreateBox("carCabin", { width: 1.4, height: 0.45, depth: 1.1 }, scene);
    cabin.position = new BABYLON.Vector3(-0.3, 0.7, 0);

    const nose = BABYLON.MeshBuilder.CreateBox("carNose", { width: 0.8, height: 0.3, depth: 1 }, scene);
    nose.position = new BABYLON.Vector3(1.4, 0.15, 0);

    const wing = BABYLON.MeshBuilder.CreateBox("carWing", { width: 0.12, height: 0.35, depth: 1.5 }, scene);
    wing.position = new BABYLON.Vector3(-1.5, 0.65, 0);

    // Merge
    const merged = BABYLON.Mesh.MergeMeshes([body, cabin, nose, wing], true, true, undefined, false, true);
    merged!.name = "car";
    return merged!;
  }

  private createAirfoilMesh(scene: BABYLON.Scene): BABYLON.Mesh {
    // NACA-ähnliches Profil
    const path: BABYLON.Vector3[] = [];
    const shape: BABYLON.Vector3[] = [];
    
    // Profilform (NACA 0012 vereinfacht)
    const numPoints = 30;
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints;
      const x = t;
      const y = 0.12 * 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
      shape.push(new BABYLON.Vector3(x - 0.5, y, 0));
    }
    for (let i = numPoints - 1; i >= 0; i--) {
      const t = i / numPoints;
      const x = t;
      const y = -0.12 * 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
      shape.push(new BABYLON.Vector3(x - 0.5, y, 0));
    }

    // Extrusion path
    path.push(new BABYLON.Vector3(0, 0, -0.5));
    path.push(new BABYLON.Vector3(0, 0, 0.5));

    const airfoil = BABYLON.MeshBuilder.ExtrudeShape("airfoil", { shape, path, cap: BABYLON.Mesh.CAP_ALL }, scene);
    return airfoil;
  }
}

// ============================================================================
// FLOW SIMULATION
// ============================================================================

class FlowSimulation {
  private scene: BABYLON.Scene;
  private obstacles: ObstacleMesh[];
  
  config: SimulationConfig;
  visConfig: VisualizationConfig;

  private particles: FlowParticle[] = [];
  private particleMesh?: BABYLON.Mesh;
  private trailLines?: BABYLON.LinesMesh;
  private sps?: BABYLON.SolidParticleSystem;

  constructor(
    scene: BABYLON.Scene,
    obstacles: ObstacleMesh[],
    config: SimulationConfig,
    visConfig: VisualizationConfig
  ) {
    this.scene = scene;
    this.obstacles = obstacles;
    this.config = config;
    this.visConfig = visConfig;
    this.rebuild();
  }

  rebuild() {
    this.dispose();

    const count = this.config.particleCount;
    const bounds = this.config.tunnelBounds;
    const trailLen = this.visConfig.trailLength;

    // Create particles
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const x = bounds.x[0] + Math.random() * (bounds.x[1] - bounds.x[0]);
      const y = bounds.y[0] + Math.random() * (bounds.y[1] - bounds.y[0]);
      const z = bounds.z[0] + Math.random() * (bounds.z[1] - bounds.z[0]);
      this.particles.push(new FlowParticle(x, y, z, trailLen));
    }

    const showParticles = this.visConfig.displayMode === "particles" || this.visConfig.displayMode === "both";
    const showTrails = this.visConfig.displayMode === "trails" || this.visConfig.displayMode === "both";

    if (showParticles) {
      this.buildParticleSPS();
    }

    if (showTrails) {
      this.buildTrailLines();
    }
  }

  private buildParticleSPS() {
    // Use SolidParticleSystem for particles
    const sphere = BABYLON.MeshBuilder.CreateSphere("particleModel", { diameter: 1, segments: 4 }, this.scene);
    
    this.sps = new BABYLON.SolidParticleSystem("sps", this.scene, { updatable: true });
    this.sps.addShape(sphere, this.particles.length);
    sphere.dispose();

    this.particleMesh = this.sps.buildMesh();
    this.particleMesh.hasVertexAlpha = true;

    const mat = new BABYLON.StandardMaterial("particleMat", this.scene);
    mat.diffuseColor = new BABYLON.Color3(0.6, 0.8, 1);
    mat.emissiveColor = new BABYLON.Color3(0.2, 0.3, 0.5);
    mat.alpha = this.visConfig.opacity;
    this.particleMesh.material = mat;

    // Initialize particles
    this.sps.initParticles = () => {
      for (let i = 0; i < this.sps!.nbParticles; i++) {
        const p = this.sps!.particles[i];
        const fp = this.particles[i];
        p.position.x = fp.x;
        p.position.y = fp.y;
        p.position.z = fp.z;
        p.scaling.setAll(this.visConfig.particleSize);
      }
    };
    this.sps.initParticles();
    this.sps.setParticles();
  }

  private buildTrailLines() {
    // Initial empty lines mesh - will be updated each frame
    const lines: BABYLON.Vector3[][] = [];
    for (let i = 0; i < this.particles.length; i++) {
      const trail = this.particles[i].trail;
      const points: BABYLON.Vector3[] = [];
      for (let j = 0; j < trail.length / 3; j++) {
        points.push(new BABYLON.Vector3(trail[j * 3], trail[j * 3 + 1], trail[j * 3 + 2]));
      }
      lines.push(points);
    }

    // Create colors array
    const colors: BABYLON.Color4[][] = [];
    for (let i = 0; i < this.particles.length; i++) {
      const lineColors: BABYLON.Color4[] = [];
      for (let j = 0; j < this.visConfig.trailLength; j++) {
        const fade = 1 - (j / this.visConfig.trailLength) * 0.85;
        lineColors.push(new BABYLON.Color4(0.5 * fade, 0.7 * fade, 1 * fade, this.visConfig.opacity * fade));
      }
      colors.push(lineColors);
    }

    this.trailLines = BABYLON.MeshBuilder.CreateLineSystem("trails", {
      lines,
      colors,
      updatable: true
    }, this.scene);
  }

  updateVisuals() {
    if (this.sps && this.particleMesh) {
      for (let i = 0; i < this.sps.nbParticles; i++) {
        this.sps.particles[i].scaling.setAll(this.visConfig.particleSize);
      }
      if (this.particleMesh.material) {
        (this.particleMesh.material as BABYLON.StandardMaterial).alpha = this.visConfig.opacity;
      }
    }
  }

  update(dt: number) {
    if (dt <= 0 || dt > 0.1) dt = 0.016;
    
    const bounds = this.config.tunnelBounds;
    const colorFn = COLOR_SCALES[this.visConfig.colorScale];

    // Update particles
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];

      // Compute velocity
      const vel = this.computeVelocity(p.x, p.y, p.z, p);
      
      // Apply viscosity (damping)
      p.vx = p.vx * (1 - this.config.viscosity) + vel.x * this.config.viscosity + (vel.x - p.vx) * 0.5;
      p.vy = p.vy * (1 - this.config.viscosity) + vel.y * this.config.viscosity + (vel.y - p.vy) * 0.5;
      p.vz = p.vz * (1 - this.config.viscosity) + vel.z * this.config.viscosity + (vel.z - p.vz) * 0.5;

      // Update position
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      // Boundaries
      if (p.y < bounds.y[0]) { p.y = bounds.y[0]; p.vy *= -0.2; }
      if (p.y > bounds.y[1]) { p.y = bounds.y[1]; p.vy *= -0.2; }
      if (p.z < bounds.z[0]) { p.z = bounds.z[0]; p.vz *= -0.2; }
      if (p.z > bounds.z[1]) { p.z = bounds.z[1]; p.vz *= -0.2; }

      // Respawn
      if (p.x > bounds.x[1] || p.x < bounds.x[0] - 0.5) {
        p.respawn(bounds);
      }

      // Update speed and vorticity
      p.speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
      p.vorticity = Math.abs(p.vy) + Math.abs(p.vz);

      // Add to trail
      p.addToTrail();
    }

    // Update SPS particles
    if (this.sps) {
      for (let i = 0; i < this.sps.nbParticles; i++) {
        const sp = this.sps.particles[i];
        const fp = this.particles[i];
        
        sp.position.x = fp.x;
        sp.position.y = fp.y;
        sp.position.z = fp.z;

        // Color
        const t = this.getColorValue(fp);
        const c = colorFn(t);
        sp.color = new BABYLON.Color4(c.r, c.g, c.b, this.visConfig.opacity);
      }
      this.sps.setParticles();
    }

    // Update trail lines
    if (this.trailLines) {
      const lines: BABYLON.Vector3[][] = [];
      const colors: BABYLON.Color4[][] = [];

      for (let i = 0; i < this.particles.length; i++) {
        const fp = this.particles[i];
        const trail = fp.trail;
        const speeds = fp.speeds;
        const points: BABYLON.Vector3[] = [];
        const lineColors: BABYLON.Color4[] = [];

        for (let j = 0; j < this.visConfig.trailLength; j++) {
          points.push(new BABYLON.Vector3(trail[j * 3], trail[j * 3 + 1], trail[j * 3 + 2]));
          
          const t = this.getColorValueFromSpeed(speeds[j], fp.x);
          const c = colorFn(t);
          const fade = 1 - (j / this.visConfig.trailLength) * 0.85;
          lineColors.push(new BABYLON.Color4(c.r * fade, c.g * fade, c.b * fade, this.visConfig.opacity * fade));
        }

        lines.push(points);
        colors.push(lineColors);
      }

      this.trailLines = BABYLON.MeshBuilder.CreateLineSystem("trails", {
        lines,
        colors,
        instance: this.trailLines
      }, this.scene);
    }
  }

  private getColorValue(p: FlowParticle): number {
    switch (this.visConfig.colorMode) {
      case "velocity":
        return Math.min(1, Math.max(0, p.speed / (this.config.windSpeed * 1.8)));
      case "pressure":
        return Math.min(1, Math.max(0, 1 - p.speed / (this.config.windSpeed * 2)));
      case "vorticity":
        return Math.min(1, Math.max(0, p.vorticity / (this.config.windSpeed * 0.8)));
      case "uniform":
      default:
        return 0.5;
    }
  }

  private getColorValueFromSpeed(speed: number, x: number): number {
    switch (this.visConfig.colorMode) {
      case "velocity":
        return Math.min(1, Math.max(0, speed / (this.config.windSpeed * 1.8)));
      case "pressure":
        return Math.min(1, Math.max(0, 1 - speed / (this.config.windSpeed * 2)));
      case "vorticity":
        return Math.min(1, Math.max(0, speed / (this.config.windSpeed * 1.2)));
      case "uniform":
      default:
        return 0.5;
    }
  }

  private computeVelocity(x: number, y: number, z: number, particle: FlowParticle): { x: number; y: number; z: number } {
    let vx = this.config.windSpeed;
    let vy = 0;
    let vz = 0;

    for (const obs of this.obstacles) {
      const dx = x - obs.position.x;
      const dy = y - obs.position.y;
      const dz = z - obs.position.z;

      if (obs.boundingType === "sphere") {
        const r = obs.boundingSize.x;
        const dist2 = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(dist2);

        if (dist > r * 0.85) {
          // Potential flow around sphere
          const r3 = r * r * r;
          const dist5 = dist2 * dist2 * dist;
          const factor = 0.5 * r3 / dist5;

          vx += this.config.windSpeed * factor * (2 * dx * dx - dy * dy - dz * dz);
          vy += this.config.windSpeed * factor * 3 * dx * dy;
          vz += this.config.windSpeed * factor * 3 * dx * dz;

          // Wake with vortex shedding
          if (dx > r * 0.2) {
            const wakeY = Math.abs(dy) / r;
            const wakeZ = Math.abs(dz) / r;
            if (wakeY < 2.5 && wakeZ < 2.5) {
              const wakeFactor = Math.exp(-dx / (r * 2.5)) * Math.exp(-(wakeY + wakeZ) * 0.4) * this.config.turbulence;
              const t = performance.now() * 0.002 + particle.phase;
              
              // Kármán vortex street effect
              const vortexFreq = 0.8;
              vy += Math.sin(t * vortexFreq + dx * 1.5) * wakeFactor * this.config.windSpeed * 1.2;
              vz += Math.cos(t * vortexFreq * 1.3 + dx * 1.2) * wakeFactor * this.config.windSpeed * 0.8;
              vx *= (1 - wakeFactor * 0.35);
            }
          }
        } else {
          // Inside - push out
          const n = dist > 0.01 ? 1 / dist : 100;
          vx = dx * n * this.config.windSpeed * 0.2;
          vy = dy * n * this.config.windSpeed * 2.5;
          vz = dz * n * this.config.windSpeed * 2.5;
        }
      } else {
        // Box obstacle
        const hx = obs.boundingSize.x / 2;
        const hy = obs.boundingSize.y / 2;
        const hz = obs.boundingSize.z / 2;

        const ax = Math.abs(dx) - hx;
        const ay = Math.abs(dy) - hy;
        const az = Math.abs(dz) - hz;

        // Stagnation region in front
        if (dx < -hx * 0.3 && dx > -hx * 2.5 && Math.abs(dy) < hy * 1.8 && Math.abs(dz) < hz * 1.8) {
          const stallFactor = Math.exp((dx + hx) / (hx * 0.8)) * 0.6;
          vx *= (1 - stallFactor);
          vy += Math.sign(dy) * stallFactor * 0.8;
          vz += Math.sign(dz) * stallFactor * 0.5;
        }

        // Near obstacle - deflect
        const margin = 0.6;
        if (ax < margin && ay < margin && az < margin) {
          const inside = ax < 0 && ay < 0 && az < 0;
          
          if (inside) {
            // Strong push out
            if (ay > ax && ay > az) {
              vy += Math.sign(dy) * 5;
            } else if (az > ax) {
              vz += Math.sign(dz) * 5;
            } else {
              vy += Math.sign(dy) * 2.5;
              vz += Math.sign(dz) * 2.5;
            }
            vx *= 0.15;
          } else {
            // Smooth deflection
            const distToSurface = Math.max(ax, ay, az);
            const strength = 2.5 * (1 - distToSurface / margin);
            
            if (Math.abs(dy) > 0.01) vy += Math.sign(dy) * strength * 0.7;
            if (Math.abs(dz) > 0.01) vz += Math.sign(dz) * strength * 0.5;
            
            // Acceleration over/under
            if (ax < 0 && az < 0 && Math.abs(ay) < margin) {
              vx *= 1.2;
            }
          }
        }

        // Wake behind
        if (dx > hx * 0.7 && Math.abs(dy) < hy * 3 && Math.abs(dz) < hz * 2.5) {
          const wakeDist = dx - hx;
          if (wakeDist < hx * 10) {
            const wakeStrength = Math.exp(-wakeDist / (hx * 3)) * this.config.turbulence;
            
            vx *= (1 - wakeStrength * 0.45);
            
            const t = performance.now() * 0.003 + particle.phase;
            vy += Math.sin(t + wakeDist * 0.6) * wakeStrength * this.config.windSpeed * 1.0;
            vz += Math.cos(t * 1.2 + wakeDist * 0.4) * wakeStrength * this.config.windSpeed * 0.6;
          }
        }
      }
    }

    // Global turbulence
    const noise = this.config.turbulence * 0.08;
    vy += (Math.random() - 0.5) * noise;
    vz += (Math.random() - 0.5) * noise;

    return { x: vx, y: vy, z: vz };
  }

  dispose() {
    this.sps?.dispose();
    this.particleMesh?.dispose();
    this.trailLines?.dispose();
    this.sps = undefined;
    this.particleMesh = undefined;
    this.trailLines = undefined;
  }
}

// ============================================================================
// FLOW PARTICLE
// ============================================================================

class FlowParticle {
  x: number;
  y: number;
  z: number;
  vx: number = 0;
  vy: number = 0;
  vz: number = 0;
  speed: number = 0;
  vorticity: number = 0;
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