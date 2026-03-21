/**
 * Train modal helper methods extracted from ModalService.
 *
 * These build configuration objects for the TrainCaptureModal:
 * thought context, timer subscriptions, navigation callbacks, etc.
 */

import type { IEventBus } from "../events/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { SessionService } from "../../domain/session/SessionService";
import type { ThoughtDirection } from "../../domain/train/types";
import { computeRemainingMs } from "../../domain/session/helpers";

export function resolveThoughtContext(
	trainService: TrainService,
	trainId: string,
	overrides?: { previousTitle: string; thoughtCount: number },
	fromThoughtId?: string,
): { previousThoughtTitle: string | null | undefined; thoughtCount: number } {
	if (overrides) return { previousThoughtTitle: overrides.previousTitle, thoughtCount: overrides.thoughtCount };
	const train = trainService.getTrain(trainId);
	if (!train) return { previousThoughtTitle: undefined, thoughtCount: 0 };
	const contextThought = fromThoughtId
		? train.thoughts.find((t) => t.id === fromThoughtId) ?? null
		: train.thoughts[train.thoughts.length - 1] ?? null;
	return { previousThoughtTitle: contextThought?.title ?? null, thoughtCount: train.thoughts.length };
}

export function resolveInitialRemainingMs(
	sessionService: SessionService | undefined,
	durationMinutes: number,
	sessionId?: string,
): number | undefined {
	if (durationMinutes <= 0 || !sessionId || !sessionService) return undefined;
	const session = sessionService.getSessionById(sessionId);
	return session ? computeRemainingMs(session) : undefined;
}

export function resolveDefaultDirection(
	fromThoughtId?: string,
	train?: { relations: Array<{ fromId: string; direction: string }> } | null,
): ThoughtDirection {
	if (!fromThoughtId || !train) return "next";
	return train.relations.some((r) => r.fromId === fromThoughtId && r.direction === "next") ? "branch" : "next";
}

export function buildTimerSubscriptions(
	eventBus: IEventBus,
	durationMinutes: number,
	sessionId?: string,
): {
	subscribeTimerTick?: (cb: (remainingMs: number) => void) => () => void;
	subscribeTimerCompleted?: (cb: () => void) => () => void;
} {
	if (durationMinutes <= 0 || !sessionId) return {};
	return {
		subscribeTimerTick: (cb) => eventBus.on("session.timer.tick", (event) => { if (event.payload.sessionId === sessionId) cb(event.payload.remainingMs); }),
		subscribeTimerCompleted: (cb) => eventBus.on("session.timer.completed", (event) => { if (event.payload.sessionId === sessionId) cb(); }),
	};
}

export function buildNavigationCallbacks(
	trainId: string,
	trainTitle: string,
	openTrainModal: (
		trainId: string,
		trainTitle: string,
		overrides?: { previousTitle: string; thoughtCount: number },
		fromThoughtId?: string,
		mergeDown?: boolean,
	) => void,
	fromThoughtId?: string,
	train?: { relations: Array<{ fromId: string; toId: string; direction: string }> } | null,
): { onBack?: () => void; onNext?: () => void; onUp?: () => void; onDown?: () => void } {
	if (!fromThoughtId || !train) return {};
	const result: { onBack?: () => void; onNext?: () => void; onUp?: () => void; onDown?: () => void } = {};
	const parentRelation = train.relations.find((r) => r.toId === fromThoughtId);
	if (parentRelation) result.onBack = () => openTrainModal(trainId, trainTitle, undefined, parentRelation.fromId);
	const nextRelation = train.relations.find((r) => r.fromId === fromThoughtId && r.direction === "next");
	if (nextRelation) result.onNext = () => openTrainModal(trainId, trainTitle, undefined, nextRelation.toId);
	const branchRelation = train.relations.find((r) => r.fromId === fromThoughtId && r.direction === "branch");
	if (branchRelation) result.onUp = () => openTrainModal(trainId, trainTitle, undefined, branchRelation.toId);
	const branchParentRelation = train.relations.find((r) => r.toId === fromThoughtId && r.direction === "branch");
	if (branchParentRelation) result.onDown = () => openTrainModal(trainId, trainTitle, undefined, branchParentRelation.fromId);
	return result;
}
