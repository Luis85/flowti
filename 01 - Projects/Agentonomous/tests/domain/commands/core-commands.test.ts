import { describe, expect, it } from 'vitest';
import { CORE_COMMANDS } from '../../../src/domain/commands/core-commands.js';
import { VIEW_TYPE_HOMEPAGE } from '../../../src/domain/views/view-types.js';

describe('CORE_COMMANDS', () => {
	it('contains the open-homepage command', () => {
		const cmd = CORE_COMMANDS.find((c) => c.id === 'open-homepage');
		expect(cmd).toBeDefined();
	});

	it('open-homepage command opens the homepage view', () => {
		const cmd = CORE_COMMANDS.find((c) => c.id === 'open-homepage');
		expect(cmd?.opensView).toBe(VIEW_TYPE_HOMEPAGE);
	});

	it('open-homepage has a ribbon config with visibleByDefault true', () => {
		const cmd = CORE_COMMANDS.find((c) => c.id === 'open-homepage');
		expect(cmd?.ribbon?.visibleByDefault).toBe(true);
	});
});
