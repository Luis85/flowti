import { describe, it, expect } from 'vitest';
import type { MarkdownService } from '../../../src/domain/core/markdown-service.js';
import { Result } from '../../../src/domain/core/result.js';

describe('MarkdownService interface', () => {
	it('can be implemented with all required methods', () => {
		const service: MarkdownService = {
			serialize: () => '---\n---\n',
			fromTemplate: () => Result.ok('---\n---\n'),
			renderTemplate: async () => Result.ok('---\n---\n'),
		};
		expect(service.serialize).toBeDefined();
		expect(service.fromTemplate).toBeDefined();
		expect(service.renderTemplate).toBeDefined();
	});
});
