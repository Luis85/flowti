/**
 * game-scene.ts — Unified config-driven scene that replaces HubScene and RoomScene.
 *
 * Consumes a GameSceneConfig to produce any room layout: hub, office, village,
 * or station.  Provides backward-compatible old APIs (spawnAgent, removeAgent,
 * updateAgents, overlay methods) so engine.ts can switch without call-site changes,
 * plus new SceneEntity-based enter/exit APIs for Phase 3.
 */

import * as ex from "excalibur";
import type { DashboardAgent } from "../data/types.js";
import type { SceneEntity } from "../data/scene-entity.js";
import type { GameSceneConfig, OverlayConfig } from "../data/scene-configs.js";
import type { DoorConfig, SceneHandle } from "../systems/scene-registry.js";
import { AgentActor } from "../actors/agent-actor.js";
import { WorkstationActor } from "../actors/workstation-actor.js";
import { DoorwayActor } from "../actors/doorway-actor.js";
import type { BrainSystem } from "../systems/brain-system.js";
import { resolveCharacter } from "../sprites/character-pool.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";
import { WORKSTATION_COLS, WORKSTATION_SPACING, WORKSTATION_START } from "../config/settings.js";
import { resolveSettingForDomain } from "../config/domain-map.js";

// ── Hub layout constants ────────────────────────────────────────────

const HUB_AGENT_SPACING = 80;
const HUB_AGENTS_PER_ROW = 6;

// ── Callbacks ───────────────────────────────────────────────────────

export interface GameSceneCallbacks {
	readonly onSceneChange: (target: string) => void;
	readonly onAgentSelect: (name: string) => void;
}

// ── GameScene ───────────────────────────────────────────────────────

export class GameScene extends ex.Scene implements SceneHandle {
	private readonly sceneConfig: GameSceneConfig;
	private readonly callbacks: GameSceneCallbacks;
	private readonly workstations: WorkstationActor[] = [];
	private readonly agentActors = new Map<string, AgentActor>();
	private readonly sceneEntities = new Map<string, SceneEntity>();
	private readonly transferredOut = new Set<string>();
	private brainSystem: BrainSystem | null = null;
	private spriteRegistry: Map<string, AgentSprites> = new Map();

	// Overlay references (created only when config.overlays includes them)
	private connectionLabel: ex.Label | null = null;
	private iterationLabel: ex.Label | null = null;
	private hubHintLabel: ex.Label | null = null;

	constructor(config: GameSceneConfig, callbacks: GameSceneCallbacks) {
		super();
		this.sceneConfig = config;
		this.callbacks = callbacks;
	}

	// ── SceneHandle ─────────────────────────────────────────────────

	getDoors(): readonly DoorConfig[] {
		return this.sceneConfig.doors;
	}

	// ── Lifecycle ───────────────────────────────────────────────────

