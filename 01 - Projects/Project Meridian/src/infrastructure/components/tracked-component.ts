import { Component } from 'excalibur';

export abstract class TrackedComponent extends Component {
	private _dirty = true;

	get dirty(): boolean { return this._dirty; }
	markDirty(): void { this._dirty = true; }
	clearDirty(): void { this._dirty = false; }
}
