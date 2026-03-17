import { CharacterData } from "src/models/Character";

export class CharacterCreatedEvent {
	constructor(public character: CharacterData) {}
}
