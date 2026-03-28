import { describe, it, expect } from 'vitest';
import { AttributesComponent } from '../../../src/infrastructure/components/attributes-component.js';
import { SocialComponent } from '../../../src/infrastructure/components/social-component.js';
import { TraitsComponent } from '../../../src/infrastructure/components/traits-component.js';
import { TrackedComponent } from '../../../src/infrastructure/components/tracked-component.js';

describe('AttributesComponent', () => {
	it('holds AttributesState and extends TrackedComponent', () => {
		const comp = new AttributesComponent({ ST: 12, DX: 10, IQ: 14, HT: 11 });
		expect(comp.state.ST).toBe(12);
		expect(comp.state.IQ).toBe(14);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});
});

describe('SocialComponent', () => {
	it('holds SocialState and extends TrackedComponent', () => {
		const comp = new SocialComponent({ status: 2, reputation: 1, charisma: 14 });
		expect(comp.state.status).toBe(2);
		expect(comp.state.charisma).toBe(14);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});
});

describe('TraitsComponent', () => {
	it('holds trait IDs and extends TrackedComponent', () => {
		const comp = new TraitsComponent(['brave', 'strong']);
		expect(comp.traitIds).toEqual(['brave', 'strong']);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});
});
