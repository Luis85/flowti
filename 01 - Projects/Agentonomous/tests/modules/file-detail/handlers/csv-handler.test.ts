import { describe, expect, it } from 'vitest';
import { csvHandler } from '../../../../src/modules/file-detail/handlers/csv-handler.js';

describe('csvHandler', () => {
	it('counts rows excluding header', () => {
		const result = csvHandler.analyze('name,age\nAlice,30\nBob,25', 'data.csv');
		expect(result.summary['Row count']).toBe(2);
	});

	it('counts columns from header', () => {
		const result = csvHandler.analyze('a,b,c\n1,2,3', 'data.csv');
		expect(result.summary['Column count']).toBe(3);
	});

	it('extracts column names', () => {
		const result = csvHandler.analyze('name,age,city\nA,1,X', 'data.csv');
		expect(result.summary['Columns']).toBe('name, age, city');
	});

	it('handles empty content', () => {
		const result = csvHandler.analyze('', 'empty.csv');
		expect(result.summary['Row count']).toBe(0);
	});

	it('handles header-only content (no data rows)', () => {
		const result = csvHandler.analyze('name,age,city', 'header-only.csv');
		expect(result.summary['Row count']).toBe(0);
		expect(result.summary['Column count']).toBe(3);
		expect(result.summary['Columns']).toBe('name, age, city');
	});
});
