import type { QuestRuntime } from '../../domain/schemas/quest-schema.js';
import { TrackedComponent } from './tracked-component.js';

export interface QuestBoardState {
	quests: QuestRuntime[];
}

export class QuestBoardComponent extends TrackedComponent {
	constructor(public state: QuestBoardState) { super(); }
}