	onInitialize(engine: ex.Engine): void {
		const w = engine.drawWidth;
		const h = engine.drawHeight;

		// ── 1. Background ──────────────────────────────────────
		const drawBg = this.sceneConfig.drawBackground;
		if (drawBg) {
			const bgCanvas = new ex.Canvas({
				width: w,
				height: h,
				cache: true,
				draw: (ctx: CanvasRenderingContext2D) => {
					drawBg(ctx, w, h);
				},
			});
			const bgActor = new ex.Actor({
				pos: ex.vec(w / 2, h / 2),
				width: w,
				height: h,
				anchor: ex.vec(0.5, 0.5),
				z: -10,
				collisionType: ex.CollisionType.PreventCollision,
			});
			bgActor.graphics.use(bgCanvas);
			this.add(bgActor);
		}

		// ── 2. Room title ──────────────────────────────────────
		const title = new ex.Label({
			text: this.sceneConfig.label,
			pos: ex.vec(w / 2, 36),
			font: new ex.Font({
				family: "system-ui, sans-serif",
				size: 20,
				unit: ex.FontUnit.Px,
				color: ex.Color.fromHex("#e2e8f0"),
				textAlign: ex.TextAlign.Center,
				bold: true,
			}),
			anchor: ex.vec(0.5, 0.5),
			z: 5,
		});
		title.body.collisionType = ex.CollisionType.PreventCollision;
		this.add(title);

		// ── 3. Floor accent ────────────────────────────────────
		const floor = new ex.Actor({
			pos: ex.vec(w / 2, h - 20),
			width: w,
			height: 40,
			anchor: ex.vec(0.5, 0.5),
			color: ex.Color.fromHex(this.sceneConfig.floorColor),
			collisionType: ex.CollisionType.PreventCollision,
		});
		this.add(floor);

		// ── 4. Workstation grid ────────────────────────────────
		if (this.sceneConfig.workstationCount > 0) {
			const rows = Math.ceil(this.sceneConfig.workstationCount / WORKSTATION_COLS);
			let count = 0;
			for (let row = 0; row < rows && count < this.sceneConfig.workstationCount; row++) {
				for (let col = 0; col < WORKSTATION_COLS && count < this.sceneConfig.workstationCount; col++) {
					const x = WORKSTATION_START.x + col * WORKSTATION_SPACING.x;
					const y = WORKSTATION_START.y + row * WORKSTATION_SPACING.y;
					const ws = new WorkstationActor({
						x,
						y,
						workstationColor: this.sceneConfig.workstationColor ?? "#1e293b",
						style: this.sceneConfig.workstationStyle,
						workstationId: `${this.sceneConfig.id}-${count}`,
					});
					this.add(ws);
					this.workstations.push(ws);
					count++;
				}
			}
		}

		// ── 5. Doorway actors ──────────────────────────────────
		for (const door of this.sceneConfig.doors) {
			const doorway = new DoorwayActor({
				x: door.position.x,
				y: door.position.y,
				targetScene: door.target,
				label: door.label,
				onClick: this.callbacks.onSceneChange,
			});
			doorway.z = 5;
			this.add(doorway);
		}

		// ── 6. Overlay labels ──────────────────────────────────
		if (this.sceneConfig.overlays) {
			for (const overlay of this.sceneConfig.overlays) {
				this.createOverlay(overlay, w);
			}
		}

		// ── Hub hint label (always created for hub scenes) ─────
		if (this.sceneConfig.workstationCount === 0) {
			this.hubHintLabel = new ex.Label({
				text: "",
				pos: ex.vec(w / 2, 52),
				font: new ex.Font({
					family: "system-ui, sans-serif",
					size: 10,
					unit: ex.FontUnit.Px,
					color: ex.Color.fromHex("#64748b"),
					textAlign: ex.TextAlign.Center,
				}),
				anchor: ex.vec(0.5, 0.5),
				z: 5,
			});
			this.hubHintLabel.body.collisionType = ex.CollisionType.PreventCollision;
			this.add(this.hubHintLabel);
		}
	}

	onActivate(): void {
		if (!this.brainSystem) return;
		for (const [name, actor] of this.agentActors) {
			const pos = this.brainSystem.getPosition(name);
			if (pos) {
				actor.pos.x = pos.x;
				actor.pos.y = pos.y;
			}
		}
	}

	// ── OLD APIs (backward-compatible) ──────────────────────────────

	setBrainSystem(brain: BrainSystem): void {
		this.brainSystem = brain;
	}

	setSpriteRegistry(registry: Map<string, AgentSprites>): void {
		this.spriteRegistry = registry;
	}

