import { describe, it, expect } from 'vitest';
import { NeedsComponent } from '../../../src/infrastructure/components/needs-component.js';
import { MoodComponent } from '../../../src/infrastructure/components/mood-component.js';
import { MemoryComponent } from '../../../src/infrastructure/components/memory-component.js';
import { TrackedComponent } from '../../../src/infrastructure/components/tracked-component.js';

describe('NeedsComponent', () => {
	it('holds NeedsState and is dirty on creation', () => {
		const comp = new NeedsComponent({ hunger: 80, energy: 90, social: 70 });
		expect(comp.state.hunger).toBe(80);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new NeedsComponent({ hunger: 80, energy: 90, social: 70 });
		comp.clearDirty();
		comp.state.hunger -= 10;
		comp.markDirty();
		expect(comp.state.hunger).toBe(70);
		expect(comp.dirty).toBe(true);
	});
});

describe('MoodComponent', () => {
	it('holds MoodState and is dirty on creation', () => {
		const comp = new MoodComponent({ value: 50, bucket: 'content' });
		expect(comp.state.value).toBe(50);
		expect(comp.state.bucket).toBe('content');
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new MoodComponent({ value: 50, bucket: 'content' });
		comp.clearDirty();
		comp.state.value = 30;
		comp.state.bucket = 'stressed';
		comp.markDirty();
		expect(comp.state.value).toBe(30);
		expect(comp.dirty).toBe(true);
	});
});

describe('MemoryComponent', () => {
	it('holds MemoryState and is dirty on creation', () => {
		const comp = new MemoryComponent({ entries: [], maxEntries: 50 });
		expect(comp.state.entries).toEqual([]);
		expect(comp.state.maxEntries).toBe(50);
		expect(comp.dirty).toBe(true);
		expect(comp).toBeInstanceOf(TrackedComponent);
	});

	it('supports state mutation with dirty tracking', () => {
		const comp = new MemoryComponent({ entries: [], maxEntries: 50 });
		comp.clearDirty();
		comp.state.entries.push({
			tick: 1, type: 'test', description: 'test', participants: [],
			outcome: 'neutral', significance: 1, mood_impact: 0,
		});
		comp.markDirty();
		expect(comp.state.entries).toHaveLength(1);
		expect(comp.dirty).toBe(true);
	});
});

