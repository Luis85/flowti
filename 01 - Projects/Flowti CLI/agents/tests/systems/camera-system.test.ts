import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => ({
	LockCameraToActorStrategy: class {
		constructor(public actor: unknown) {}
	},
}));

import { createCameraSystem } from "../../src/systems/camera-system.js";

function mockActor(name: string, killed = false) {
	let isKilledResult = killed;
	return {
		agentData: { name },
		isKilled: () => isKilledResult,
		pos: { x: 100, y: 100 },
		_setKilled(val: boolean) { isKilledResult = val; },
	};
}

function mockCamera() {
	const strategies: unknown[] = [];
	return {
		addStrategy: vi.fn((s: unknown) => strategies.push(s)),
		clearAllStrategies: vi.fn(() => strategies.length = 0),
		zoom: 1,
		strategies,
	};
}

function mockContainer() {
	const children: HTMLElement[] = [];
	return {
		appendChild: vi.fn((el: HTMLElement) => children.push(el)),
		removeChild: vi.fn((el: HTMLElement) => {
			const idx = children.indexOf(el);
			if (idx >= 0) children.splice(idx, 1);
		}),
		querySelector: vi.fn(() => null),
		children,
	} as unknown as HTMLElement;
}

describe("createCameraSystem", () => {
	it("startFollow locks camera and shows HUD", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as never, container);
		const actor = mockActor("alice");

		system.startFollow(actor as never);
		expect(system.isFollowing()).toBe(true);
		expect(system.getFollowedName()).toBe("alice");
		expect(camera.addStrategy).toHaveBeenCalledOnce();
	});

	it("stopFollow releases camera and hides HUD", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as never, container);
		const actor = mockActor("alice");

		system.startFollow(actor as never);
		system.stopFollow();
		expect(system.isFollowing()).toBe(false);
		expect(system.getFollowedName()).toBeNull();
		expect(camera.clearAllStrategies).toHaveBeenCalled();
	});

	it("checkDespawn stops follow when actor is killed", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as never, container);
		const actor = mockActor("alice", false);

		system.startFollow(actor as never);
		expect(system.isFollowing()).toBe(true);

		// Simulate despawn
		actor._setKilled(true);
		system.checkDespawn();
		expect(system.isFollowing()).toBe(false);
	});

	it("onSceneActivate re-acquires agent in new scene", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as never, container);
		const actor = mockActor("alice");

		system.startFollow(actor as never);
		const newCamera = mockCamera();
		const newActor = mockActor("alice");
		const findActor = vi.fn(() => newActor as never);

		system.onSceneActivate(findActor, newCamera as never);
		expect(system.isFollowing()).toBe(true);
		expect(findActor).toHaveBeenCalledWith("alice");
	});

	it("onSceneActivate stops follow when agent not in new scene", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as never, container);
		const actor = mockActor("alice");

		system.startFollow(actor as never);
		const newCamera = mockCamera();
		const findActor = vi.fn(() => undefined);

		system.onSceneActivate(findActor, newCamera as never);
		expect(system.isFollowing()).toBe(false);
	});

	it("handleZoom clamps between 0.5 and 2.0", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as never, container);

		system.handleZoom(-100); // zoom out
		system.applyZoom(16);
		expect(camera.zoom).toBeGreaterThanOrEqual(0.5);

		camera.zoom = 1;
		system.handleZoom(100); // zoom in
		system.applyZoom(16);
		expect(camera.zoom).toBeLessThanOrEqual(2.0);
	});
});