	/** Spawn an agent actor at the next available workstation. */
	spawnAgent(agent: DashboardAgent): void {
		if (this.agentActors.has(agent.name)) return;

		if (this.sceneConfig.workstationCount > 0) {
			// Room with workstations — find unoccupied slot
			const ws = this.workstations.find((w) => !w.occupied);
			const x = ws ? ws.pos.x : WORKSTATION_START.x + this.agentActors.size * 60;
			const y = ws ? ws.pos.y - 40 : WORKSTATION_START.y - 40;

			if (ws) ws.occupy(agent.name);

			const charName = resolveCharacter(agent.name, agent.domain ?? "");
			const sprites = this.spriteRegistry.get(charName);
			if (!sprites) return;
			const actor = new AgentActor({
				agent,
				x,
				y,
				onSelect: this.callbacks.onAgentSelect,
				sprites,
			});
			this.add(actor);
			this.agentActors.set(agent.name, actor);
		} else {
			// Hub — place at calculated grid position
			const w = this.engine?.drawWidth ?? 1200;
			const h = this.engine?.drawHeight ?? 700;
			const idx = this.agentActors.size;
			const col = idx % HUB_AGENTS_PER_ROW;
			const row = Math.floor(idx / HUB_AGENTS_PER_ROW);
			const cols = Math.min(idx + 1, HUB_AGENTS_PER_ROW);
			const gridW = cols * HUB_AGENT_SPACING;
			const areaW = w - 120;
			const startX = (areaW - gridW) / 2 + HUB_AGENT_SPACING / 2;
			const startY = (h - HUB_AGENT_SPACING) / 2 + 20;
			const x = startX + col * HUB_AGENT_SPACING;
			const y = startY + row * HUB_AGENT_SPACING;

			const charName = resolveCharacter(agent.name, agent.domain ?? "");
			const sprites = this.spriteRegistry.get(charName);
			if (!sprites) return;
			const actor = new AgentActor({
				agent,
				x,
				y,
				onSelect: this.callbacks.onAgentSelect,
				sprites,
			});
			actor.z = 10;
			this.add(actor);
			this.agentActors.set(agent.name, actor);
		}
	}

	/** Spawn an agent actor near the first door (used for room transfers). */
	spawnAgentAtDoorway(agent: DashboardAgent): void {
		if (this.agentActors.has(agent.name)) return;

		const doorway = this.getDoorwayPosition();
		const x = doorway.x + 30 + Math.random() * 40;
		const y = doorway.y - 20 + Math.random() * 40;

		const charName = resolveCharacter(agent.name, agent.domain ?? "");
		const sprites = this.spriteRegistry.get(charName);
		if (!sprites) return;
		const actor = new AgentActor({
			agent,
			x,
			y,
			onSelect: this.callbacks.onAgentSelect,
			sprites,
		});
		actor.z = 10;
		this.add(actor);
		this.agentActors.set(agent.name, actor);
	}

	/** Remove an agent actor by name. */
	removeAgent(name: string): void {
		const actor = this.agentActors.get(name);
		if (!actor) return;

		// Free the workstation if applicable
		const ws = this.workstations.find((w) => w.occupantName === name);
		if (ws) ws.vacate();

		actor.kill();
		this.agentActors.delete(name);
	}

	getAgentActor(name: string): AgentActor | undefined {
		const old = this.agentActors.get(name);
		if (old) return old;
		// Phase 3 entity — check SceneEntity wrapper (post-RoomSwitcher transfers)
		const entity = this.sceneEntities.get(name);
		if (entity && entity.entityType === "agent") {
			const actor = entity.getActor();
			if (actor) return actor as AgentActor;
		}
		return undefined;
	}

	getAgentActors(): ReadonlyMap<string, AgentActor> {
		return this.agentActors;
	}

	getWorkstations(): readonly WorkstationActor[] {
		return this.workstations;
	}

	/** Get the first door's position (backward compat with single-door rooms). */
	getDoorwayPosition(): { x: number; y: number } {
		const door = this.sceneConfig.doors[0];
		return door ? { x: door.position.x, y: door.position.y } : { x: 40, y: 250 };
	}

