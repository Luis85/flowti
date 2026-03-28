import { describe, it, expect } from 'vitest';
import * as ex from 'excalibur';
import { TrackedComponent } from '../../../src/infrastructure/components/tracked-component.js';

class TestComponent extends TrackedComponent {
	constructor(public value: number) { super(); }
}

describe('TrackedComponent', () => {
	it('is dirty on creation', () => {
		const comp = new TestComponent(42);
		expect(comp.dirty).toBe(true);
	});

	it('clearDirty sets dirty to false', () => {
		const comp = new TestComponent(42);
		comp.clearDirty();
		expect(comp.dirty).toBe(false);
	});

	it('markDirty sets dirty to true after clearing', () => {
		const comp = new TestComponent(42);
		comp.clearDirty();
		comp.markDirty();
		expect(comp.dirty).toBe(true);
	});

	it('extends ExcaliburJS Component', () => {
		const comp = new TestComponent(42);
		expect(comp).toBeInstanceOf(ex.Component);
	});
});
