import { describe, it, expect } from 'vitest';
import type { MarkdownService } from '../../../src/domain/core/markdown-service.js';

describe('MarkdownService interface', () => {
	it('can be implemented with all required methods', () => {
		const service: MarkdownService = {
			serialize: () => '---\n---\n',
			fromTemplate: () => ({ ok: true, value: '---\n---\n' }),
			renderTemplate: async () => ({ ok: true, value: '---\n---\n' }),
		};
		expect(service.serialize).toBeDefined();
		expect(service.fromTemplate).toBeDefined();
		expect(service.renderTemplate).toBeDefined();
	});
});