	/** Hub overlay: update the connection status indicator. No-op if not configured. */
	updateConnectionStatus(status: "connected" | "disconnected" | "reconnecting"): void {
		if (!this.connectionLabel) return;
		const labels: Record<string, string> = {
			connected: "LIVE",
			disconnected: "OFFLINE",
			reconnecting: "POLLING",
		};
		const colors: Record<string, string> = {
			connected: "#22c55e",
			disconnected: "#ef4444",
			reconnecting: "#f59e0b",
		};
		this.connectionLabel.text = labels[status] ?? "POLLING";
		this.connectionLabel.font = new ex.Font({
			family: "system-ui, sans-serif",
			size: 10,
			unit: ex.FontUnit.Px,
			color: ex.Color.fromHex(colors[status] ?? "#f59e0b"),
			textAlign: ex.TextAlign.Right,
		});
	}

	/** Hub overlay: update the iteration badge text. No-op if not configured. */
	updateIterationBadge(text: string): void {
		if (this.iterationLabel) {
			this.iterationLabel.text = text;
		}
	}

	/** Hub bulk update: create/update/remove agents based on roster. */
	updateAgents(agents: readonly DashboardAgent[]): void {
		const incoming = new Set<string>();

		// Only hub-resident agents get full actors (domain routing in domain-map.ts)
		const hubAgents = agents.filter((a) => resolveSettingForDomain(a.domain) === "hub");
		const offHubCount = agents.length - hubAgents.length;

		if (this.hubHintLabel) {
			if (agents.length === 0) {
				this.hubHintLabel.text =
					"No roster yet — add .flowti/agents/data/agent-dashboard.json or run the Flowti CLI.";
			} else if (offHubCount > 0 && hubAgents.length === 0) {
				this.hubHintLabel.text =
					`${offHubCount} agent(s) are in side rooms by domain — click the doors on the right (Office / Village / Station).`;
			} else if (offHubCount > 0) {
				this.hubHintLabel.text = `+${offHubCount} more in side rooms → use doors`;
			} else {
				this.hubHintLabel.text = "";
			}
		}

		const w = this.engine?.drawWidth ?? 1200;
		const h = this.engine?.drawHeight ?? 700;

		const cols = Math.min(hubAgents.length, HUB_AGENTS_PER_ROW);
		const rows = Math.ceil(hubAgents.length / HUB_AGENTS_PER_ROW) || 1;
		const gridW = cols * HUB_AGENT_SPACING;
		const gridH = rows * HUB_AGENT_SPACING;
		const areaW = w - 120;
		const startX = (areaW - gridW) / 2 + HUB_AGENT_SPACING / 2;
		const startY = (h - gridH) / 2 + 20;

		for (let i = 0; i < hubAgents.length; i++) {
			const agent = hubAgents[i];
			incoming.add(agent.name);

			const col = i % HUB_AGENTS_PER_ROW;
			const row = Math.floor(i / HUB_AGENTS_PER_ROW);
			const x = startX + col * HUB_AGENT_SPACING;
			const y = startY + row * HUB_AGENT_SPACING;

			if (this.agentActors.has(agent.name)) {
				const actor = this.agentActors.get(agent.name)!;
				actor.agentData = agent;
				actor.updateVisualStatus(agent.status);
			} else if (!this.sceneEntities.has(agent.name) && !this.transferredOut.has(agent.name)) {
				// Only create if not managed by Phase 3 or transferred out
				const charName = resolveCharacter(agent.name, agent.domain ?? "");
				const sprites = this.spriteRegistry.get(charName);
				if (!sprites) continue;
				const actor = new AgentActor({
					agent,
					x,
					y,
					onSelect: this.callbacks.onAgentSelect,
					sprites,
				});
				actor.z = 10;
				this.add(actor);
				this.agentActors.set(agent.name, actor);
			}
		}

		// Remove stale agent actors (skip entities managed by Phase 3)
		for (const [name, actor] of this.agentActors) {
			if (!incoming.has(name)) {
				actor.kill();
				this.agentActors.delete(name);
			}
		}
	}

	// ── NEW APIs (Phase 3 — SceneEntity-based) ──────────────────────

