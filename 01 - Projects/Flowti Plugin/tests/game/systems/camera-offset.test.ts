import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => {
	class MockVector {
		constructor(public x: number, public y: number) {}
	}
	function MockLockStrategy(this: Record<string, unknown>, actor: unknown) {
		this.target = actor;
		this.type = "lock";
	}
	return {
		Vector: MockVector,
		vec: (x: number, y: number) => new MockVector(x, y),
		LockCameraToActorStrategy: MockLockStrategy,
		EasingFunctions: { EaseInOutCubic: vi.fn() },
	};
});

import { createCameraSystem, OffsetFollowStrategy } from "../../../src/game/systems/camera-system.js";
import type { AgentActor } from "../../../src/game/actors/agent-actor.js";

function mockCamera() {
	return {
		zoom: 1,
		pos: { x: 0, y: 0 },
		move: vi.fn(),
		clearAllStrategies: vi.fn(),
		addStrategy: vi.fn(),
	};
}

function mockActor(name = "Alice"): AgentActor {
	return {
		agentData: { name },
		center: { x: 200, y: 150 },
		isKilled: vi.fn().mockReturnValue(false),
	} as unknown as AgentActor;
}

describe("camera-offset", () => {
	let camera: ReturnType<typeof mockCamera>;
	let sys: ReturnType<typeof createCameraSystem>;

	beforeEach(() => {
		camera = mockCamera();
		sys = createCameraSystem(camera as never, { x: 400, y: 300 });
	});

	describe("setPanelOffset", () => {
		it("stores offset and re-applies strategy on followed actor", () => {
			const actor = mockActor();
			sys.startFollow(actor);
			camera.addStrategy.mockClear();
			camera.clearAllStrategies.mockClear();

			sys.setPanelOffset(120);

			expect(camera.clearAllStrategies).toHaveBeenCalledOnce();
			expect(camera.addStrategy).toHaveBeenCalledOnce();
			const strategy = camera.addStrategy.mock.calls[0][0];
			expect(strategy).toBeInstanceOf(OffsetFollowStrategy);
			expect(strategy.offset).toBe(120);
		});

		it("does nothing when no actor is followed", () => {
			sys.setPanelOffset(120);

			expect(camera.clearAllStrategies).not.toHaveBeenCalled();
			expect(camera.addStrategy).not.toHaveBeenCalled();
		});

		it("reverts to LockCameraToActorStrategy when offset is set back to 0", () => {
			const actor = mockActor();
			sys.startFollow(actor);
			sys.setPanelOffset(120);
			camera.addStrategy.mockClear();
			camera.clearAllStrategies.mockClear();

			sys.setPanelOffset(0);

			expect(camera.clearAllStrategies).toHaveBeenCalledOnce();
			expect(camera.addStrategy).toHaveBeenCalledOnce();
			const strategy = camera.addStrategy.mock.calls[0][0];
			expect(strategy).not.toBeInstanceOf(OffsetFollowStrategy);
		});
	});

	describe("startFollow with offset", () => {
		it("uses OffsetFollowStrategy when panelOffset > 0", () => {
			sys.setPanelOffset(100);
			const actor = mockActor();
			camera.addStrategy.mockClear();

			sys.startFollow(actor);

			const strategy = camera.addStrategy.mock.calls[0][0];
			expect(strategy).toBeInstanceOf(OffsetFollowStrategy);
			expect(strategy.offset).toBe(100);
		});

		it("uses LockCameraToActorStrategy when panelOffset is 0", () => {
			const actor = mockActor();
			sys.startFollow(actor);

			const strategy = camera.addStrategy.mock.calls[0][0];
			expect(strategy).not.toBeInstanceOf(OffsetFollowStrategy);
		});
	});

	describe("OffsetFollowStrategy.action", () => {
		it("returns a vector shifted left by offset", () => {
			const actor = mockActor();
			const strategy = new OffsetFollowStrategy(actor as never, 150);

			const result = strategy.action(actor as never, {} as never, {} as never, 16);

			expect(result.x).toBe(200 - 150);
			expect(result.y).toBe(150);
		});
	});
});
