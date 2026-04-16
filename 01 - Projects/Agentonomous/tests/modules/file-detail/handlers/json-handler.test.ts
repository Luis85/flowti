import { describe, expect, it } from 'vitest';
import { jsonHandler } from '../../../../src/modules/file-detail/handlers/json-handler.js';

describe('jsonHandler', () => {
	it('detects object type and key count', () => {
		const result = jsonHandler.analyze('{"a":1,"b":2}', 'data.json');
		expect(result.summary['Type']).toBe('object');
		expect(result.summary['Key count']).toBe(2);
	});

	it('detects array type and item count', () => {
		const result = jsonHandler.analyze('[1,2,3]', 'data.json');
		expect(result.summary['Type']).toBe('array');
		expect(result.summary['Item count']).toBe(3);
	});

	it('calculates max nesting depth', () => {
		const result = jsonHandler.analyze('{"a":{"b":{"c":1}}}', 'deep.json');
		expect(result.summary['Depth']).toBe(3);
	});

	it('handles invalid JSON gracefully', () => {
		const result = jsonHandler.analyze('not json', 'bad.json');
		expect(result.summary['Type']).toBe('invalid');
	});

	it('handles primitive type', () => {
		const result = jsonHandler.analyze('"hello"', 'str.json');
		expect(result.summary['Type']).toBe('string');
	});
});
