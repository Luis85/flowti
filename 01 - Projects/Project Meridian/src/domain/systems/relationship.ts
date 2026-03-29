import { clamp } from '../core/math-utils.js';

export interface RelationshipUpdateInput {
	currentDisposition: number;
	currentFamiliarity: number;
	dispositionChange: number;
	familiarityChange: number;
}

export interface RelationshipUpdateResult {
	newDisposition: number;
	newFamiliarity: number;
}

export function applyRelationshipUpdate(input: RelationshipUpdateInput): RelationshipUpdateResult {
	return {
		newDisposition: clamp(input.currentDisposition + input.dispositionChange, -100, 100),
		newFamiliarity: Math.max(0, input.currentFamiliarity + input.familiarityChange),
	};
}