	/** Enter a scene entity from another scene (or null for initial spawn). */
	enter(entity: SceneEntity, fromScene: string | null): void {
		if (this.sceneEntities.has(entity.entityId)) return;
		this.transferredOut.delete(entity.entityId);

		// Find the door matching the source scene for spawn positioning
		let spawnX: number;
		let spawnY: number;
		if (fromScene) {
			const door = this.sceneConfig.doors.find((d) => d.target === fromScene);
			if (door) {
				spawnX = door.position.x + 30 + Math.random() * 40;
				spawnY = door.position.y - 20 + Math.random() * 40;
			} else {
				const fallback = this.getDoorwayPosition();
				spawnX = fallback.x + 30;
				spawnY = fallback.y;
			}
		} else {
			// Initial spawn — center of scene
			const w = this.engine?.drawWidth ?? 800;
			const h = this.engine?.drawHeight ?? 500;
			spawnX = w / 2;
			spawnY = h / 2;
		}

		const actor = entity.createActor(spawnX, spawnY);
		entity.onEnterScene(spawnX, spawnY);
		this.add(actor);
		this.sceneEntities.set(entity.entityId, entity);
	}

	/** Remove a scene entity by id (handles both Phase 3 and old-API actors). */
	exit(entityId: string): void {
		// Phase 3 entity — get actor BEFORE onExitScene nulls the reference
		const entity = this.sceneEntities.get(entityId);
		if (entity) {
			const actor = entity.getActor();
			entity.onExitScene();
			// kill() is immediate (sets isKilled=true, stops rendering).
			// remove() is deferred and never processes on non-active scenes.
			if (actor) actor.kill();
			this.sceneEntities.delete(entityId);
		}

		// Old-API agent actor (pre-Phase 3 placement via spawnAgent)
		const oldActor = this.agentActors.get(entityId);
		if (oldActor) {
			const ws = this.workstations.find((w) => w.occupantName === entityId);
			if (ws) ws.vacate();
			oldActor.kill();
			this.agentActors.delete(entityId);
		}

		this.transferredOut.add(entityId);
	}

	/** Register an existing scene actor for Phase 3 exit() tracking. */
	registerEntity(entity: SceneEntity): void {
		this.sceneEntities.set(entity.entityId, entity);
	}

	/** Get a tracked scene entity by id. */
	getEntity(id: string): SceneEntity | undefined {
		return this.sceneEntities.get(id);
	}

	/** Get all tracked scene entities. */
	getEntities(): ReadonlyMap<string, SceneEntity> {
		return this.sceneEntities;
	}

	// ── Private helpers ─────────────────────────────────────────────

	private createOverlay(overlay: OverlayConfig, sceneWidth: number): void {
		switch (overlay.type) {
			case "connection-status": {
				this.connectionLabel = new ex.Label({
					text: "POLLING",
					pos: ex.vec(overlay.position.x ?? sceneWidth - 12, overlay.position.y ?? 16),
					font: new ex.Font({
						family: "system-ui, sans-serif",
						size: 10,
						unit: ex.FontUnit.Px,
						color: ex.Color.fromHex("#f59e0b"),
						textAlign: ex.TextAlign.Right,
					}),
					anchor: ex.vec(1, 0.5),
					z: 20,
				});
				this.connectionLabel.body.collisionType = ex.CollisionType.PreventCollision;
				this.add(this.connectionLabel);
				break;
			}
			case "iteration-badge": {
				this.iterationLabel = new ex.Label({
					text: "",
					pos: ex.vec(overlay.position.x ?? sceneWidth / 2, overlay.position.y ?? 70),
					font: new ex.Font({
						family: "system-ui, sans-serif",
						size: 11,
						unit: ex.FontUnit.Px,
						color: ex.Color.fromHex("#64748b"),
						textAlign: ex.TextAlign.Center,
					}),
					anchor: ex.vec(0.5, 0.5),
					z: 5,
				});
				this.iterationLabel.body.collisionType = ex.CollisionType.PreventCollision;
				this.add(this.iterationLabel);
				break;
			}
		}
	}
}
