import type { TypeSchema } from './type-schema.js';

function yamlQuote(s: string): string {
	return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function generateBaseYaml(schema: TypeSchema): string {
	const lines: string[] = [];
	lines.push('filters:');
	lines.push('  and:');
	lines.push('    - file.ext == "md"');
	lines.push(`    - type == ${yamlQuote(schema.name)}`);
	lines.push('');
	lines.push('formulas: {}');
	lines.push('');
	lines.push('properties:');
	for (const field of schema.fields) {
		lines.push(`  ${field.name}:`);
		lines.push(`    displayName: ${yamlQuote(field.label ?? field.name)}`);
	}
	lines.push('');
	lines.push('views:');
	lines.push('  - type: table');
	lines.push(`    name: ${yamlQuote(`All ${schema.name}`)}`);
	lines.push('    order:');
	lines.push('      - file.name');
	for (const field of schema.fields) {
		lines.push(`      - ${field.name}`);
	}
	lines.push('');
	return lines.join('\n');
}
