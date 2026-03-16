import type { PluginHandlerRegistry } from "./plugin-handler-registry";

export interface ConditionHandlerDeps {
	trainService: {
		getActiveTrain: () => { id: string; status: string } | null;
	};
	sessionService: {
		getActiveSession: () => { id: string; status: string } | null;
	};
	installerService: {
		isInstalled: () => boolean;
	};
}

export function registerConditionHandlers(
	registry: PluginHandlerRegistry,
	deps: ConditionHandlerDeps,
): void {
	registry.registerCondition("no-active-train", () => {
		return deps.trainService.getActiveTrain() === null;
	});

	registry.registerCondition("train-not-paused", () => {
		const train = deps.trainService.getActiveTrain();
		return !train || train.status !== "paused";
	});

	registry.registerCondition("train-not-running", () => {
		const train = deps.trainService.getActiveTrain();
		return !train || train.status !== "running";
	});

	registry.registerCondition("no-active-session", () => {
		return deps.sessionService.getActiveSession() === null;
	});

	registry.registerCondition("session-not-paused", () => {
		const session = deps.sessionService.getActiveSession();
		return !session || session.status !== "paused";
	});

	registry.registerCondition("is-installed", () => {
		return deps.installerService.isInstalled();
	});
}
