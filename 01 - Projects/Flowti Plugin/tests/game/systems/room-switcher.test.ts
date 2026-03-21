import { describe, it, expect, beforeEach, vi } from "vitest";
import { SceneRegistry } from "../../../src/game/systems/scene-registry.js";
import { RoomSwitcher } from "../../../src/game/systems/room-switcher.js";
import type { SceneEntity } from "../../../src/game/data/scene-entity.js";

function createMockEntity(id: string, type: "agent" | "creature" = "agent"): SceneEntity & { pos: { x: number; y: number } } {
	const pos = { x: 400, y: 250 };
	return {
		entityId: id,
		entityType: type,
		pos,
		createActor: vi.fn().mockReturnValue({}),
		getActor: vi.fn().mockReturnValue(null),
		moveTo: vi.fn((x: number, y: number) => { pos.x = x; pos.y = y; }),
		getPosition: () => ({ x: pos.x, y: pos.y }),
		onExitScene: vi.fn(),
		onEnterScene: vi.fn(),
	};
}

function createMockScene() {
	return {
		getDoors: vi.fn().mockReturnValue([]),
		enter: vi.fn(),
		exit: vi.fn(),
	};
}

describe("RoomSwitcher", () => {
	let registry: SceneRegistry;
	let entities: Map<string, ReturnType<typeof createMockEntity>>;
	let scenes: Map<string, ReturnType<typeof createMockScene>>;
	let switcher: RoomSwitcher;

	beforeEach(() => {
		registry = new SceneRegistry();
		entities = new Map();
		scenes = new Map();

		// Set up scenes with doors
		const hubScene = createMockScene();
		hubScene.getDoors.mockReturnValue([
			{ target: "office", label: "Office", position: { x: 750, y: 130 } },
			{ target: "village", label: "Village", position: { x: 750, y: 250 } },
		]);
		const officeScene = createMockScene();
		officeScene.getDoors.mockReturnValue([
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		]);
		const villageScene = createMockScene();
		villageScene.getDoors.mockReturnValue([
			{ target: "hub", label: "Back", position: { x: 40, y: 250 } },
		]);

		registry.registerScene("hub", hubScene);
		registry.registerScene("office", officeScene);
		registry.registerScene("village", villageScene);
		scenes.set("hub", hubScene);
		scenes.set("office", officeScene);
		scenes.set("village", villageScene);

		switcher = new RoomSwitcher({
			registry,
			getEntity: (id) => entities.get(id),
			getEntityState: () => "idle",
			isTaskLocked: () => false,
		});
	});

	it("marks entity as in transit on requestTransfer", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		switcher.requestTransfer({ entityId: "Bob", targetRoom: "hub", reason: "explore" });
		expect(registry.isInTransit("Bob")).toBe(true);
	});

	it("calls moveTo on entity when transfer requested", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		switcher.requestTransfer({ entityId: "Bob", targetRoom: "hub", reason: "explore" });
		expect(bob.moveTo).toHaveBeenCalledWith(40, 250); // office door position
	});

	it("executes transfer when entity reaches door", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		switcher.requestTransfer({ entityId: "Bob", targetRoom: "hub", reason: "explore" });

		// Simulate entity reaching the door
		bob.pos.x = 40;
		bob.pos.y = 250;

		switcher.update(0);

		expect(registry.getEntityRoom("Bob")).toBe("hub");
		expect(registry.isInTransit("Bob")).toBe(false);
		expect(scenes.get("office")!.exit).toHaveBeenCalledWith("Bob");
		expect(scenes.get("hub")!.enter).toHaveBeenCalled();
	});

	it("routes through hub for indirect transfers", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		// office → village has no direct door, should route via hub
		switcher.requestTransfer({ entityId: "Bob", targetRoom: "village", reason: "explore" });

		// Should first go to hub door (office back door at 40, 250)
		expect(bob.moveTo).toHaveBeenCalledWith(40, 250);
		expect(registry.getTransit("Bob")?.target).toBe("hub");
	});

	it("skips entities already in transit", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		switcher.requestTransfer({ entityId: "Bob", targetRoom: "hub", reason: "explore" });
		switcher.requestTransfer({ entityId: "Bob", targetRoom: "village", reason: "explore" });

		// Should still be going to hub, not village
		expect(registry.getTransit("Bob")?.target).toBe("hub");
	});

	it("skips transfer to same room", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		switcher.requestTransfer({ entityId: "Bob", targetRoom: "office", reason: "explore" });
		expect(registry.isInTransit("Bob")).toBe(false);
	});

	it("clears transit for missing entities during arrival check", () => {
		registry.setEntityRoom("Ghost", "office");
		registry.setInTransit("Ghost", "hub", { x: 40, y: 250 });

		// Ghost entity not in the entities map — should be cleaned up
		switcher.update(0);

		expect(registry.isInTransit("Ghost")).toBe(false);
	});

	it("fires onTransferComplete callback", () => {
		const onComplete = vi.fn();
		const completeSwitcher = new RoomSwitcher({
			registry,
			getEntity: (id) => entities.get(id),
			getEntityState: () => "idle",
			isTaskLocked: () => false,
			onTransferComplete: onComplete,
		});

		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		completeSwitcher.requestTransfer({ entityId: "Bob", targetRoom: "hub", reason: "explore" });
		bob.pos.x = 40;
		bob.pos.y = 250;
		completeSwitcher.update(0);

		expect(onComplete).toHaveBeenCalledWith("Bob", "office", "hub", "transfer");
	});

	it("queues second hop for multi-hop transfers", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		registry.setEntityRoom("Bob", "office");

		// office → village requires going through hub
		switcher.requestTransfer({ entityId: "Bob", targetRoom: "village", reason: "explore" });

		// Arrive at hub door
		bob.pos.x = 40;
		bob.pos.y = 250;
		switcher.update(0);

		// Should now be in hub with a cooldown before hopping to village
		expect(registry.getEntityRoom("Bob")).toBe("hub");
		expect(registry.isInTransit("Bob")).toBe(false);

		// Tick the cooldown (2000ms)
		switcher.update(2001);

		// Now should be in transit to village
		expect(registry.isInTransit("Bob")).toBe(true);
		expect(registry.getTransit("Bob")?.target).toBe("village");
	});

	it("ignores transfer when entity has no room assignment", () => {
		const bob = createMockEntity("Bob");
		entities.set("Bob", bob);
		// No room assignment

		switcher.requestTransfer({ entityId: "Bob", targetRoom: "hub", reason: "explore" });
		expect(registry.isInTransit("Bob")).toBe(false);
	});
});
