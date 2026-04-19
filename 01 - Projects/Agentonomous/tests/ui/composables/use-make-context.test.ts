import { describe, it, expect } from 'vitest';
import { createFakeMakeContext } from '../../__fixtures__/fake-make-context.js';
import { fakeWorkspace } from '../../__fakes__/fake-ports.js';

describe('MakeContext', () => {
	it('exposes workspace port on MakeContext', () => {
		const { port: workspace } = fakeWorkspace();
		const ctx = createFakeMakeContext({ workspace });
		expect(ctx.workspace).toBe(workspace);
	});
});
